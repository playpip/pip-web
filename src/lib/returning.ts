// Whether players come back: of the devices that played a hand in one week,
// how many play again the next. Nothing counted it before November 2026.
//
// The device keeps one number, the last UTC week (Monday to Sunday) it played
// a hand in. On the first hand of a tab it compares that with this week and
// sends at most two event names: `played-this-week` the first time in a week,
// and `played-again-next-week` when the last week played was the one before.
// The rate for a week is its `played-again-next-week` over the previous week's
// `played-this-week`. It counts devices, not people: a new phone or cleared
// storage reads as a new player, so it can only understate returns.
//
// No id, no date and no number leaves the device; the privacy page says so.

import { track } from '@/lib/analytics'

const KEY = 'pip.playedWeek'
const DAY_MS = 86_400_000

/**
 * Whole UTC weeks, Monday to Sunday, since the Monday before the epoch
 * (1 January 1970 was a Thursday, hence the three days).
 */
export function weekIndex(ms: number): number {
  return Math.floor((Math.floor(ms / DAY_MS) + 3) / 7)
}

interface WeekVisit {
  /** First hand on this device this week. */
  firstThisWeek: boolean
  /** ...and the last week it played was last week. */
  again: boolean
  /** The week to keep. */
  keep: number
}

/**
 * What a first hand in `thisWeek` means, given the last week played. A stored
 * week after this one (a clock set back) sends nothing and keeps the later
 * week, so winding the clock back and forth cannot count twice.
 */
export function weekVisit(lastWeek: number | null, thisWeek: number): WeekVisit {
  if (lastWeek !== null && lastWeek >= thisWeek) {
    return { firstThisWeek: false, again: false, keep: lastWeek }
  }
  return { firstThisWeek: true, again: lastWeek === thisWeek - 1, keep: thisWeek }
}

/** Called beside the `first-hand` count. Fire-and-forget, like analytics. */
export function notePlayedThisWeek(now: number = Date.now()): void {
  if (typeof window === 'undefined') return
  let visit: WeekVisit
  try {
    const stored = localStorage.getItem(KEY)
    const last = stored === null ? null : Number.parseInt(stored, 10)
    visit = weekVisit(Number.isFinite(last) ? last : null, weekIndex(now))
    localStorage.setItem(KEY, String(visit.keep))
  } catch {
    // No storage (private mode): every week would look like a first, so send nothing.
    return
  }
  if (visit.firstThisWeek) track('played-this-week')
  if (visit.again) track('played-again-next-week')
}
