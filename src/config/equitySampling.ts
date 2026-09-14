// The measurements behind /blog/how-accurate-is-a-poker-equity-calculator.
//
// The post publishes figures that cost two minutes of dealing to produce, which
// is too much to re-run on every push (`pnpm test:all` is about 450s; the sweep
// alone is 331s). So the numbers live here as a dated measurement with the
// command that reproduces them, and tests/equitySampling.test.ts holds the parts
// that are cheap: the enumerated ground truth, which is 990 showdowns and
// instant, and the arithmetic every printed band is derived from.
//
// The rule this follows is the one the starting-hands PNG taught us: publishing
// a number changes what its going stale costs, so the guard ships with the
// claim. What it cannot do is re-deal 2.65M showdowns per push, so it guards
// what a wrong number would have to get past instead.

/** The day the sweep and the spread runs below were last executed. */
export const MEASURED_ON = '2026-09-14'

/** Reproduces the coverage rows. Lives in scripts/odds-band-coverage.ts. */
export const SWEEP_COMMAND = 'pnpm odds-band-coverage'

/**
 * The one shape a browser can count rather than sample: heads-up with the board
 * complete, so the only unknown is the opponent's two cards and there are
 * C(45,2) = 990 of them. Every other shape runs to tens of thousands at least,
 * and the smallest multi-way enumeration is 893,970.
 *
 * Pocket eights on A-K-9-4-2, which is 58.6% and therefore close to where a
 * proportion's variance is worst and the band has the most work to do.
 */
export const GROUND_TRUTH = {
  hole: ['8h', '8d'],
  community: ['Ac', 'Kd', '2s', '9h', '4c'],
  showdowns: 990,
  wins: 580,
  ties: 1,
  losses: 409,
} as const

/** The hero's share of the pot, as a fraction. A tie is worth half a pot. */
export function trueEquity(): number {
  const { wins, ties, showdowns } = GROUND_TRUTH
  return (wins + ties / 2) / showdowns
}

/** Independent runs behind each coverage row. */
export const COVERAGE_RUNS = 100

/**
 * Does the band contain the true answer as often as it promises? One row per
 * sample size, each row 100 seeded runs against the enumerated answer above.
 *
 * `worstMiss` is how far outside its own band the furthest run landed, in
 * percentage points.
 */
export const COVERAGE = [
  { iterations: 1_500, contained: 92, worstMiss: 1.22 },
  { iterations: 5_000, contained: 94, worstMiss: 0.38 },
  { iterations: 20_000, contained: 99, worstMiss: 0.29 },
] as const

/** Independent seeds behind each width row. */
export const WIDTH_SEEDS = 60

/**
 * Is the band the right *width*? A band twice as wide as it should be contains
 * the answer every time and tells the reader the calculator is half as good as
 * it is, so containment alone cannot catch it.
 *
 * `spread` is the measured standard deviation of the estimate across seeds, in
 * points. `claimedSe` is the standard error the printed band asserts, which is
 * the band divided by 1.96. `bias` is the mean estimate minus the enumerated
 * truth, in points.
 *
 * Held to three decimals because the post prints two and the ratio is a
 * division: rounding first turns 1.05 into 1.04 at 5,000 iterations, which is
 * how this file's test found the first version of these rows.
 */
export const WIDTH = [
  { iterations: 500, spread: 2.262, claimedSe: 2.203, bias: -0.123 },
  { iterations: 1_500, spread: 1.405, claimedSe: 1.271, bias: 0.112 },
  { iterations: 5_000, spread: 0.73, claimedSe: 0.697, bias: -0.051 },
  { iterations: 20_000, spread: 0.319, claimedSe: 0.348, bias: 0.021 },
] as const

/** Measured spread over the spread the band claims. A perfect band reads 1.00. */
export function widthRatio(row: (typeof WIDTH)[number]): number {
  return row.spread / row.claimedSe
}

/**
 * How precisely `WIDTH_SEEDS` runs pin a standard deviation, as a fraction.
 *
 * 1/sqrt(2(n-1)), the relative standard error of a sample SD. This is *one*
 * standard error and not an interval, which matters: at 60 seeds it is 9.2%,
 * and the 1.11 row is outside 9% while being an ordinary result. The post
 * prints both this and the interval below rather than the one that flatters us.
 */
export function sdRelativeError(seeds: number = WIDTH_SEEDS): number {
  return 1 / Math.sqrt(2 * (seeds - 1))
}

/** The 95% interval a ratio of 1.00 would sit in, given `WIDTH_SEEDS` runs. */
export const RATIO_TOLERANCE = 1.96 * sdRelativeError()

/**
 * The largest bias measured at any sample size, in points, rounded up to the
 * digit the post prints. Kept as a constant so the sentence claiming it and the
 * table under it cannot disagree.
 */
export const WORST_BIAS = 0.13

/** Cards as a reader writes them: "8h 8d" rather than an array. */
export function formatSpot(cards: readonly string[]): string {
  return cards.join(' ')
}
