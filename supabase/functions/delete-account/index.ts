// Delete the caller's account, cancelling any subscription first.
//
// POST with the player's access token → { deleted: true }.
//
// **This is the gap docs/membership.md said had to close before anything took a
// payment.** `delete_own_account()` removes the auth user and the cascade takes
// the membership row with it — but the Stripe subscription lives in Stripe, and
// nothing there hears about the delete. A player could erase their account and
// go on being billed for a membership with nobody attached to it.
//
// So the order is fixed and it matters: cancel in Stripe, *then* delete. If the
// cancel fails the account is left exactly as it was and the player is told to
// try again, because an account that still exists can be retried and a billed
// stranger cannot.
//
// The cancel is immediate, not at period end — there is no account left to
// play out the period in. The Stripe customer and its invoices are kept: they
// are the tax record of a sale, which we are required to keep (see /privacy).

import { CORS, admin, caller, isPip, json, membershipOf, stripe } from '../_shared/billing.ts'

/** Statuses Stripe will still bill, or could start billing again. */
const BILLABLE = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const user = await caller(req)
  if (!user) return json({ error: 'signed-out' }, 401)

  try {
    const row = await membershipOf(user.id)
    if (row?.stripe_customer_id) {
      // Every Pip subscription on the customer, not just the one in the row:
      // the row holds the latest, and an older one left running would still
      // bill. Only Pip's — the Stripe account is shared with other Ava
      // projects, and deleting a Pip account must never cancel one of theirs.
      for await (const sub of stripe.subscriptions.list({
        customer: row.stripe_customer_id,
        status: 'all',
      })) {
        if (isPip(sub.metadata) && BILLABLE.has(sub.status))
          await stripe.subscriptions.cancel(sub.id)
      }
    }
  } catch (err) {
    console.error(`delete-account: cancelling for ${user.id} failed:`, err)
    return json({ error: 'cancel-failed' }, 502)
  }

  // The same delete `delete_own_account()` does, done here with the admin API
  // because this function already holds the service role. `on delete cascade`
  // takes `profiles` and `memberships` with it.
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error(`delete-account: deleting ${user.id} failed:`, error)
    return json({ error: 'delete-failed' }, 502)
  }
  return json({ deleted: true })
})
