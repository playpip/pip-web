// What counts as a member, decided in one place.
//
// Pure and storage-free: the store above this does the reading, the writing and
// the network, and hands the row in. Everything about *whether* a row entitles
// somebody is here, so there is one answer rather than one per call site.
//
// **This is a UX affordance, not a lock, and that is an accepted position
// rather than a discovered one.** Every drill and every read runs in the
// browser out of an engine whose source we publish, so anyone who wants the
// paid features without paying can fork the repo. That is the deal we already
// took by being open source. What this has to be is honest enough that a normal
// player is never wrongly locked out or wrongly let in, and no stronger. The
// moment a paid feature costs us money per use (a model call, say), the check
// moves server-side and this paragraph is void.
//
// What it must never become is a flag on the profile. `profiles` is written by
// the client under an `own row only` policy, so `member: true` in the profile
// blob would be settable by editing localStorage. See the migration.

/** The `memberships` row, as this app is allowed to see it. */
export interface MembershipRow {
  user_id: string
  /** Stripe's own subscription.status, raw. */
  status: string
  /** ISO timestamp, or null before the first invoice settles. */
  current_period_end: string | null
  cancel_at_period_end: boolean
}

/**
 * The Stripe statuses that mean the membership is live right now.
 *
 * `past_due` is deliberately absent. Stripe retries a failed renewal for days
 * with the subscription in that state, and the period it was paid for has
 * ended, so keeping it entitled would be giving away the retry window. It is
 * still a different thing from `canceled` and the row says which, which is why
 * the status is stored raw rather than as a boolean.
 */
const ENTITLING: readonly string[] = ['active', 'trialing']

/** What the app knows about this player's membership. */
export interface Entitlement {
  member: boolean
  /** The raw Stripe status, so a later Settings row can tell the reasons apart. */
  status: string | null
  /** When the paid period ends, as epoch ms. Null when there is no row. */
  periodEnd: number | null
  /** Set when they have cancelled and are playing out the period they paid for. */
  cancelAtPeriodEnd: boolean
}

/** Nobody: signed out, no row, or a row that does not entitle. */
export const NOT_A_MEMBER: Entitlement = {
  member: false,
  status: null,
  periodEnd: null,
  cancelAtPeriodEnd: false,
}

/**
 * Read a row.
 *
 * `trusted` is the difference between a row that came back from the server this
 * session and one that came out of this device's cache:
 *
 * - **From the server**, the status decides. It was written by the webhook and
 *   it is as current as anything can be.
 * - **From the cache**, the status decides *and* the period it was paid for has
 *   to still be running. That is what lets a member on a plane stay a member
 *   without letting a cached row entitle somebody forever. A cached row with no
 *   period end cannot be checked against anything, so it does not entitle.
 *
 * The cache is forgeable, like everything else on this side of the wire. See
 * the note at the top of the file: this is here so a member is not locked out
 * of what they paid for by a dropped connection, not to stop anyone.
 */
export function readEntitlement(
  row: MembershipRow | null,
  opts: { now: number; trusted: boolean },
): Entitlement {
  if (!row) return NOT_A_MEMBER

  const periodEnd = row.current_period_end ? Date.parse(row.current_period_end) : null
  const dated = periodEnd !== null && Number.isFinite(periodEnd)
  const entitling = ENTITLING.includes(row.status)
  const member = opts.trusted ? entitling : entitling && dated && periodEnd > opts.now

  return {
    member,
    status: row.status,
    periodEnd: dated ? periodEnd : null,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  }
}

/** What this device remembers, so a member offline is still a member. */
export interface CachedMembership {
  /** Whose row this is. A second account on the same device inherits nothing. */
  userId: string
  row: MembershipRow
}

/**
 * Parse a cached blob, or nothing.
 *
 * Anything unrecognised is nothing rather than a throw: this runs on boot, and
 * a stale or hand-edited cache must not be able to stop the app starting.
 */
export function parseCache(raw: string | null, userId: string): MembershipRow | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CachedMembership>
    const row = parsed.row
    if (parsed.userId !== userId || !row || typeof row.status !== 'string') return null
    return {
      user_id: userId,
      status: row.status,
      current_period_end:
        typeof row.current_period_end === 'string' ? row.current_period_end : null,
      cancel_at_period_end: row.cancel_at_period_end === true,
    }
  } catch {
    return null
  }
}
