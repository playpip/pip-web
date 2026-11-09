// Pushes that are not about a slow game: somebody passing you on the Pip
// Rating board, and your streak about to end (Will, 2026-11-09: "as many for
// retention").
//
// Pure: the player's index (`rooms/src/player.ts`) holds the prefs, the
// devices and the clock, and asks these functions what is due and what to say.
// The rules:
//
// - **Passed on the board:** `submit-rating` notes everyone a submission
//   climbed past; at most one of these every twelve hours, and the newest wins.
// - **Streak:** checked once a day, in the evening UTC (the streak's day is a
//   UTC day), at the latest of a few times outside your quiet hours. Played
//   yesterday and not yet today: it ends at midnight. Missed yesterday after
//   two days or more: it has ended, said once.
// - Every one of them waits out your quiet hours, like a slow game's.

import { daysBetween, streakAtRisk, type PlayStreak } from '@/lib/streak'
import { awake, type PlayPrefs } from './notices'

const H = 60 * 60 * 1000

/** At most one "passed you" push in this long. */
export const RATING_GAP_MS = 12 * H

/**
 * When in the UTC day the streak is checked, latest first. The latest one
 * outside your quiet hours is used, so whoever is awake at 20:00 UTC hears
 * with four hours to go, and someone whose night that is hears earlier.
 */
export const STREAK_HOURS_UTC = [20, 18, 16, 13] as const

export interface PushCopy {
  title: string
  body: string
}

/** The UTC day key of `t`. */
export function utcDayKey(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

/** The UTC midnight after `t`. */
export function nextUtcMidnight(t: number): number {
  return Date.parse(`${utcDayKey(t)}T00:00:00Z`) + 24 * H
}

/** Whether nothing may be sent at `t`. */
function quietAt(t: number, prefs: PlayPrefs): boolean {
  return awake(t, prefs) !== t
}

/**
 * The next streak check after `now`: today's if one of its times is still to
 * come and outside the quiet hours, else tomorrow's, else (a player quiet
 * through all of them) tomorrow's latest, which then waits for them to wake.
 */
export function nextStreakCheck(now: number, prefs: PlayPrefs): number {
  const midnight = Date.parse(`${utcDayKey(now)}T00:00:00Z`)
  for (const day of [0, 1]) {
    const base = midnight + day * 24 * H
    for (const hour of STREAK_HOURS_UTC) {
      const t = base + hour * H
      if (t > now && !quietAt(t, prefs)) return t
    }
  }
  return midnight + 24 * H + STREAK_HOURS_UTC[0] * H
}

/** `state.streak` from a synced profile, or null when it has none worth reading. */
export function readPlayStreak(state: unknown): PlayStreak | null {
  if (typeof state !== 'object' || state === null) return null
  const s = (state as { streak?: unknown }).streak
  if (typeof s !== 'object' || s === null) return null
  const { current, best, lastDate } = s as Record<string, unknown>
  if (typeof current !== 'number' || !Number.isFinite(current) || current < 0) return null
  if (typeof lastDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) return null
  return {
    current: Math.floor(current),
    best: typeof best === 'number' && Number.isFinite(best) ? Math.floor(best) : 0,
    lastDate,
  }
}

const days = (n: number) => (n === 1 ? '1 day' : `${n} days`)

/** What the streak calls for at `now`, or null for nothing. */
export function streakCopy(streak: PlayStreak | null, now: number): PushCopy | null {
  if (!streak?.lastDate) return null
  const today = utcDayKey(now)
  const gap = daysBetween(streak.lastDate, today)
  if (streakAtRisk(streak, today)) {
    const left = Math.max(1, Math.ceil((nextUtcMidnight(now) - now) / H))
    const hours = left === 1 ? '1 hour' : `${left} hours`
    return streak.current === 1
      ? { title: 'Keep your streak going', body: 'Play a hand today to make it 2 days.' }
      : {
          title: `Your ${streak.current}-day streak ends in ${hours}`,
          body: 'Play a hand to keep it.',
        }
  }
  if (gap === 2 && streak.current >= 2) {
    return {
      title: `Your streak ended at ${days(streak.current)}`,
      body: 'Play a hand today to start a new one.',
    }
  }
  return null
}

/** Somebody climbed past you on the board. `rank` is where that leaves you. */
export function passedCopy(name: string, rank: number | null): PushCopy {
  return {
    title: `${name} passed you on the Pip Rating`,
    body: rank ? `You’re #${rank} on the board now.` : 'See where you are on the board.',
  }
}

/** Whether a "passed you" push may go at `now`, given when the last one did. */
export function ratingPushAllowed(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= RATING_GAP_MS
}
