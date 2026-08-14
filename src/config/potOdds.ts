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

export interface SizeNote {
  id: BetSizeId
  /** One line, shown under the pair of figures the size sets. */
  note: string
}

/**
 * The sizes the TwoPrices widget offers, in the order it offers them, with the
 * line each one earns. Ids only: the label and the fraction stay in BET_SIZES,
 * so the widget and the table above it cannot print different numbers for the
 * same size. The five are the four worth having plus the overbet, which is the
 * one that shows what the trade costs when you push it.
 */
export const TWO_PRICE_SIZES: readonly SizeNote[] = [
  {
    id: 'third',
    note: 'The best bluff size. It only has to work a quarter of the time.',
  },
  {
    id: 'half',
    note: 'The default. If you have not got a reason for another number, use this one.',
  },
  {
    id: 'twothirds',
    note: 'Where most value bets belong, and enough to make any single draw a losing call.',
  },
  {
    id: 'pot',
    note: 'Now the bluff has to work half the time. Rare, on purpose.',
  },
  {
    id: 'overbet',
    note: 'Charges them 40% and needs two folds in three. Everything worse than you folds, which is the wrong half of the table to lose.',
  },
]

/**
 * The sizes the WhatItCosts widget lights one at a time. Ids only, so a tap and
 * the table row above it cannot print different prices for the same size.
 *
 * Six of the table's seven. Three-quarters is left out because it sets a price
 * 1.4 points from two-thirds, and a tap whose answer is its neighbour's answer
 * teaches nothing. It stays in the table, where a reader is scanning a column
 * rather than choosing a button.
 */
export const PRICE_TAP_SIZES: readonly BetSizeId[] = [
  'quarter',
  'third',
  'half',
  'twothirds',
  'pot',
  'overbet',
]

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

export interface ChargedDraw extends Draw {
  /** Two hole cards, as "Js"/"Th" strings. */
  hero: readonly string[]
  /** The flop they are drawing on. */
  board: readonly string[]
}

/**
 * A board for four of the five draws, so the widget on /learn/bet-sizing shows
 * the hand rather than naming it. Keyed by DRAWS id: the out count stays in
 * DRAWS, which is the list the pot-odds table prints, and only the picture is
 * here. A draw whose cards and whose count live in two files is a draw that can
 * be drawn with one number and counted with another.
 *
 * The fifteen-out board is the one to check rather than trust. J♠T♠ on 9♠8♠2♦
 * is nine spades, plus the queens and the sevens, less the two of those already
 * counted as spades. tests/guideWidgets.test.ts counts every one of the 47
 * unseen cards through the evaluator instead of adding 9 and 8, because 9 and 8
 * is 17, and the same draw written on 9♠8♣2♦ is not a flush draw at all.
 *
 * Two overcards is not here on purpose: the six-out count depends on both
 * overcards being live, which is a fact about the other hand and not about the
 * board, so any picture of it would be making a claim the cards cannot show.
 */
const DRAW_CARDS: Record<string, { hero: readonly string[]; board: readonly string[] }> = {
  gutshot: { hero: ['Jh', 'Th'], board: ['9s', '7c', '2d'] },
  oesd: { hero: ['Jh', 'Th'], board: ['9s', '8c', '2d'] },
  flush: { hero: ['8s', '7s'], board: ['9s', '4s', '2h'] },
  combo: { hero: ['Js', 'Ts'], board: ['9s', '8s', '2d'] },
}

/** The four draws with a board, in the order the outs table lists them. */
export const CHARGED_DRAWS: readonly ChargedDraw[] = DRAWS.filter(
  (draw) => draw.id in DRAW_CARDS,
).map((draw) => ({ ...draw, ...DRAW_CARDS[draw.id] }))

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
  /**
   * The bet the spot faces, as a fraction of the pot. The pot is 100 in every
   * spot, so this is the only number the ThePrice widget needs to draw a price
   * bar, and requiredEquity() turns it into one. Typing the price instead is
   * how a spot gets added with the wrong one in it.
   */
  betFraction: number
  /** One line, shown under the bars. Says what the count misses in this spot. */
  note: string
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
    betFraction: 0.5,
    note: 'The count says nine outs. The runouts say 39.3%, because running straights and running pairs are worth something the count ignores. It is still a fold to this bet for one card.',
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
    betFraction: 0.5,
    note: 'The same nine outs, worth a third less. Every card that pairs the board makes the set a full house, and your flush arrives second.',
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
    betFraction: 1,
    note: 'Fifteen outs is the one draw that is genuinely a favourite by the river, and still not quite priced in for one card. This is the hand people stack off with, and against a pot-sized bet they are close to right.',
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
    betFraction: 0.5,
    note: 'Eight outs. The rule of 4 says 32% by the river and the truth is 34.2%, so the shortcut is fine here. It is the one-card number that decides the call.',
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
    betFraction: 0.5,
    note: 'A gutshot needs a bet under about a tenth of the pot before the immediate price works. It almost never is.',
  },
]
