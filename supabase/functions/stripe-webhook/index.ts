// Stripe → the memberships table. The only writer that table has.
//
// Deployed with JWT verification off (supabase/config.toml), because Stripe
// does not hold a Supabase token. What stands in for it is the signature: an
// event whose `Stripe-Signature` does not verify against STRIPE_WEBHOOK_SECRET
// is refused before anything is read from it. Without that check this endpoint
// would be a public "make me a member" button.
//
// **The Stripe account is shared** with Ava Technologies' other projects, so
// this endpoint is sent Probus's checkouts and subscriptions too. Anything not
// tagged `metadata.project = pip` is acknowledged with a 200 and left alone:
// a 500 would have Stripe retry somebody else's event for three days and then
// disable this endpoint.
//
// **Every event is treated as a nudge, not as the truth.** Stripe does not
// promise to deliver events in order, so an `updated` can arrive after the
// `deleted` that followed it. Rather than write whatever the event carried, this
// fetches the subscription as it is *now* and writes that. Replaying, reordering
// or duplicating events therefore cannot leave a stale status behind.

import Stripe from 'npm:stripe@22'
import { LIFETIME_UNTIL, LIVE, admin, isPip, stripe } from '../_shared/billing.ts'

/** The statuses that make somebody a member — src/lib/membership/entitlement.ts. */
const ENTITLING = ['active', 'trialing']

const SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
// Deno has no node:crypto HMAC on the hot path; Web Crypto does the check.
const crypto = Stripe.createSubtleCryptoProvider()

/**
 * When the paid period ends. Stripe moved this from the subscription onto its
 * items in API version 2025-03-31, and which one a given SDK returns depends on
 * the version it pins, so read whichever is there.
 */
function periodEnd(sub: Stripe.Subscription): string | null {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end
  const item = (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)
    ?.current_period_end
  const seconds = legacy ?? item
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null
}

async function sync(subscriptionId: string): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  if (!isPip(sub.metadata)) return
  const userId = sub.metadata?.user_id
  if (!userId) {
    // Made in the dashboard by hand, or by something other than our checkout.
    // Nobody to give it to, so nothing to write — and saying so, because a
    // subscription nobody is entitled by is money taken for nothing.
    console.warn(`subscription ${sub.id} has no user_id in its metadata; not written`)
    return
  }

  // One row per player. If they already hold a *different* live subscription,
  // a late event about an old dead one must not overwrite it.
  const { data: existing } = await admin
    .from('memberships')
    .select('stripe_subscription_id, status, source, lifetime')
    .eq('user_id', userId)
    .maybeSingle()
  // A lifetime member is never overwritten by a subscription, live or dead
  // (cmo#252). Only a refund of the lifetime payment ends it (`refunded`).
  if (existing?.lifetime && ENTITLING.includes(existing.status)) return
  // A live membership bought in the app (revenuecat-webhook) is never
  // overwritten by a Stripe subscription that isn't live.
  if (
    existing &&
    existing.source !== 'stripe' &&
    ENTITLING.includes(existing.status) &&
    !LIVE.includes(sub.status)
  ) {
    return
  }
  if (
    existing?.stripe_subscription_id &&
    existing.stripe_subscription_id !== sub.id &&
    LIVE.includes(existing.status) &&
    !LIVE.includes(sub.status)
  ) {
    return
  }

  // **A second live subscription for somebody who already has one is a double
  // charge.** Checkout expires a player's other open sessions before making a
  // new one, but two paid within seconds of each other can still both land.
  // Keep the one already in the row, cancel the newcomer so it never renews,
  // and say so as an error: its first payment went through and needs refunding
  // by hand (the restricted key cannot issue refunds, on purpose).
  if (
    existing?.stripe_subscription_id &&
    existing.stripe_subscription_id !== sub.id &&
    ENTITLING.includes(existing.status) &&
    ENTITLING.includes(sub.status)
  ) {
    await stripe.subscriptions.cancel(sub.id)
    console.error(
      `DUPLICATE subscription ${sub.id} for user ${userId} (keeping ${existing.stripe_subscription_id}); cancelled it — REFUND ITS FIRST INVOICE in the dashboard`,
    )
    return
  }

  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const { error } = await admin.from('memberships').upsert(
    {
      user_id: userId,
      stripe_customer_id: customer,
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: periodEnd(sub),
      cancel_at_period_end: sub.cancel_at_period_end || sub.cancel_at !== null,
      price_id: sub.items.data[0]?.price.id ?? null,
      source: 'stripe',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  // The player deleted their account, and `delete-account` cancelled the
  // subscription on the way out. Its `deleted` event lands after the user row
  // is gone, so the foreign key refuses it. That is the right answer: there is
  // nobody left to hold a membership. Acknowledged so Stripe stops retrying.
  if (error?.code === '23503') return
  if (error) throw error
}

/**
 * A paid lifetime checkout (cmo#252): the player is a member for as long as
 * Pip runs. Written only once the money has arrived — `payment_status` is
 * `paid` at completion for a card, and later, on `async_payment_succeeded`,
 * for a method that settles slowly.
 */
async function grantLifetime(session: Stripe.Checkout.Session): Promise<void> {
  if (session.metadata?.kind !== 'lifetime' || session.payment_status !== 'paid') return
  const userId = session.metadata?.user_id
  if (!userId) {
    console.warn(`lifetime session ${session.id} has no user_id in its metadata; not written`)
    return
  }
  const customer =
    typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null)
  const { data: existing } = await admin
    .from('memberships')
    .select('stripe_subscription_id, status, source, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  // Checkout refuses a live member, but a subscription paid in another tab can
  // land first. They have paid for life now, so the subscription stops here
  // and its last payment needs refunding by hand, the same as a duplicate.
  if (
    existing?.source === 'stripe' &&
    existing.stripe_subscription_id &&
    LIVE.includes(existing.status)
  ) {
    await stripe.subscriptions.cancel(existing.stripe_subscription_id)
    console.error(
      `LIFETIME bought over subscription ${existing.stripe_subscription_id} for user ${userId}; cancelled it — REFUND ITS LAST INVOICE in the dashboard`,
    )
  }
  const { error } = await admin.from('memberships').upsert(
    {
      user_id: userId,
      stripe_customer_id: customer ?? existing?.stripe_customer_id ?? null,
      stripe_subscription_id: null,
      status: 'active',
      current_period_end: LIFETIME_UNTIL,
      cancel_at_period_end: false,
      price_id: null,
      source: 'stripe',
      lifetime: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error?.code === '23503') return
  if (error) throw error
}

/**
 * A refunded lifetime payment ends the membership. Only a full refund, and
 * only of a payment tagged as Pip's lifetime: the charge itself carries no
 * metadata, so its payment is fetched to read the tag.
 */
async function refundLifetime(charge: Stripe.Charge): Promise<void> {
  if (!charge.refunded || !charge.payment_intent) return
  const id =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id
  const payment = await stripe.paymentIntents.retrieve(id)
  if (!isPip(payment.metadata) || payment.metadata?.kind !== 'lifetime') return
  const userId = payment.metadata?.user_id
  if (!userId) return
  const { error } = await admin
    .from('memberships')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('lifetime', true)
  if (error) throw error
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 })

  const signature = req.headers.get('Stripe-Signature')
  if (!signature || !SECRET) return new Response('unsigned', { status: 400 })

  // The raw body, byte for byte. Parsing it first would change what was signed.
  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, SECRET, undefined, crypto)
  } catch {
    return new Response('bad signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (!isPip(session.metadata)) break
        if (session.mode === 'payment') {
          await grantLifetime(session)
        } else if (session.mode === 'subscription' && session.subscription) {
          const id =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id
          await sync(id)
        }
        break
      }
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session
        if (isPip(session.metadata) && session.mode === 'payment') await grantLifetime(session)
        break
      }
      case 'charge.refunded':
        await refundLifetime(event.data.object as Stripe.Charge)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed': {
        // Checked on the event before spending an API call on the fetch, since
        // most subscription events on a shared account are somebody else's.
        const sub = event.data.object as Stripe.Subscription
        if (isPip(sub.metadata)) await sync(sub.id)
        break
      }
      default:
        // Not subscribed to in the dashboard, or not ours to care about.
        break
    }
  } catch (err) {
    // A 500 makes Stripe retry with backoff for up to three days, which is
    // exactly what a database blip should get.
    console.error(`webhook ${event.id} (${event.type}) failed:`, err)
    return new Response('failed', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
