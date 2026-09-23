import { STARTING_RATING } from './rating'

// The rating's past, kept so a player can see the line rather than only the
// point at the end of it.
//
// **The x axis is spots answered, and there is no other axis available.** A
// point is `[answered, rating]`: how many spots of this kind you had answered,
// and what the rating was straight after the last of them. Nothing here reads
// the clock, for the reason ./rating gives at the top: a graph over days is a
// graph with gaps in it, and a gap is a thing you can be made to feel behind
// about. A graph over spots has no gaps. Stop for a year and the line picks up
// exactly where it stopped.
//
// **Bounded, and the bound thins the past rather than dropping it.** A profile
// is persisted, synced and copied into a transfer code, so it cannot grow a
// point per answer for ever. When the history is full, the older half is
// halved: every other point goes, the first point and the recent stretch stay
// whole. Do that repeatedly and the line keeps its whole shape, drawn at a
// resolution that falls off with age, which is what anybody reading a long
// graph looks at anyway. Because each point carries its own `answered`, a
// thinned point is still drawn where it happened.

/** One point on the graph: spots answered, and the rating after the last of them. */
export type RatingPoint = [answered: number, rating: number]

/**
 * How many points a kind keeps.
 *
 * A point is about a dozen characters of JSON and there are six kinds, so this
 * is under ten kilobytes in the worst case, most of which the transfer code's
 * gzip takes back. It is also more than a phone-width graph can draw as
 * separate positions, so a bigger number would buy nothing you could see.
 */
export const RATING_HISTORY_CAP = 120

/**
 * The history an existing record starts with, when it has none.
 *
 * Two points, and both are true: every record started at {@link
 * STARTING_RATING} with nothing answered, and it is at `rating` after
 * `answered`. The straight line between them is the only thing drawn that was
 * not recorded, and it is the honest shape of "we did not keep the middle".
 * A kind with nothing answered gets just the starting point.
 */
export function seedRatingHistory(answered: number, rating: number): RatingPoint[] {
  const start: RatingPoint = [0, STARTING_RATING]
  return answered > 0 ? [start, [answered, rating]] : [start]
}

/**
 * The history, thinned to fit `cap`, or the same array when it already fits.
 *
 * Keeps the first point and the most recent `cap / 2` untouched, and takes
 * every other point out of the stretch between them, repeating until it fits.
 * Pure and deterministic: the same history always thins to the same points, so
 * two devices holding the same answers hold the same graph.
 */
export function thinRatingHistory(
  history: readonly RatingPoint[],
  cap: number = RATING_HISTORY_CAP,
): RatingPoint[] {
  // A cap under four leaves no stretch to thin between the first point and the
  // recent ones. Nothing calls it with one; this is the guard against a loop
  // that could never finish.
  const limit = Math.max(4, Math.floor(cap))
  let points = history.slice()
  while (points.length > limit) {
    const recent = Math.floor(limit / 2)
    const middle = points.slice(1, points.length - recent)
    // Keep the odd ones, so the point right after the first is the one that
    // goes and the stretch never opens with two points at the same place.
    const kept = middle.filter((_, i) => i % 2 === 1)
    points = [points[0], ...kept, ...points.slice(points.length - recent)]
  }
  return points
}

/**
 * The history with one more answer on the end, thinned if that overfills it.
 *
 * `answered` is the count *after* this spot, which is the x the new rating
 * belongs at. A point at an `answered` the history already ends on replaces
 * that point rather than stacking a second one on top of it.
 */
export function appendRatingPoint(
  history: readonly RatingPoint[],
  answered: number,
  rating: number,
  cap: number = RATING_HISTORY_CAP,
): RatingPoint[] {
  const last = history[history.length - 1]
  const base = last && last[0] >= answered ? history.slice(0, -1) : history
  return thinRatingHistory([...base, [answered, rating]], cap)
}
