// Every flop a pocket pair can meet, graded by the hand it actually makes.
//
// Counts rather than the percentages /learn/how-often-do-you-flop-a-set prints,
// for the same reason handFrequencies.ts does it: five percentages are five
// independent chances to be wrong and nothing in the repo can check any of
// them, where five counts have to add up to C(50,3) exactly. The percentages
// are computed here at render time, so the table cannot disagree with the
// sentence under it.
//
// The counts are typed out rather than derived, on purpose. A number computed
// from the evaluator cannot disagree with the evaluator, so it would prove
// nothing: the claim has to be written down before a test can refute it.
// tests/flopSet.test.ts refutes it by dealing all 19,600 flops from the same
// deck the game deals from and grading each one with the same evaluator that
// settles a real pot.

/** C(50,3): every flop, once your own two cards are out of the deck. */
export const FLOPS = 19_600

/** C(52,2): every two-card hand you can be dealt. */
export const PREFLOP_HANDS = 1_326

/** Of those, the ones that are a pair: 13 ranks x C(4,2). */
export const POCKET_PAIRS = 78

export interface FlopOutcome {
  /** The evaluator's own category name, verbatim. It is part of the claim. */
  hand: string
  /** What that grade is when the two cards you hold are a pair. */
  what: string
  /** Flops of the 19,600 that grade this way. */
  flops: number
}

/**
 * Strongest first, which is the order the page draws them in.
 *
 * These are the same for every pocket pair, deuces to aces. That is not
 * obvious, so it is a test rather than a remark.
 */
export const FLOP_OUTCOMES: readonly FlopOutcome[] = [
  {
    hand: 'Four of a Kind',
    what: 'Both of the remaining cards of your rank arrive at once.',
    flops: 48,
  },
  {
    hand: 'Full House',
    what: 'Your set with the board paired beside it, or the board comes three of a kind and your pair fills it.',
    flops: 192,
  },
  {
    hand: 'Three of a Kind',
    what: 'A set. The one you were waiting for.',
    flops: 2_112,
  },
  {
    hand: 'Two Pair',
    what: 'The board pairs. Your pair is still just your pair, with company.',
    flops: 3_168,
  },
  {
    hand: 'Pair',
    what: 'The flop did not touch you at all.',
    flops: 14_080,
  },
]

/**
 * Flops containing at least one of the two remaining cards of your rank.
 *
 * This is the number every poker site quotes, and it counts cards rather than
 * hands: 2,304 of 19,600, which rounds to the familiar 11.8%.
 */
export const FLOPS_WITH_YOUR_RANK = 2_304

/**
 * Flops where you actually hold three of a kind or better once the hand is
 * graded. Larger than the number above, and exactly 12% of 19,600.
 */
export const FLOPS_SET_OR_BETTER = 2_352

/**
 * The gap between the two, and the reason there is one: the board comes three
 * of a kind on its own, which is a full house for a pocket pair without a card
 * of its rank in the flop. 12 other ranks x C(4,3).
 */
export const FLOPS_BOARD_TRIPS = 48

/** A count of flops as a share of all of them, e.g. '10.78%'. */
export function flopShare(flops: number): string {
  return `${((flops / FLOPS) * 100).toFixed(2)}%`
}

/**
 * A count of flops as "one in N", to one decimal place. The page says "about
 * one flop in 8.5" in prose and prints the same helper's output, so the two
 * cannot drift apart.
 */
export function oneFlopIn(flops: number): string {
  return (FLOPS / flops).toFixed(1)
}
