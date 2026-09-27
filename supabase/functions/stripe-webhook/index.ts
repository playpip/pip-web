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

import Stripe from 'npm:stripe'
import { LIVE, admin, isPip, stripe } from '../_shared/billing.ts'

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
    .select('stripe_subscription_id, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (
    existing?.stripe_subscription_id &&
    existing.stripe_subscription_id !== sub.id &&
    LIVE.includes(existing.status) &&
    !LIVE.includes(sub.status)
  ) {
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
        if (session.mode === 'subscription' && session.subscription) {
          const id =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id
          await sync(id)
        }
        break
      }
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
