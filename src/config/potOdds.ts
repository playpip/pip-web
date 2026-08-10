// The arithmetic behind /learn/pot-odds and /learn/bet-sizing.
//
// Both pages are almost entirely numbers, and a reader has no way to check any
// of them. So nothing here is typed out: every percentage either falls out of
// one of the functions below or, for the five worked spots, is settled against
// the real evaluator in tests/guideClaims.test.ts by playing all 990 runouts.
// Same rule as src/config/startingHands.ts — the prose and the tables come from
// one source, so they cannot drift apart.

import { type Card, SUIT_GLYPH, cardFromString } from '@/lib/poker/cards'

/** Cards you have not seen from the flop: 52, less your two and the three up. */
export const UNSEEN_AFTER_FLOP = 47

/** n choose 2. The only binomial either page needs. */
const pairs = (n: number): number => (n * (n - 1)) / 2

/**
 * How often a caller has to win for a bet of `fraction` of the pot to be worth
 * calling: `bet / (pot + 2 * bet)`, because the pot they are calling into
 * already contains the bet and will contain their call too. Dividing by the pot
 * as it stands is the common mistake and it flatters every price.
 */
export function requiredEquity(fraction: number): number {
  return fraction / (1 + 2 * fraction)
}

/**
 * How often a bluff of `fraction` of the pot has to work to break even:
 * `bet / (pot + bet)`. You are risking the bet to win the pot as it stands.
 */
export function breakevenFolds(fraction: number): number {
  return fraction / (1 + fraction)
}

/** The chance a draw with `outs` outs gets there on the next card. */
export function oneCardChance(outs: number): number {
  return outs / UNSEEN_AFTER_FLOP
}

/** ...and by the river, which is only yours if you get to see both cards. */
export function byRiverChance(outs: number): number {
  return 1 - pairs(UNSEEN_AFTER_FLOP - outs) / pairs(UNSEEN_AFTER_FLOP)
}

/**
 * The smallest bet, as a fraction of the pot, that makes calling with `outs`
 * outs a losing call for one card. Solves requiredEquity(f) = oneCardChance.
 */
export function chargingBet(outs: number): number {
  const equity = oneCardChance(outs)
  return equity / (1 - 2 * equity)
}

/** What the pot multiplies by when a bet of `fraction` gets called. */
export function potMultiple(fraction: number): number {
  return 1 + 2 * fraction
}

/**
 * A percentage the way the guides print one: at most one decimal, and no
 * trailing `.0`, so 25% reads as 25% and two-thirds pot reads as 28.6%.
 */
export function pct(value: number): string {
  return trim((value * 100).toFixed(1))
}

/** A multiplier, e.g. 1.67 or 2. `dp` because the growth table wants both. */
export function multiple(value: number, dp = 2): string {
  return trim(value.toFixed(dp))
}

function trim(fixed: string): string {
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

/** Cards as a guide writes them in prose: "8♠7♠", "9♠4♠2♥". */
export function cardsText(cards: readonly string[]): string {
  return cards
    .map(cardFromString)
    .map((card: Card) => `${card.rank}${SUIT_GLYPH[card.suit]}`)
    .join('')
}

export type BetSizeId =
  | 'quarter'
  | 'third'
  | 'half'
  | 'twothirds'
  | 'threequarters'
  | 'pot'
  | 'overbet'

export interface BetSize {
  id: BetSizeId
  label: string
  /** The bet as a fraction of the pot. Every figure on both pages comes off it. */
  fraction: number
}

/** Ascending, which is also the order both pages print them in. */
export const BET_SIZES: readonly BetSize[] = [
  { id: 'quarter', label: 'Quarter pot', fraction: 1 / 4 },
  { id: 'third', label: 'Third pot', fraction: 1 / 3 },
  { id: 'half', label: 'Half pot', fraction: 1 / 2 },
  { id: 'twothirds', label: 'Two-thirds pot', fraction: 2 / 3 },
  { id: 'threequarters', label: 'Three-quarters pot', fraction: 3 / 4 },
  { id: 'pot', label: 'Pot', fraction: 1 },
  { id: 'overbet', label: 'Twice the pot', fraction: 2 },
]

export function betSizes(ids: readonly BetSizeId[]): BetSize[] {
  return BET_SIZES.filter((size) => ids.includes(size.id))
}

export interface Draw {
  id: string
  /** How the outs table names it. */
  label: string
  outs: number
}

export const DRAWS: readonly Draw[] = [
  { id: 'gutshot', label: 'Gutshot straight', outs: 4 },
  { id: 'overcards', label: 'Two overcards', outs: 6 },
  { id: 'oesd', label: 'Open-ended straight', outs: 8 },
  { id: 'flush', label: 'Flush', outs: 9 },
  { id: 'combo', label: 'Flush and open-ended straight', outs: 15 },
]

export interface WorkedSpot {
  id: string
  /** Hole cards, flop and the hand they are up against, as "8s"/"Ah" strings. */
  hero: readonly string[]
  flop: readonly string[]
  villain: readonly string[]
  /** What the outs table would have you count, and how the guide says it. */
  outs: number
  outsLabel: string
  /**
   * Whether that count is the draw plus overcards rather than the draw alone.
   * Only the fifteen-out spot, which is a flush draw and two live overcards.
   */
  countsOvercards: boolean
  /**
   * Equity by the river as a percentage, to two decimals. Exhaustive over all
   * 990 turn-and-river runouts, split pots counted as half, and re-run against
   * the evaluator by tests/guideClaims.test.ts. Not an estimate.
   */
  equity: number
}

/**
 * The five spots the pot-odds guide works out. They exist to show that the same
 * out count is worth wildly different amounts: nine outs is 39.29% in the first
 * row and 27.37% in the second, because the second opponent has flopped a set.
 *
 * Cards live here as strings and the table's prose is rendered from them by
 * cardsText(), so the picture on the page is the hand the test enumerated. A
 * board written one way and counted another is exactly how a fifteen-out draw
 * gets printed on a flop with three spades on it.
 */
export const WORKED_SPOTS: readonly WorkedSpot[] = [
  {
    id: 'flush-vs-overpair',
    hero: ['8s', '7s'],
    flop: ['9s', '4s', '2h'],
    villain: ['Ah', 'Ad'],
    outs: 9,
    outsLabel: '9, a flush draw',
    countsOvercards: false,
    equity: 39.29,
  },
  {
    id: 'flush-vs-set',
    hero: ['8s', '7s'],
    flop: ['Qs', '6s', '2h'],
    villain: ['Qh', 'Qd'],
    outs: 9,
    outsLabel: '9, a flush draw',
    countsOvercards: false,
    equity: 27.37,
  },
  {
    id: 'monster-draw',
    hero: ['As', 'Ks'],
    flop: ['9s', '4s', '2h'],
    villain: ['Qh', 'Qd'],
    outs: 15,
    outsLabel: '15, flush and overcards',
    countsOvercards: true,
    equity: 55.05,
  },
  {
    id: 'open-ended',
    hero: ['Jh', 'Th'],
    flop: ['9s', '8c', '2d'],
    villain: ['Ac', 'Ad'],
    outs: 8,
    outsLabel: '8, open-ended',
    countsOvercards: false,
    equity: 34.24,
  },
  {
    id: 'gutshot',
    hero: ['Jh', 'Th'],
    flop: ['9s', '7c', '2d'],
    villain: ['Ac', 'Ad'],
    outs: 4,
    outsLabel: '4, a gutshot',
    countsOvercards: false,
    equity: 20.3,
  },
]
