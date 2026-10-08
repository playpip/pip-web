// The streak — consecutive UTC days on which the player played poker.
//
// Pure: every function takes the day key it is asked about rather than reading
// the clock, so the tests can stand on any midnight they like. "Played" means a
// hand finished at any table (store/profile `mergeStats`), or sitting down at
// the Daily.
//
// The stored `current` is the run as of `lastDate`. Whether it is still alive
// is a question about today, so it is answered by `liveStreak` rather than by
// rewriting the profile at midnight.

/** The persisted streak. `lastDate` is a UTC day key, e.g. "2026-10-07". */
export interface PlayStreak {
  current: number
  best: number
  lastDate: string | null
}

export const emptyStreak = (): PlayStreak => ({ current: 0, best: 0, lastDate: null })

const DAY_MS = 86_400_000

/** Whole UTC days since the epoch for a day key. */
function dayIndex(dateKey: string): number {
  return Math.round(
    Date.UTC(
      Number(dateKey.slice(0, 4)),
      Number(dateKey.slice(5, 7)) - 1,
      Number(dateKey.slice(8, 10)),
    ) / DAY_MS,
  )
}

/** Days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: string, b: string): number {
  return dayIndex(b) - dayIndex(a)
}

/**
 * Count a Daily played on `dateKey`.
 *
 * Same day again is a no-op (the lock should stop it, but a resumed table or a
 * second tab must not count twice). The day after `lastDate` extends the run;
 * any gap starts a new one at 1. A date before `lastDate` (a clock set back)
 * changes nothing rather than wiping a real streak.
 */
export function recordPlay(streak: PlayStreak, dateKey: string): PlayStreak {
  if (streak.lastDate === null) {
    return { current: 1, best: Math.max(streak.best, 1), lastDate: dateKey }
  }
  const gap = daysBetween(streak.lastDate, dateKey)
  if (gap <= 0) return streak
  const current = gap === 1 ? streak.current + 1 : 1
  return { current, best: Math.max(streak.best, current), lastDate: dateKey }
}

/** The run as it stands on `today`: alive if the last play was today or yesterday. */
export function liveStreak(streak: PlayStreak, today: string): number {
  if (streak.lastDate === null) return 0
  const gap = daysBetween(streak.lastDate, today)
  return gap === 0 || gap === 1 ? streak.current : 0
}

/** Yesterday was played and today is not yet: the run ends at midnight unless played. */
export function streakAtRisk(streak: PlayStreak, today: string): boolean {
  return streak.lastDate !== null && streak.current > 0 && daysBetween(streak.lastDate, today) === 1
}

/**
 * The streak a profile from before v23 starts with.
 *
 * Only the last Daily was ever kept, so the most that is known is that one day
 * was played. That counts as a run of one, which means a player who played
 * yesterday on the old build carries on to two today rather than starting over.
 */
export function streakFromDaily(daily: { date: string } | null | undefined): PlayStreak {
  return daily ? { current: 1, best: 1, lastDate: daily.date } : emptyStreak()
}

/**
 * Two devices' streaks, combined without losing a run.
 *
 * Each side knows a run of days ending on its `lastDate`. Where the two runs
 * touch or overlap they are one run, so the merged length spans from the
 * earlier start to the later end. Where they do not, the later one is the
 * current run. `best` is the most either side ever saw, or the merged run if
 * that is longer.
 */
export function mergeStreaks(a: PlayStreak, b: PlayStreak): PlayStreak {
  if (a.lastDate === null) return { ...b, best: Math.max(a.best, b.best) }
  if (b.lastDate === null) return { ...a, best: Math.max(a.best, b.best) }
  const [later, earlier] = daysBetween(a.lastDate, b.lastDate) >= 0 ? [b, a] : [a, b]
  const lastDate = later.lastDate as string
  const end = dayIndex(lastDate)
  const laterStart = end - later.current + 1
  const earlierEnd = dayIndex(earlier.lastDate as string)
  const earlierStart = earlierEnd - earlier.current + 1
  const current =
    later.current > 0 && earlier.current > 0 && laterStart <= earlierEnd + 1
      ? end - Math.min(laterStart, earlierStart) + 1
      : later.current
  return { current, best: Math.max(a.best, b.best, current), lastDate }
}
