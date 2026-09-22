/**
 * The session log: one row per finished tournament.
 *
 * **Why this exists.** Everything else the profile keeps is a running total.
 * `tendencies` is seven integers that only grow, `stats` is six more, and the
 * one thing carrying a timestamp is `rollHistory`, which is a bankroll graph
 * and says nothing about how anybody played. So the product can say what a
 * player does, and cannot say whether it is what they used to do. Every
 * cross-session claim the membership was pitched on (technology#56) needs a
 * second sample to compare against, and until this file there was nowhere to
 * put one.
 *
 * **It records, it does not report.** Nothing reads this yet on purpose. A
 * player's history only starts on the day the recorder ships, so the recorder
 * goes first and the surface follows; shipped the other way round, the surface
 * arrives to an empty log and stays empty for as long as it takes somebody to
 * play. `/stats` and the recap are unchanged.
 *
 * **What a row is.** Exactly what `buildRecap` already receives for the run it
 * is summarising, narrowed to the parts that are facts about the run rather
 * than comparisons with the career. No hole cards, no hand history, no
 * decisions: a range chart would need the first and coaching across hands would
 * need the last, and neither is honest here (see the spec).
 *
 * **The clock, which is the thing to be careful about.** `t` is passed in, and
 * nothing in this file reads a clock: `tests/sessions.test.ts` fails the build
 * on a `Date` under `lib/sessions`. That is the same guard the drills layer
 * carries, and this is the first module in the product that has a timestamp to
 * be tempted by. `t` exists to order rows and to group them. It is never
 * compared against now, because the moment it is, the product can tell a player
 * they have not played since Tuesday, and that is the thing we said we would
 * never build.
 *
 * **Merging two devices.** Sessions are append-only facts about the past, so
 * they union rather than following a side, keyed on `t` (see `mergeSessions`).
 * Taking the winning side's log, which is what the merge policy's fallback
 * would do, silently throws away everything the other device played.
 */

import type { SeatStats } from '@/lib/reads'

/**
 * One finished tournament.
 *
 * Nine numbers and two strings. At the cap below that is a few tens of
 * kilobytes in the synced profile blob, against the 300 `rollHistory` points
 * and 25 cast records already in it.
 */
export interface SessionRow {
  /** Epoch ms at the moment the run ended. Used to order and to group. */
  t: number
  venueId: string
  /** Finishing position, 1 = won it. */
  place: number
  /** Seats the tournament started with. */
  seats: number
  /** Hands dealt before it ended. */
  hands: number
  /** Roll change across the run: prize and bounties in, buy-in out. */
  rollDelta: number
  /** The hero's tendencies for this run alone. */
  stats: SeatStats
}

/**
 * How many rows are kept, matching `ROLL_HISTORY_CAP`.
 *
 * The same number for the same reason: a profile that grows without bound is
 * eventually a sync payload nobody can push. Oldest rows age out of the front,
 * which is the right end to lose, because the comparison this log exists for is
 * recent play against the rest and "the rest" degrades gracefully.
 */
export const SESSION_CAP = 300

/** Oldest first, and only the last `SESSION_CAP` of them. */
const capped = (rows: SessionRow[]): SessionRow[] =>
  rows.sort((a, b) => a.t - b.t).slice(-SESSION_CAP)

/** Add a finished run to the log. */
export function appendSession(log: SessionRow[] | undefined, row: SessionRow): SessionRow[] {
  return capped([...(log ?? []), row])
}

/**
 * Union two devices' logs.
 *
 * `t` is the key. Two runs cannot finish on the same device in the same
 * millisecond, and a collision across devices is two different runs, so a
 * collision keeps the first row seen rather than merging them: dropping one
 * real session is a smaller wrong than inventing a row that is half of each.
 * Local is read first so a device prefers its own record of a moment.
 */
export function mergeSessions(
  local: SessionRow[] | undefined,
  remote: SessionRow[] | undefined,
): SessionRow[] {
  const byTime = new Map<number, SessionRow>()
  for (const row of [...(local ?? []), ...(remote ?? [])]) {
    if (!byTime.has(row.t)) byTime.set(row.t, row)
  }
  return capped([...byTime.values()])
}
