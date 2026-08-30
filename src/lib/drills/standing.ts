import type { DrillKindId } from './types'
import {
  type OutsShape,
  type PriceShape,
  type SettledBy,
  type SpotKind,
  outsDifficulty,
  priceDifficulty,
  spotDifficulty,
} from './rating'

// What the rating means, said in words.
//
// The rating is on the same scale as the spots (see ./rating), and that is not
// a detail of the arithmetic, it is the whole reason the number can be read at
// all. A rating of 1,100 is not a score out of anything: it says that a spot
// rated 1,100 is a coin flip for you, that everything below it is more likely
// right than wrong, and that everything above it is the other way round. Elo's
// own identity, and the one property that turns a bare number into a fact about
// what somebody can do.
//
// So this file is the ladder of shapes a spot can come in, and one reading of
// where a rating sits on it. **It measures nothing new.** Every number here is
// already on the profile; what did not exist was anywhere to see it, and a
// four-digit number with no unit on a tile is not somewhere.
//
// **Still a mirror, and the constraints are the same ones the rating carries.**
// Nothing here reads the clock (there is no "you have not played since"), and
// nothing here is a target: the ladder is a description of the spots, not a
// course to complete, and a player who never clears the top of it has lost
// nothing. The next shape up is named because it is the honest answer to "what
// is this number", not to give anybody something to be behind on.

/** One shape a spot can come in, and what that shape is worth. */
export interface SpotShape {
  /** How the engine settled it. The shape's id. */
  settledBy: SpotKind
  /**
   * What the shape is called in a sentence to a player.
   *
   * Plural, lower case, and readable in the middle of a line: these are dropped
   * into copy rather than used as headings.
   */
  label: string
  /**
   * What this shape is rated with no decoy on it.
   *
   * The plain version on purpose. A decoy spot (the losing hand holding the
   * higher card) is rated higher than its shape, so reading the ladder off the
   * base is the cautious direction to be wrong in: it says you are better than
   * even on the ordinary version of this shape, and stays quiet about the mean
   * one.
   */
  rating: number
}

const shape = (settledBy: SettledBy, label: string): SpotShape => ({
  settledBy,
  label,
  rating: spotDifficulty(settledBy, false),
})

/**
 * The shapes "which hand wins" deals, easiest first.
 *
 * The order is the defensible part and the numbers under it are a judgement
 * about the spots rather than a measurement of players, which is said at
 * length in ./rating. If those numbers are ever re-derived from real accuracy,
 * this ladder moves with them for free, because it reads them rather than
 * repeating them.
 */
const WHICH_HAND_WINS: SpotShape[] = [
  shape('category', 'the hand rankings'),
  shape('rank', 'the same hand on both sides'),
  shape('kicker', 'kickers'),
  shape('split', 'split pots'),
]

const outsShape = (settledBy: OutsShape, label: string): SpotShape => ({
  settledBy,
  label,
  rating: outsDifficulty(settledBy, false),
})

/**
 * The shapes "count your outs" deals, easiest first.
 *
 * The ladder here is how many different hands get you there rather than how
 * many cards do, for the reason set out on {@link OutsShape}: counting nine
 * hearts is one thing to see, and counting nine hearts plus three sevens is two
 * things to see and then add up without counting a card twice.
 */
const COUNT_YOUR_OUTS: SpotShape[] = [
  outsShape('one-draw', 'spots with one way to get there'),
  outsShape('two-draws', 'spots with two draws at once'),
  outsShape('many-draws', 'spots with three or more draws at once'),
]

const priceShape = (settledBy: PriceShape, label: string): SpotShape => ({
  settledBy,
  label,
  rating: priceDifficulty(settledBy),
})

/**
 * The shapes "pot odds" deals, easiest first.
 *
 * The ladder here is how much room there was between what the hand gets there
 * and what the pot was charging, for the reason set out on {@link PriceShape}:
 * a call that is right by twenty points is right whether or not you counted,
 * and one that is right by five is only right if you did.
 */
const POT_ODDS: SpotShape[] = [
  priceShape('clear-price', 'clear prices'),
  priceShape('close-price', 'close prices'),
  priceShape('thin-price', 'the closest prices'),
]

/**
 * Every kind's ladder, or an explicit `null` for a kind that has none.
 *
 * Keyed by `DrillKindId` so that the day a second kind is registered this file
 * stops compiling until somebody decides which it is. A shared ladder would be
 * the wrong default: the shapes are a property of what a kind asks, and a kind
 * that grades pot odds is not settled by a kicker. `null` is a real answer and
 * costs the kind nothing but this line of prose.
 */
const LADDERS: Record<DrillKindId, SpotShape[] | null> = {
  'which-hand-wins': WHICH_HAND_WINS,
  'count-your-outs': COUNT_YOUR_OUTS,
  'pot-odds': POT_ODDS,
}

/** The shapes this kind deals, easiest first, or null if it has no ladder. */
export function spotLadder(kind: DrillKindId): SpotShape[] | null {
  return LADDERS[kind]
}

/** Where a rating sits on a kind's ladder. */
export interface Standing {
  /**
   * The shapes at or below the rating: the ones that are better than even.
   * Easiest first, and empty for a rating below the whole ladder.
   */
  cleared: SpotShape[]
  /** The next shape up, or null when the rating is above all of them. */
  next: SpotShape | null
}

/**
 * Where this rating stands, or null for a kind with no ladder.
 *
 * "At or above" rather than "above" because equality is the coin flip, and
 * `expectedScore(r, r)` is exactly 0.5. Calling that better than even would be
 * a rounding in our favour on the one boundary the whole reading rests on, so
 * the boundary is drawn where Elo draws it and the copy says "better than even"
 * about the shapes strictly under the rating only.
 */
export function standingFor(kind: DrillKindId, rating: number): Standing | null {
  const ladder = spotLadder(kind)
  if (!ladder) return null
  const cleared = ladder.filter((s) => rating > s.rating)
  return { cleared, next: ladder.find((s) => rating <= s.rating) ?? null }
}

/**
 * One sentence about where a rating stands, or null if there is nothing honest
 * to say yet.
 *
 * The sentence never mentions a shape below the hardest one cleared. Listing
 * all four with ticks against them would make the ladder read as a checklist,
 * and a checklist is a thing you can be behind on. One line, two facts: the
 * hardest shape you read more often than not, and what the next one is.
 */
export function standingLine(kind: DrillKindId, rating: number): string | null {
  const standing = standingFor(kind, rating)
  if (!standing) return null
  const hardest = standing.cleared.at(-1)
  if (!hardest) {
    return standing.next ? `Next up: ${standing.next.label}.` : null
  }
  if (!standing.next) {
    // The hardest shape is named from the ladder rather than written into the
    // sentence. It used to say "split pots included", which was true of the only
    // kind there was and quietly wrong for the second one: a player at the top
    // of the outs ladder has never been asked about a split pot. Reading it off
    // `hardest` keeps the free kind's sentence identical, word for word, which
    // is what the pinned test in tests/drillStanding.test.ts is there to prove.
    return `You read every shape these spots come in more often than not, ${hardest.label} included.`
  }
  return `Better than even on ${hardest.label}. Next up: ${standing.next.label}.`
}

/**
 * Answers right, as a percentage, or null before there is one to take.
 *
 * Null rather than zero, for the reason the tile is blank before the first
 * answer: 0% is a statement about somebody who has played, and a player who has
 * not played has no accuracy. Rounded once, here, so that two surfaces showing
 * the same record cannot round it differently.
 */
export function drillAccuracy(record: { answered: number; correct: number }): number | null {
  if (record.answered === 0) return null
  return Math.round((record.correct / record.answered) * 100)
}
