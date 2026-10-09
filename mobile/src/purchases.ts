// The membership bought in the app, through the App Store and Google Play
// (EXPO-PLAN.md, phase 2). RevenueCat handles both stores.
//
// The Supabase user id is RevenueCat's app user id, so a purchase belongs to
// the Pip account that made it. RevenueCat tells the `revenuecat-webhook`
// function, which writes the same `memberships` row the Stripe webhook writes,
// and the web app reads that row as it always has. Nothing here decides who is
// a member; it only reports what the store said so the page can stop waiting.

import { Platform } from 'react-native'
import Purchases, { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases'

export type Plan = 'monthly' | 'annual'

/** The entitlement's identifier in RevenueCat. */
const ENTITLEMENT = 'member'

const KEY =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY

export const purchasesConfigured = Boolean(KEY)

let configured = false

/** Configured on first use, as the signed-in player. */
async function as(userId?: string) {
  if (!KEY) throw new Error('Purchases are not set up in this build.')
  if (!configured) {
    Purchases.configure({ apiKey: KEY, appUserID: userId ?? null })
    configured = true
  } else if (userId) {
    await Purchases.logIn(userId)
  }
}

async function packages(): Promise<Record<Plan, PurchasesPackage | undefined>> {
  const offering = (await Purchases.getOfferings()).current
  const find = (type: PACKAGE_TYPE) =>
    offering?.availablePackages.find((p) => p.packageType === type)
  return { monthly: find(PACKAGE_TYPE.MONTHLY), annual: find(PACKAGE_TYPE.ANNUAL) }
}

/** The store's own prices, in the player's currency, for the page to show. */
export async function products() {
  await as()
  const { monthly, annual } = await packages()
  return {
    ok: true,
    monthly: monthly?.product.priceString ?? null,
    annual: annual?.product.priceString ?? null,
  }
}

export async function purchase(plan: Plan, userId: string) {
  await as(userId)
  const pkg = (await packages())[plan]
  if (!pkg) return { ok: false, error: 'That plan isn’t available in the store right now.' }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg)
    return { ok: true, member: Boolean(customerInfo.entitlements.active[ENTITLEMENT]) }
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) return { ok: false, cancelled: true }
    throw err
  }
}

/** Apple requires a Restore Purchases button; this is what it calls. */
export async function restore(userId: string) {
  await as(userId)
  const info = await Purchases.restorePurchases()
  return { ok: true, member: Boolean(info.entitlements.active[ENTITLEMENT]) }
}
