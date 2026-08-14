// What the odds calculator quotes, and how much of it is earned.
//
// The engine underneath is estimateEquity (equity.ts), the same one the game
// uses for the win-% in the corner of the table. That is a sampler, and a
// sampler's answer carries an error bar whether or not anyone prints it: the
// same hand under the same seed reads 67.80% at 1,500 iterations and 65.20% at
// 100,000. 1,500 is plenty for an AI deciding whether to call. It is not enough
// for a number a stranger writes down.
//
// So this module does three things the game never needed:
//
//   1. It counts every possible showdown where the count is small enough to be
//      instant, and says so. An exact answer is a different claim from an
//      estimate and has to read differently.
//   2. It attaches a 95% band to every sampled answer, derived from the number
//      of showdowns actually run rather than from a constant.
//   3. It says how many digits that band earns. A tenths digit on a ±0.7 answer
//      is fabricated, and fabricated precision on the page whose whole pitch is
//      that we are the honest one is the worst possible place for it.
//
// Everything here is pure and framework-free, so the page's claims are settled
// by tests/oddsQuote.test.ts rather than by looking at it.

import type { Card, Rng } from './cards'
import { cardToString, createDeck } from './cards'
import { estimateEquity } from './equity'
import { determineWinners } from './handEval'

/** A table seats nine, so the hero can face eight. */
export const MAX_OPPONENTS = 8

/**
 * How many showdowns a sampled answer runs to. 20,000 puts the 95% band at
 * ±0.7 points near 50%, which is the tightest figure that still rounds honestly
 * to a whole percent.
 *
 * Slow devices do not have to reach it: the caller stops when it runs out of
 * time and the band widens to match, which is the point of printing the band.
 */
export const SAMPLE_TARGET = 20_000

/**
 * The largest exhaustive count worth running in front of someone.
 *
 * Measured, not guessed: the existing evaluator does ~21,000 showdowns/sec in a
 * CI container (Node 22), so 5,000 is a quarter of a second there and well
 * under a second on a phone. In practice this admits exactly one shape, the one
 * that matters most: heads-up with the board complete, which is 990 showdowns
 * and instant.
 *
 * The next case up is heads-up on the turn at 45,540, about a second in CI and
 * three or four on a phone. That is a hang, not a calculator, so it samples.
 * Raising this constant needs a faster evaluator, not a bigger number.
 */
export const EXACT_MAX_SHOWDOWNS = 5_000

export interface OddsInput {
  /** Exactly two, or there is nothing to quote. */
  hole: readonly Card[]
  /** 0, 3, 4 or 5 cards. Anything else is a half-dealt board. */
  community?: readonly Card[]
  opponents: number
}

export interface OddsQuote {
  /** Fraction of showdowns won outright. */
  win: number
  /** Fraction tied. */
  tie: number
  /** Share of the pot: win plus the split of every tie. */
  equity: number
  /** Showdowns actually counted. */
  showdowns: number
  /** True when every possible showdown was counted, not sampled. */
  exact: boolean
  /**
   * Half-width of the 95% interval, in percentage points. Zero when exact,
   * because then there is nothing to be uncertain about.
   */
  band: number
}

/** n choose k, exact for every value this file can reach. */
export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1)
  }
  return Math.round(result)
}

/**
 * Every distinct showdown this spot has: each way of finishing the board,
 * times each way of dealing the opponents in.
 *
 * Opponents are counted as distinguishable, which double-counts a multi-way
 * spot's symmetries. It changes no probability and it is the count actually
 * run, which is the only number worth showing anyone.
 */
export function exhaustiveShowdowns(input: OddsInput): number {
  const seen = input.hole.length + (input.community?.length ?? 0)
  const boardNeeded = 5 - (input.community?.length ?? 0)
  let remaining = 52 - seen
  let count = combinations(remaining, boardNeeded)
  remaining -= boardNeeded
  for (let o = 0; o < input.opponents; o++) {
    count *= combinations(remaining, 2)
    remaining -= 2
  }
  return count
}

/**
 * True when the whole thing can be counted rather than sampled.
 *
 * Heads-up only, and that is arithmetic rather than a shortcut: the smallest
 * multi-way enumeration is three-way on the river at 893,970 showdowns, which
 * is two orders of magnitude past what a page can run while somebody waits.
 */
export function canEnumerate(input: OddsInput): boolean {
  return input.opponents === 1 && exhaustiveShowdowns(input) <= EXACT_MAX_SHOWDOWNS
}

/**
 * The 95% half-width of a sampled proportion, in percentage points.
 *
 * 1.96 standard errors on a binomial proportion. Ties make a showdown worth
 * half a pot rather than a whole one, which can only reduce the variance, so
 * treating equity as a straight win rate always overstates the band a little.
 * Overstating it is the right way to be wrong here.
 */
export function sampleBand(equity: number, showdowns: number): number {
  if (showdowns <= 0) return 100
  const p = Math.min(1, Math.max(0, equity))
  const variance = p * (1 - p)
  // A run that never lost has no sample variance and would print ±0.0, which
  // claims a certainty a sample cannot have. The rule of three is the standard
  // bound for a zero-count proportion: the true rate is within 3/n.
  if (variance === 0) return 300 / showdowns
  return 196 * Math.sqrt(variance / showdowns)
}

/**
 * How many decimal places a figure with this band has earned.
 *
 * The tenths digit is noise unless the band itself is under a tenth of a point,
 * so a ±0.7 answer prints as a whole percent and an exact one prints a decimal.
 * This is the rule the display follows, and never the other way round.
 */
export function decimalsFor(band: number): number {
  return band < 0.1 ? 1 : 0
}

/** A percentage, at the precision its band earns. */
export function formatQuoted(fraction: number, band: number): string {
  return `${(fraction * 100).toFixed(decimalsFor(band))}%`
}

/** The band itself, shown to enough places to be worth reading. */
export function formatBand(band: number): string {
  return band < 0.1 ? band.toFixed(2) : band.toFixed(1)
}

/** Index combinations of size k from [0, n), in lexicographic order. */
function* indexCombinations(n: number, k: number): Generator<number[]> {
  if (k === 0) {
    yield []
    return
  }
  if (k > n) return
  const idx = Array.from({ length: k }, (_, i) => i)
  for (;;) {
    yield idx
    let i = k - 1
    while (i >= 0 && idx[i] === n - k + i) i--
    if (i < 0) return
    idx[i]++
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1
  }
}

/** The 52 cards nobody can see yet. */
function unseenCards(input: OddsInput): Card[] {
  const used = new Set([...input.hole, ...(input.community ?? [])].map(cardToString))
  return createDeck().filter((card) => !used.has(cardToString(card)))
}

/**
 * Every heads-up showdown in turn, as the hero's share of the pot (1, ½ or 0).
 *
 * Boards on the outside so the hero's hand is evaluated once per run-out rather
 * than once per opponent holding.
 */
function* headsUpShowdowns(input: OddsInput): Generator<number> {
  const community = input.community ?? []
  const unseen = unseenCards(input)
  const boardNeeded = 5 - community.length

  for (const boardIdx of indexCombinations(unseen.length, boardNeeded)) {
    const onBoard = new Set(boardIdx)
    const board = [...community, ...boardIdx.map((i) => unseen[i])]
    const available = unseen.filter((_, i) => !onBoard.has(i))

    for (const [a, b] of indexCombinations(available.length, 2)) {
      const { winners } = determineWinners(
        [
          { id: 'hero', hole: input.hole },
          { id: 'opp', hole: [available[a], available[b]] },
        ],
        board,
      )
      if (!winners.includes('hero')) yield 0
      else yield winners.length === 1 ? 1 : 1 / winners.length
    }
  }
}

/**
 * A run in progress. Answering takes long enough that it has to be done a slice
 * at a time, so the page stays responsive and can show the band tightening.
 *
 * `step` is the only moving part and it is deterministic given the rng, so how
 * the caller chops the work up cannot change the answer.
 */
export interface OddsRunner {
  /** Whether this run counts every showdown or samples them. */
  readonly exact: boolean
  /** Showdowns this run intends to do. */
  readonly total: number
  /** Showdowns done so far. */
  readonly done: number
  /** True once there is no more work. */
  readonly finished: boolean
  /**
   * The answer so far, or null when there is nothing honest to show yet. An
   * exact run has no meaningful halfway point (a partial enumeration is a
   * biased subset of the run-outs, not a small sample of them), so it stays
   * null until the count is complete.
   */
  readonly quote: OddsQuote | null
  /** Do up to `budget` showdowns. Returns how many it actually did. */
  step(budget: number): number
}

export function createOddsRunner(
  input: OddsInput,
  opts: { rng?: Rng; target?: number } = {},
): OddsRunner {
  const exact = canEnumerate(input)
  const total = exact ? exhaustiveShowdowns(input) : (opts.target ?? SAMPLE_TARGET)
  const rng = opts.rng ?? Math.random

  let done = 0
  let wins = 0
  let ties = 0
  let potShare = 0
  const showdowns = exact ? headsUpShowdowns(input) : null

  const quoteNow = (): OddsQuote | null => {
    if (done === 0) return null
    if (exact && done < total) return null
    const equity = potShare / done
    return {
      win: wins / done,
      tie: ties / done,
      equity,
      showdowns: done,
      exact,
      band: exact ? 0 : sampleBand(equity, done),
    }
  }

  return {
    exact,
    total,
    get done() {
      return done
    },
    get finished() {
      return done >= total
    },
    get quote() {
      return quoteNow()
    },
    step(budget: number): number {
      const want = Math.max(0, Math.min(Math.floor(budget), total - done))
      if (want === 0) return 0

      if (showdowns) {
        let ran = 0
        while (ran < want) {
          const next = showdowns.next()
          if (next.done) break
          const share = next.value
          if (share === 1) wins++
          else if (share > 0) ties++
          potShare += share
          ran++
        }
        done += ran
        return ran
      }

      // One rng across every slice. Slicing still changes which hands come
      // out (estimateEquity shuffles its own deck in place across the
      // iterations of a single call, and a fresh call starts that over), but
      // each slice is an unbiased sample of the same spot, so the estimator
      // this builds is the same estimator either way. tests/oddsQuote.test.ts
      // pins that: two different slicings agree inside the band.
      const result = estimateEquity({
        hole: input.hole,
        community: input.community,
        opponents: input.opponents,
        iterations: want,
        rng,
      })
      // win and tie are counts divided by a known integer; recovering the
      // counts keeps the running totals whole rather than drifting.
      wins += Math.round(result.win * want)
      ties += Math.round(result.tie * want)
      potShare += result.equity * want
      done += want
      return want
    },
  }
}
