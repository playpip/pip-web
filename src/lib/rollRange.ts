/**
 * How much of the Roll's history to look at, and which way it went.
 *
 * Pure, so both screens that draw the graph and the report that writes a
 * sentence about it read the same two functions — a picker that showed the
 * last week while the line above it described a year would be worse than no
 * picker at all.
 */

import type { RollPoint } from '@/store/profile'

export interface RollRange {
  id: string
  /** On the button. */
  label: string
  /** Days back from now, or null for everything ever recorded. */
  days: number | null
}

/**
 * The spans on offer.
 *
 * Four, because five is a row of buttons nobody reads and three cannot cover
 * both "this week" and "since I started". Days rather than calendar months:
 * "30 days" is a promise this can keep exactly, where "this month" changes
 * meaning on the first of every month.
 */
export const ROLL_RANGES: readonly RollRange[] = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: 'all', label: 'All time', days: null },
]

const DAY_MS = 86_400_000

/**
 * The points inside a span.
 *
 * `now` is passed in rather than read, so this is testable and so a screen
 * cannot drift a few milliseconds between the graph and the sentence under it.
 *
 * **Nothing is interpolated at the edge.** A span that starts mid-gap begins at
 * the first result inside it, and the graph draws from there. Inventing a point
 * on the boundary would draw a line through a Roll the player never had.
 */
export function pointsInRange(
  points: readonly RollPoint[],
  range: RollRange,
  now: number,
): RollPoint[] {
  if (range.days === null) return points.slice()
  const from = now - range.days * DAY_MS
  return points.filter((p) => p.t >= from)
}

/** A span worth offering: two points is the fewest that can draw a line. */
export function rangeHasEnough(
  points: readonly RollPoint[],
  range: RollRange,
  now: number,
): boolean {
  return pointsInRange(points, range, now).length >= 2
}

export type RollTrend = 'up' | 'down' | 'level'

/**
 * How much better the second half has to be before it counts as a direction.
 *
 * Halves compared rather than a fitted line: a line implies a precision this
 * sample does not have. Fifteen percent, because a Roll wanders and the point
 * of the sentence is to name a trend rather than to report noise.
 */
export const TREND_MARGIN = 0.15

/** Which way a run of results went, or `level` when it is inside the noise. */
export function rollTrend(points: readonly RollPoint[]): RollTrend {
  if (points.length < 2) return 'level'
  const half = Math.floor(points.length / 2)
  const mean = (slice: readonly RollPoint[]) =>
    slice.reduce((sum, p) => sum + p.roll, 0) / slice.length
  const before = mean(points.slice(0, half))
  const after = mean(points.slice(half))
  if (after > before * (1 + TREND_MARGIN)) return 'up'
  if (after < before * (1 - TREND_MARGIN)) return 'down'
  return 'level'
}
