// How many of your two hole cards make it into your best five, counted over
// every Hold'em deal, for /blog/how-often-both-your-cards-play.
//
// Counts rather than percentages, for the reason handFrequencies.ts gives: the
// three rows have to add up to every deal there is, and a test can check that
// where it cannot check a percentage.
//
// Typed out, not derived. The full count runs every one of the 133,784,560
// seven-card sets through the 21 ways to split it into two hole cards and a
// board: about a minute in C, far too long for the suite. The post says so,
// and says how the count was checked against Pip's own evaluator.
// tests/whichFivePlay.test.ts pins the sums and the worked hands.

import { SEVEN_CARD_HANDS } from './handFrequencies'

/** Two hole cards and a five-card board, dealt from one deck: C(52,7) x C(7,2). */
export const DEALS = SEVEN_CARD_HANDS * 21

/** How many hole cards the best five needs, over every deal. */
export const HOLE_CARDS_PLAYING = {
  /** Neither: the board alone is as good as anything you can make. */
  board: 137_424_284,
  /** One of the two is enough. */
  one: 1_347_370_964,
  /** The best five cannot be made without both. */
  both: 1_324_680_512,
} as const

/** Seven-card sets where two or more different fives tie for best. */
export const TIED_FIVES = {
  straight: 2_386_100,
  twoPair: 617_760,
  fullHouse: 54_912,
  quads: 21_216,
} as const

export const TIED_FIVES_TOTAL = 3_079_988

export interface WorkedHand {
  hole: readonly [string, string]
  board: readonly [string, string, string, string, string]
  /** Which hole cards the best five cannot do without. */
  plays: 'none' | 'first' | 'second' | 'both'
}

/** The board makes a straight nobody can beat. */
export const BOARD_STRAIGHT: WorkedHand = {
  hole: ['8h', '2c'],
  board: ['9s', 'Th', 'Jd', 'Qc', 'Ks'],
  plays: 'none',
}

/** A pocket pair that is only the third pair. */
export const THIRD_PAIR: WorkedHand = {
  hole: ['3c', '3d'],
  board: ['As', 'Ah', 'Kd', 'Kc', 'Qs'],
  plays: 'none',
}

/** Three in a row on the board, and your two cards are the bottom of the straight. */
export const BOTH_FOR_A_STRAIGHT: WorkedHand = {
  hole: ['6s', '7s'],
  board: ['8s', '9d', 'Tc', 'Kh', '2d'],
  plays: 'both',
}

/** The ace makes the flush; the seven is along for the ride. */
export const ONE_CARD_FLUSH: WorkedHand = {
  hole: ['Ah', '7c'],
  board: ['Kh', '9h', '5h', '2h', 'Js'],
  plays: 'first',
}

/** Two nines, and either one finishes the straight. */
export const TWO_RIGHT_FIVES: WorkedHand = {
  hole: ['Kh', '9d'],
  board: ['9s', 'Th', 'Jd', 'Qc', '3s'],
  plays: 'first',
}
