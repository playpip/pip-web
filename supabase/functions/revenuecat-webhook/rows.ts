// What `revenuecat-webhook` decides, without the network or the database.
//
// Plain TypeScript with no Deno or npm: imports, so tests/revenuecatWebhook.test.ts
// can run it under Node. index.ts does the reading and the writing.

/** The entitlement's identifier in RevenueCat, as in mobile/src/purchases.ts. */
export const ENTITLEMENT = 'member'

/** The statuses that make somebody a member — src/lib/membership/entitlement.ts. */
export const ENTITLING: readonly string[] = ['active', 'trialing']

/** The parts of a RevenueCat event this function reads. */
export interface RevenueCatEvent {
  type?: string
  app_user_id?: string
  original_app_user_id?: string
  aliases?: string[]
  /** TRANSFER only, which carries none of the ids above. */
  transferred_from?: string[]
  transferred_to?: string[]
}

interface Subscription {
  store: string
  expires_date: string | null
  unsubscribe_detected_at: string | null
  billing_issues_detected_at: string | null
}

export interface Subscriber {
  entitlements: Record<string, { expires_date: string | null; product_identifier: string }>
  subscriptions: Record<string, Subscription>
}

/** The parts of the existing `memberships` row the write depends on. */
export interface Existing {
  source: string
  status: string
}

/**
 * A Supabase user id. Anything else (RevenueCat's own `$RCAnonymousID:`, a
 * purchase made before sign-in) has nobody to give a membership to, and would
 * fail the uuid column on every retry.
 */
const pipUser = (id: unknown): id is string =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

/**
 * Every Pip account an event is about, each to be synced from RevenueCat.
 *
 * A TRANSFER (Restore purchases on a second Pip account with the same Apple or
 * Google login) names both sides only in `transferred_from` and
 * `transferred_to`, and RevenueCat sends it once, for the receiving side. Both
 * need writing: the receiver is now the member, and the giver's row would
 * otherwise say `active` for good, since no later event is about them.
 */
export function pipUsers(event: RevenueCatEvent): string[] {
  const ids = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
    ...(event.transferred_from ?? []),
    ...(event.transferred_to ?? []),
  ]
  return [...new Set(ids.filter(pipUser).map((id) => id.toLowerCase()))]
}

/**
 * The row this subscriber should have, in the same vocabulary Stripe's status
 * uses, so entitlement.ts reads both the same way. Null when they do not hold
 * the entitlement at all: never bought, or transferred it away.
 */
export function rowFor(userId: string, sub: Subscriber, now: number) {
  const entitlement = sub.entitlements[ENTITLEMENT]
  if (!entitlement) return null
  const product = entitlement.product_identifier
  const subscription = sub.subscriptions[product]
  const expires = entitlement.expires_date ? Date.parse(entitlement.expires_date) : null
  const live = expires === null || expires > now

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
    updated_at: new Date(now).toISOString(),
  }
}

export type Write =
  | { kind: 'upsert'; row: NonNullable<ReturnType<typeof rowFor>> }
  /** A live store row whose subscriber no longer holds the entitlement. */
  | { kind: 'lapse'; status: 'canceled'; cancel_at_period_end: false; updated_at: string }
  | { kind: 'none' }

/** What to do to the row, given what RevenueCat says now and what is stored. */
export function decide(
  row: ReturnType<typeof rowFor>,
  existing: Existing | null,
  now: number,
): Write {
  if (!row) {
    // Nothing in the store. Only a store row that still entitles needs ending;
    // a Stripe row is Stripe's, and no row means nobody to tell.
    if (existing && existing.source !== 'stripe' && ENTITLING.includes(existing.status)) {
      return {
        kind: 'lapse',
        status: 'canceled',
        cancel_at_period_end: false,
        updated_at: new Date(now).toISOString(),
      }
    }
    return { kind: 'none' }
  }

  // A live web membership is never overwritten by a lapsed store one. The app
  // doesn't sell to somebody who is already a member, but a player who bought
  // in the app once, cancelled, and later joined on the web would otherwise
  // lose the web membership to the store's expiry event.
  if (
    existing?.source === 'stripe' &&
    ENTITLING.includes(existing.status) &&
    !ENTITLING.includes(row.status)
  ) {
    return { kind: 'none' }
  }

  return { kind: 'upsert', row }
}
