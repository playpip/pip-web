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
import { decide, pipUsers, type RevenueCatEvent, rowFor, type Subscriber } from './rows.ts'

const AUTH = env('REVENUECAT_WEBHOOK_AUTH')
const SECRET_KEY = env('REVENUECAT_SECRET_KEY')

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

async function sync(userId: string): Promise<void> {
  const now = Date.now()
  const row = rowFor(userId, await subscriber(userId), now)
  const { data: existing } = await admin
    .from('memberships')
    .select('source, status')
    .eq('user_id', userId)
    .maybeSingle()

  const write = decide(row, existing, now)
  if (write.kind === 'none') return
  if (write.kind === 'lapse') {
    const { status, cancel_at_period_end, updated_at } = write
    const { error } = await admin
      .from('memberships')
      .update({ status, cancel_at_period_end, updated_at })
      .eq('user_id', userId)
    if (error) throw error
    return
  }

  const { error } = await admin.from('memberships').upsert(write.row, { onConflict: 'user_id' })
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

  let event: RevenueCatEvent
  try {
    event = (await req.json()).event ?? {}
  } catch {
    return new Response('bad body', { status: 400 })
  }

  // RevenueCat's dashboard "send test event" button. Nothing to write.
  if (event.type === 'TEST') return Response.json({ received: true })

  // Every Pip account the event names, both sides of a transfer included.
  const userIds = pipUsers(event)
  if (userIds.length === 0) {
    console.warn(`event ${event.type} has no Pip user id; not written`)
    return Response.json({ received: true })
  }

  for (const userId of userIds) {
    try {
      await sync(userId)
    } catch (err) {
      // A 500 makes RevenueCat retry with backoff, which is what a database or
      // API blip should get. A retry re-syncs every id, which is harmless:
      // each write is what RevenueCat says now.
      console.error(`revenuecat ${event.type} for ${userId} failed:`, err)
      return new Response('failed', { status: 500 })
    }
  }
  return Response.json({ received: true })
})
