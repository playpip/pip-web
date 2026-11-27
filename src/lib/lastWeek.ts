// "Last week: 312 hands over 4 days." One quiet line on Home for a player who
// played last week (components/menu/LastWeekLine). A reason to come back that
// sits on a screen the player already opens: no tap target, no pop-up, gone
// when the week turns, and nothing at all for a week with no hands.
//
// The device keeps its own tally of hands dealt and days played, in UTC weeks
// (Monday to Sunday, the same weeks as the return count in lib/returning). A
// hand counts where the return count counts one: a ladder or single-player
// hand dealt to the player, and a room hand they are dealt into. A table the
// player is only watching counts nothing.
//
// Hands and days only. How the rating moved is rating history, a member
// feature (docs/rating.md). Nothing here leaves the device.

import { weekIndex } from '@/lib/returning'

const KEY = 'pip.weekTally'
const DAY_MS = 86_400_000

/**
 * The line shows from Monday 7 December 2026, so the week before it and the
 * week after are both clean weeks to read the return count against. The tally
 * starts counting as soon as it ships, so last week is already there that day.
 */
export const SHOWS_FROM = Date.UTC(2026, 11, 7)

/** Hands and days in one week. `days` is a bitmask, Monday = bit 0. */
export interface WeekCount {
  hands: number
  days: number
}

/** The stored tally: this week (`week`) and the one before it, if played. */
export interface WeekTally extends WeekCount {
  week: number
  last: WeekCount | null
}

/** Day of the UTC week, Monday = 0 (1 January 1970 was a Thursday). */
function dayOfWeek(ms: number): number {
  return (Math.floor(ms / DAY_MS) + 3) % 7
}

/**
 * The tally after one more hand at `now`. A new week rolls this week into
 * `last` only if it was the week before; anything older is forgotten. A stored
 * week after this one (a clock set back) is left alone.
 */
export function addHand(tally: WeekTally | null, now: number): WeekTally {
  const week = weekIndex(now)
  const bit = 1 << dayOfWeek(now)
  if (tally && tally.week > week) return tally
  if (tally && tally.week === week) {
    return { ...tally, hands: tally.hands + 1, days: tally.days | bit }
  }
  const last =
    tally && tally.week === week - 1 && tally.hands > 0
      ? { hands: tally.hands, days: tally.days }
      : null
  return { week, hands: 1, days: bit, last }
}

/** Last week's count as of `now`, or null if the device did not play last week. */
export function lastWeekOf(tally: WeekTally | null, now: number): WeekCount | null {
  if (!tally) return null
  const week = weekIndex(now)
  if (tally.week === week) return tally.last
  if (tally.week === week - 1 && tally.hands > 0) return { hands: tally.hands, days: tally.days }
  return null
}

function countDays(mask: number): number {
  let n = 0
  for (let m = mask; m; m >>= 1) n += m & 1
  return n
}

const plural = (n: number, word: string) =>
  `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`

/** The words, or null for no line: before launch, or no hands last week. */
export function lastWeekLine(tally: WeekTally | null, now: number): string | null {
  if (now < SHOWS_FROM) return null
  const last = lastWeekOf(tally, now)
  if (!last || last.hands <= 0) return null
  return `Last week: ${plural(last.hands, 'hand')} over ${plural(countDays(last.days), 'day')}.`
}

function parse(raw: string | null): WeekTally | null {
  if (!raw) return null
  try {
    const t = JSON.parse(raw) as WeekTally
    if (!Number.isInteger(t?.week) || !Number.isInteger(t.hands) || !Number.isInteger(t.days)) {
      return null
    }
    const last =
      t.last && Number.isInteger(t.last.hands) && Number.isInteger(t.last.days)
        ? { hands: t.last.hands, days: t.last.days }
        : null
    return { week: t.week, hands: t.hands, days: t.days, last }
  } catch {
    return null
  }
}

/** Read the stored tally. Null without storage or with nothing kept. */
export function readTally(): WeekTally | null {
  if (typeof window === 'undefined') return null
  try {
    return parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

/** Count one hand. Called beside `notePlayedThisWeek`, on every hand rather than once a week. */
export function noteHandThisWeek(now: number = Date.now()): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(addHand(parse(localStorage.getItem(KEY)), now)))
  } catch {
    // No storage (private mode): no tally, so no line.
  }
}
