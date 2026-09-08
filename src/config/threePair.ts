// Seven cards holding three separate pairs, and what the third pair is worth.
//
// Counts rather than the percentages /learn/three-pair-in-texas-holdem prints,
// for the reason handFrequencies.ts and flopSet.ts give: a percentage is an
// independent chance to be wrong and nothing in the repo can check it, where
// counts have to add up. The five rank shapes below sum to C(52,7) exactly and
// the three roles sum to 8,580, and tests/threePair.test.ts makes them.
//
// The counts are typed out rather than derived. A number computed from the
// evaluator cannot disagree with the evaluator, so the claim has to be written
// down first for a test to have something to refute.

import { SEVEN_CARD_HANDS } from './handFrequencies'

export interface RankShape {
  /** How the seven cards fall by rank, as the page's table names it. */
  shape: string
  /** The rank pattern behind the name, e.g. '2-2-2-1'. */
  pattern: string
  /** Seven-card holdings of this shape, out of SEVEN_CARD_HANDS. */
  hands: number
}

/**
 * Every seven-card holding, split by rank pattern alone.
 *
 * Rank pattern only, which is the caveat the page states rather than hides: a
 * straight or a flush is a claim about sequence and suit, so both of those sit
 * inside these rows rather than beside them. Three pair is the one row where
 * that cannot happen, because four distinct ranks cannot make a straight and
 * three pairs plus a spare cannot put five cards in one suit.
 *
 * Largest first, which is the order the page draws them in, so the rarest
 * shape is the last line rather than a number the reader has to hunt for.
 */
export const RANK_SHAPES: readonly RankShape[] = [
  {
    shape: 'One pair, and five ranks that appear once',
    pattern: '2-1-1-1-1-1',
    hands: 63_258_624,
  },
  {
    shape: 'Two pairs, and three ranks that appear once',
    pattern: '2-2-1-1-1',
    hands: 29_652_480,
  },
  {
    shape: 'Seven different ranks, no pair anywhere',
    pattern: '1-1-1-1-1-1-1',
    hands: 28_114_944,
  },
  {
    shape: 'Some rank three or four times over',
    pattern: 'any shape with a 3 or a 4 in it',
    hands: 10_287_472,
  },
  {
    shape: 'Three pairs, and one spare card',
    pattern: '2-2-2-1',
    hands: 2_471_040,
  },
]

/** C(13,3) x 6^3 x 10 x 4: the three-pair row above, named. */
export const THREE_PAIR_HANDS = 2_471_040

/** C(13,3) x 10: three ranks paired and one spare, suits ignored. */
export const THREE_PAIR_RANK_SHAPES = 2_860

/** 6^3 x 4: the ways to deal one of those rank shapes in suits. */
export const SUIT_DEALS_PER_SHAPE = 864

/**
 * Rank shapes where the kicker comes out of the third pair rather than the
 * spare card, which happens exactly when the spare is the lowest of the four
 * ranks: 715 of 2,860, or one in four on the nose.
 */
export const THIRD_PAIR_IS_THE_KICKER = 715

/** 13 x C(12,2) x 10: the shapes seen from the seat holding the pocket pair. */
export const POCKET_PAIR_SHAPES = 8_580

export interface PocketPairRole {
  /** What your own two cards end up doing. */
  role: string
  /** Cards of yours in the best five. */
  cards: number
  /** Shapes of POCKET_PAIR_SHAPES where that is what happens. */
  shapes: number
}

/**
 * You hold a pocket pair, the board comes with two other pairs on it, and the
 * hand is over. Where your own two cards end up, best case first.
 *
 * The three sum to POCKET_PAIR_SHAPES. Every shape carries the same 864 suit
 * deals, so a share of the shapes is a share of the hands and no weighting is
 * needed anywhere.
 */
export const POCKET_PAIR_ROLES: readonly PocketPairRole[] = [
  {
    role: 'Your pair is one of the two that play',
    cards: 2,
    shapes: 5_720,
  },
  {
    role: 'One of your cards is the kicker',
    cards: 1,
    shapes: 715,
  },
  {
    role: 'Neither card plays: you are playing the board',
    cards: 0,
    shapes: 2_145,
  },
]

/**
 * The two spots the page walks through, as card strings for the evaluator. The
 * page renders the same arrays as glyphs, so the prose and the check cannot
 * come apart.
 */
export interface WorkedSpot {
  hole: readonly string[]
  board: readonly string[]
  /** The villain, who has no pair at all and is here to be compared against. */
  villain: readonly string[]
  /** pokersolver's own description of the hero's hand, verbatim. */
  description: string
}

/** Your eights are the kicker, and the kicker wins it. */
export const KICKER_SPOT: WorkedSpot = {
  hole: ['8s', '8d'],
  board: ['Ac', 'Ah', 'Kc', 'Kh', '5s'],
  villain: ['7c', '2d'],
  description: "Two Pair, A's & K's",
}

/** Your threes do nothing, and the pot is split with a hand that has nothing. */
export const BOARD_SPOT: WorkedSpot = {
  hole: ['3s', '3d'],
  board: ['Ac', 'Ah', '9c', '9h', 'Ks'],
  villain: ['7c', '2d'],
  description: "Two Pair, A's & 9's",
}

/** A shape's share of every seven-card holding, e.g. '1.85%'. */
export function shapeShare(hands: number): string {
  return `${((hands / SEVEN_CARD_HANDS) * 100).toFixed(2)}%`
}

/** '54' for the three-pair row: one seven-card holding in this many. */
export function oneHandIn(hands: number): string {
  return (SEVEN_CARD_HANDS / hands).toFixed(0)
}

/** A role's share of the shapes a pocket pair meets, e.g. '66.7%'. */
export function roleShare(shapes: number): string {
  return `${((shapes / POCKET_PAIR_SHAPES) * 100).toFixed(1)}%`
}
