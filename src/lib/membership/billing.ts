// The client's half of paying: ask an Edge Function for a Stripe URL, then go
// there. That is all it does.
//
// **Nothing here decides who is a member.** Checkout returning, the success URL
// loading, a `?joined=1` in the address bar — none of it grants anything. The
// webhook writes the row when Stripe says the money arrived, and
// `store/entitlement.ts` reads it. This file only opens doors.
//
// No Stripe library on the client, and no publishable key: the hosted Checkout
// and portal pages are Stripe's, and a redirect needs neither.

'use client'

import { type CurrencyCode, TERMS_VERSION } from '@/config/membership'
import { getSupabase } from '@/lib/sync/client'
import { useMembership } from '@/store/entitlement'

export type BillingError =
  | 'signed-out'
  | 'already-a-member'
  | 'no-membership'
  | 'consent'
  | 'unavailable'

type Result = { ok: true } | { ok: false; error: BillingError }

/** Call one billing function and follow the `url` it hands back. */
async function go(name: 'checkout' | 'portal', body: object = {}): Promise<Result> {
  const sb = await getSupabase()
  if (!sb) return { ok: false, error: 'unavailable' }
  const { data: session } = await sb.auth.getSession()
  if (!session.session) return { ok: false, error: 'signed-out' }

  const { data, error } = await sb.functions.invoke<{ url?: string; error?: string }>(name, {
    body,
  })
  if (error) {
    // A non-2xx arrives as an error whose `context` is the Response. Read the
    // function's own reason from it, so "you are already a member" is not
    // reported as "something went wrong".
    const reason = await (error as { context?: Response }).context
      ?.json()
      .then((b: { error?: string }) => b.error)
      .catch(() => undefined)
    if (
      reason === 'already-a-member' ||
      reason === 'no-membership' ||
      reason === 'signed-out' ||
      reason === 'consent'
    ) {
      return { ok: false, error: reason }
    }
    return { ok: false, error: 'unavailable' }
  }
  if (!data?.url) return { ok: false, error: 'unavailable' }

  window.location.assign(data.url)
  return { ok: true }
}

/**
 * Off to Stripe Checkout, in the currency the player was looking at.
 *
 * `startNow` is the ticked box on /membership. It is sent rather than assumed so
 * the function can refuse without it: /terms says the player is asked to confirm
 * the membership starts straight away, and this is where they were asked.
 */
export function startCheckout(
  priceId: string,
  currency: CurrencyCode,
  startNow: boolean,
): Promise<Result> {
  return go('checkout', { priceId, currency, startNow, termsVersion: TERMS_VERSION })
}

/** Off to the Stripe customer portal: cancel, change card, invoices. */
export function openPortal(): Promise<Result> {
  return go('portal')
}

/**
 * Back from Checkout: wait for the webhook to land.
 *
 * Stripe redirects the player and fires the webhook at roughly the same moment,
 * and the redirect usually wins. So the row is re-read a few times over about
 * fifteen seconds rather than once, and the page shows "confirming" until it
 * arrives rather than telling a player who just paid that they are not a member.
 */
export async function awaitMembership(): Promise<boolean> {
  const { refresh } = useMembership.getState()
  for (const wait of [0, 1000, 1500, 2000, 3000, 4000, 4000]) {
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait))
    await refresh()
    if (useMembership.getState().member) return true
  }
  return false
}
