// RevenueCat (the App Store and Google Play) → the memberships table.
//
// The store twin of `stripe-webhook`, and the only other writer that table
// has. A membership bought in the app ends up in the same row a Stripe one
// does, so the web app's idea of who is a member never has to change.
//
// Deployed with JWT verification off (supabase/config.toml), because RevenueCat
// does not hold a Supabase token. What stands in for it is the Authorization
// header RevenueCat is configured to send: a request without the exact secret
// is refused before anything is read. Without that check this endpoint would be
// a public "make me a member" button.
//
// **Every event is treated as a nudge, not as the truth**, same as Stripe.
// RevenueCat does not promise order either, so rather than write what the event
// carried, this asks RevenueCat for the subscriber as they are *now* and writes
// that. Replays, reordering and duplicates can't leave a stale status behind.
//
// The app user id is the Supabase user id (mobile/src/purchases.ts), so it is
// the row's key directly.

import { admin, env } from '../_shared/service.ts'

/** The entitlement's identifier in RevenueCat, as in mobile/src/purchases.ts. */
const ENTITLEMENT = 'member'

/** The statuses that make somebody a member — src/lib/membership/entitlement.ts. */
const ENTITLING = ['active', 'trialing']

const AUTH = env('REVENUECAT_WEBHOOK_AUTH')
const SECRET_KEY = env('REVENUECAT_SECRET_KEY')

/**
 * A Supabase user id. Anything else (RevenueCat's own `$RCAnonymousID:`, a
 * purchase made before sign-in) has nobody to give a membership to, and would
 * fail the uuid column on every retry.
 */
const pipUser = (id: string | undefined): id is string =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

interface Subscription {
  store: string
  expires_date: string | null
  unsubscribe_detected_at: string | null
  billing_issues_detected_at: string | null
}

interface Subscriber {
  entitlements: Record<string, { expires_date: string | null; product_identifier: string }>
  subscriptions: Record<string, Subscription>
}

async function subscriber(userId: string): Promise<Subscriber> {
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      headers: { Authorization: `Bearer ${SECRET_KEY}` },
    },
  )
  if (!res.ok) throw new Error(`RevenueCat answered ${res.status}`)
  return (await res.json()).subscriber
}

/**
 * The row this subscriber should have, in the same vocabulary Stripe's status
 * uses, so entitlement.ts reads both the same way. Null when they have never
 * held the entitlement, which writes nothing.
 */
function rowFor(userId: string, sub: Subscriber) {
  const entitlement = sub.entitlements[ENTITLEMENT]
  if (!entitlement) return null
  const product = entitlement.product_identifier
  const subscription = sub.subscriptions[product]
  const expires = entitlement.expires_date ? Date.parse(entitlement.expires_date) : null
  const live = expires === null || expires > Date.now()

  // Inside the store's grace period the entitlement is still live and the
  // player keeps it. Once it lapses with a billing problem on record, that is
  // Stripe's `past_due`: paused, not cancelled, and the app says so.
  const status = live
    ? 'active'
    : subscription?.billing_issues_detected_at
      ? 'past_due'
      : 'canceled'

  return {
    user_id: userId,
    source: subscription?.store === 'play_store' ? 'play_store' : 'app_store',
    status,
    current_period_end: entitlement.expires_date,
    cancel_at_period_end: live && Boolean(subscription?.unsubscribe_detected_at),
    price_id: product,
    // A store membership has no Stripe subscription. Cleared, so a late Stripe
    // event about an old one can't be matched to this row and overwrite it.
    stripe_subscription_id: null,
    updated_at: new Date().toISOString(),
  }
}

async function sync(userId: string): Promise<void> {
  const row = rowFor(userId, await subscriber(userId))
  if (!row) return

  // A live web membership is never overwritten by a lapsed store one. The app
  // doesn't sell to somebody who is already a member, but a player who bought
  // in the app once, cancelled, and later joined on the web would otherwise
  // lose the web membership to the store's expiry event.
  const { data: existing } = await admin
    .from('memberships')
    .select('source, status')
    .eq('user_id', userId)
    .maybeSingle()
  if (
    existing?.source === 'stripe' &&
    ENTITLING.includes(existing.status) &&
    !ENTITLING.includes(row.status)
  ) {
    return
  }

  const { error } = await admin.from('memberships').upsert(row, { onConflict: 'user_id' })
  // The account was deleted; the foreign key refuses the row. Nobody left to
  // hold it, and the store keeps billing until they cancel there (the delete
  // flow tells them so). Acknowledged so RevenueCat stops retrying.
  if (error?.code === '23503') return
  if (error) throw error
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 })
  if (req.headers.get('Authorization') !== AUTH)
    return new Response('unauthorised', { status: 401 })

  let event: {
    type?: string
    app_user_id?: string
    original_app_user_id?: string
    aliases?: string[]
  }
  try {
    event = (await req.json()).event ?? {}
  } catch {
    return new Response('bad body', { status: 400 })
  }

  // RevenueCat's dashboard "send test event" button. Nothing to write.
  if (event.type === 'TEST') return Response.json({ received: true })

  // Every id this purchase is known by; the Supabase one is the uuid.
  const ids = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])]
  const userId = ids.find(pipUser)
  if (!userId) {
    console.warn(`event ${event.type} has no Pip user id; not written`)
    return Response.json({ received: true })
  }

  try {
    await sync(userId)
  } catch (err) {
    // A 500 makes RevenueCat retry with backoff, which is what a database or
    // API blip should get.
    console.error(`revenuecat ${event.type} for ${userId} failed:`, err)
    return new Response('failed', { status: 500 })
  }
  return Response.json({ received: true })
})
