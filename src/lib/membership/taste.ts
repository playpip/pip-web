// The daily free game: one member table or one Webb lesson a UTC day, for a
// player who is not a member.
//
// **Why it exists** (2026-10-07). In the first week on sale eleven tabs saw
// `/membership` and none opened checkout. Nobody could try anything paid before
// paying for it, and the most-tapped locked thing on the shelf was Omaha. So a
// non-member gets one member game a day: a seat at one side table, or one
// lesson beyond Level 1.
//
// **Rule 4 used to say "nothing is metered"** and this is a metered thing. Will
// relaxed it for exactly this shape and no other: a whole game, once a day,
// never a slice of one. Rule 2 is untouched: a free game is the same game a
// member plays, and nothing about the hand changes. docs/membership.md has it.
//
// Pure and storage-free. The record lives on the persisted profile (`taste`)
// and the callers pass today's key in, so the tests need no clock.

/** What the day's free game was spent on. */
export type TasteKind = 'table' | 'lesson'

/** The day's free game, once spent. `null` on the profile means never spent. */
export interface TasteRecord {
  /** UTC day key, e.g. "2026-10-07" (`dailyDateKey`). */
  date: string
  kind: TasteKind
  /** The venue id or lesson id it was spent on. */
  id: string
}

/** One thing a free game could be spent on. */
export interface TasteTarget {
  kind: TasteKind
  id: string
}

/**
 * Where a non-member stands today: the free game is still there, or spent.
 *
 * A record from an earlier day is no record: the allowance comes back at
 * midnight UTC, the same clock the Daily runs on.
 */
export function tasteLeft(record: TasteRecord | null | undefined, today: string): boolean {
  return !record || record.date !== today
}

/**
 * Does today's free game open this thing?
 *
 * Yes while it is unspent. Once spent, it still opens the **lesson** it was
 * spent on for the rest of the day: a lesson keeps nothing and a refresh
 * halfway through must not lock the player out of the one they chose. A
 * **table** is never re-opened by this — once you have sat down, the table's
 * own snapshot is what carries you back in after a refresh (`resumeTable` in
 * PlayClient runs before any gate), and a second sit-down is a second game.
 */
export function tasteOpens(
  record: TasteRecord | null | undefined,
  today: string,
  target: TasteTarget,
): boolean {
  if (tasteLeft(record, today)) return true
  return target.kind === 'lesson' && record?.kind === 'lesson' && record.id === target.id
}

/**
 * Spend today's free game on this thing.
 *
 * Returns the record to store, or `null` if today's is already spent on
 * something else. Spending it again on the lesson it was spent on returns the
 * record unchanged, so a refresh is not a second spend.
 */
export function spendTaste(
  record: TasteRecord | null | undefined,
  today: string,
  target: TasteTarget,
): TasteRecord | null {
  if (tasteLeft(record, today)) return { date: today, kind: target.kind, id: target.id }
  return tasteOpens(record, today, target) ? (record ?? null) : null
}

/**
 * Two devices' records, merged for sync.
 *
 * The later day wins, and on the same day the record already there wins —
 * either way a spent game stays spent. Taking "never spent" over "spent today"
 * would make signing in on a second device a way to get another one.
 *
 * Takes `unknown` because a synced row is not this store's output: a malformed
 * record on either side is read as no record rather than trusted.
 */
export function mergeTaste(left: unknown, right: unknown): TasteRecord | null {
  const a = isTasteRecord(left) ? left : null
  const b = isTasteRecord(right) ? right : null
  if (!a) return b
  if (!b) return a
  if (a.date !== b.date) return a.date > b.date ? a : b
  return a
}

/** Is this a well-formed record? A synced row is not this store's output. */
export function isTasteRecord(value: unknown): value is TasteRecord {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    (r.kind === 'table' || r.kind === 'lesson') &&
    typeof r.id === 'string'
  )
}

/** What a gated card says, in each state. One place so the cards agree. */
export const TASTE_COPY = {
  /** The tile line while today's game is unspent. */
  tile: 'Free today',
  /** The button that spends it, where a tap spends it. */
  action: 'Try it free today',
  /** Beside the play button: what the tap is about to do. */
  note: 'One member game a day is free. This is today’s.',
  /** Once spent on something else. */
  used: 'Your free game today is used. Join for every table.',
} as const
