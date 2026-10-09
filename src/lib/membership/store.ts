// The membership bought in the store app: the App Store and Google Play, via
// the native shell (mobile/src/purchases.ts). The twin of billing.ts, which is
// Stripe on the web.
//
// **Nothing here decides who is a member either.** The store tells RevenueCat,
// RevenueCat tells `revenuecat-webhook`, and that writes the same row Stripe's
// webhook writes. This only asks the shell to open the store's sheet, then
// waits for the row like a returning Stripe checkout does.

'use client'

import { useEffect, useState } from 'react'
import { trackOnce } from '@/lib/analytics'
import { askApp } from '@/lib/nativeApp'
import { getSupabase } from '@/lib/sync/client'
import { useMembership } from '@/store/entitlement'
import { awaitMembership } from './billing'

export type StorePlan = 'monthly' | 'annual'

/** Where a membership was bought (the `source` column). */
export type MembershipSource = 'stripe' | 'app_store' | 'play_store'

/** The store's own page for managing (and cancelling) a subscription. */
export const MANAGE_IN_STORE: Partial<Record<MembershipSource, { label: string; href: string }>> = {
  app_store: {
    label: 'Manage in the App Store',
    href: 'https://apps.apple.com/account/subscriptions',
  },
  play_store: {
    label: 'Manage in Google Play',
    href: 'https://play.google.com/store/account/subscriptions',
  },
}

type Answer = { ok: true; member?: boolean } | { ok: false; cancelled?: true; error?: string }

export type StoreResult =
  | { ok: true; member: boolean }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }

async function userId(): Promise<string | null> {
  const sb = await getSupabase()
  const { data } = (await sb?.auth.getSession()) ?? { data: null }
  return data?.session?.user.id ?? null
}

function settle(answer: Answer): StoreResult | null {
  if (answer.ok) return null
  if (answer.cancelled) return { ok: false, cancelled: true }
  return { ok: false, error: answer.error ?? 'The store didn’t answer.' }
}

/**
 * Buy a plan through the store, then wait for the row. The membership is only
 * real once the webhook has written it, so `member` here is the row's answer,
 * not the store's.
 */
export async function buyInStore(plan: StorePlan): Promise<StoreResult> {
  const id = await userId()
  if (!id) return { ok: false, error: 'Sign in first, so the membership is yours.' }
  // The same funnel steps as a Stripe checkout (docs/membership.md), so a sale
  // in the app is not invisible to it: the store's sheet opening, the store
  // taking the payment, and the row arriving.
  trackOnce('checkout-opened')
  const failed = settle(await askApp<Answer>({ type: 'purchase', plan, userId: id }))
  if (failed) return failed
  trackOnce('checkout-completed')
  const member = await awaitMembership()
  if (member) trackOnce('membership-active')
  return { ok: true, member }
}

/** Apple requires a Restore Purchases button. */
export async function restoreFromStore(): Promise<StoreResult> {
  const id = await userId()
  if (!id) return { ok: false, error: 'Sign in first, so there is an account to restore to.' }
  const answer = await askApp<Answer>({ type: 'restore', userId: id })
  const failed = settle(answer)
  if (failed) return failed
  if (!(answer.ok && answer.member)) return { ok: true, member: false }
  if (await awaitMembership()) return { ok: true, member: true }
  // The store found one, but the row has not arrived yet. Saying there was
  // nothing to restore would be wrong.
  return { ok: false, error: 'The store found your membership. It can take a minute to show here.' }
}

/** The store's prices, in the player's currency. Null until they arrive. */
export function useStorePrices(enabled: boolean): Record<StorePlan, string | null> | null {
  const [prices, setPrices] = useState<Record<StorePlan, string | null> | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    void askApp<{ ok: boolean; monthly?: string | null; annual?: string | null }>({
      type: 'products',
    }).then((answer) => {
      if (live && answer.ok)
        setPrices({ monthly: answer.monthly ?? null, annual: answer.annual ?? null })
    })
    return () => {
      live = false
    }
  }, [enabled])
  return prices
}

/**
 * Where this player's membership was bought, so the app can send them to the
 * right place to manage it. Null when there is no membership, or on a database
 * from before the `source` column (the entitlement store reads it, and reads
 * around it when it is missing).
 */
export function useMembershipSource(): MembershipSource | null {
  return useMembership((s) => s.source as MembershipSource | null)
}
