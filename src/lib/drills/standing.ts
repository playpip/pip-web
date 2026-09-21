import type { DrillKindId } from './types'
import {
  type FiveShape,
  type OutsShape,
  type PriceShape,
  type ReadShape,
  type SettledBy,
  type SpotKind,
  type StrengthShape,
  fiveDifficulty,
  outsDifficulty,
  priceDifficulty,
  readDifficulty,
  STARTING_RATING,
  spotDifficulty,
  strengthDifficulty,
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

const strengthShape = (settledBy: StrengthShape, label: string): SpotShape => ({
  settledBy,
  label,
  rating: strengthDifficulty(settledBy),
})

/**
 * The shapes "hand strength" deals, easiest first.
 *
 * The ladder here is whether the hand that is winning on the flop is the hand
 * that gets there. The first two rungs are margins and the third is not: it is
 * the spot where reading the made hands and stopping gives the wrong answer,
 * which is the reading the kind exists to teach.
 */
const HAND_STRENGTH: SpotShape[] = [
  strengthShape('clear-favourite', 'flops with a clear favourite'),
  strengthShape('live-underdog', 'flops where the hand behind is still live'),
  strengthShape('draw-is-favourite', 'flops where the best hand is not the favourite'),
]

const readShape = (settledBy: ReadShape, label: string): SpotShape => ({
  settledBy,
  label,
  rating: readDifficulty(settledBy, false),
})

/**
 * The shapes "what have you got" deals, easiest first.
 *
 * The ladder here is how much of the hand is yours, for the reason set out on
 * {@link ReadShape}: naming two pair when both your cards are in it is the read
 * everybody makes, and naming it when the board has it on its own is the read
 * almost nobody does. The rungs are stated as what you can do rather than as
 * what a spot is, because this is the ladder a beginner is standing on.
 */
const WHATS_YOUR_HAND: SpotShape[] = [
  readShape('uses-both', 'hands built from both your cards'),
  readShape('uses-one', 'hands where only one of your cards counts'),
  readShape('plays-the-board', 'boards that play on their own'),
]

const fiveShape = (settledBy: FiveShape, label: string): SpotShape => ({
  settledBy,
  label,
  rating: fiveDifficulty(settledBy),
})

/**
 * The shapes "which five play" deals, easiest first.
 *
 * The ladder here is how much choosing there is once the hand has been read: a
 * straight is five cards and there is nothing to decide, a pair is two and the
 * other three are the highest left, and a board that plays on its own is the
 * one where the right answer means letting go of both your cards.
 */
const WHICH_FIVE_PLAY: SpotShape[] = [
  fiveShape('made-five', 'hands that use all five cards'),
  fiveShape('kickers-matter', 'hands where the kickers decide'),
  fiveShape('board-plays', 'boards that play on their own'),
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
  'whats-your-hand': WHATS_YOUR_HAND,
  'which-five-play': WHICH_FIVE_PLAY,
  'which-hand-wins': WHICH_HAND_WINS,
  'count-your-outs': COUNT_YOUR_OUTS,
  'pot-odds': POT_ODDS,
  'hand-strength': HAND_STRENGTH,
}

/** The shapes this kind deals, easiest first, or null if it has no ladder. */
export function spotLadder(kind: DrillKindId): SpotShape[] | null {
  return LADDERS[kind]
}

/**
 * The bottom of a kind's ladder: what its easiest shape is rated.
 *
 * Where a player who has never answered one of these is met — see `aimFor` in
 * ./rating, which walks from here to the rating as the record fills in. Read
 * off the ladder rather than written down again, so a kind whose shapes are
 * ever re-rated from real accuracy moves its own floor with them.
 *
 * `STARTING_RATING` is the answer for a kind with no ladder, because a kind
 * with no shapes has no easy end to open at and aiming at where everybody
 * starts is the same as not aiming.
 */
export function kindFloor(kind: DrillKindId): number {
  return spotLadder(kind)?.[0]?.rating ?? STARTING_RATING
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

/** How many levels a kind's difficulty is said in. */
export const DIFFICULTY_LEVELS = 5

/**
 * The thresholds between those levels, on the spots' own rating scale.
 *
 * A kind sits at level 1 while the middle of its ladder is under the first
 * number, level 2 under the second, and so on. They are 150 apart, which is
 * roughly the gap between two rungs of any one kind's ladder — so a kind has to
 * be about a whole shape harder than another to be shown as harder.
 *
 * **Where they start is chosen so the two easiest kinds are told apart**, and
 * that is the reader this is for: somebody standing in front of six tiles
 * deciding which to open first is best served by the bottom of the ladder being
 * legible, and least served by both of its rungs showing one pip. The six kinds
 * currently fall 1, 2, 3, 4, 4, 5.
 */
const DIFFICULTY_AT: readonly number[] = [850, 1_000, 1_150, 1_250]

/**
 * How hard this kind is, 1 to {@link DIFFICULTY_LEVELS}.
 *
 * **Read off the ratings the spots already carry, not asserted.** The middle of
 * a kind's ladder — halfway between its easiest shape and its hardest — is the
 * spot a player meets once they have settled on it, and comparing that number
 * between kinds is the same comparison Elo makes everywhere else in this
 * folder. Re-rate a shape and this moves with it.
 *
 * The midpoint rather than the floor, because the floor misranks: the flop kind
 * opens easier than counting outs and finishes far harder, and a player asking
 * "how hard is this one" is asking about the whole of it.
 *
 * **It is a comparison between these kinds, not a claim about poker.** Two
 * kinds can share a level, and they do: the two reading kinds both sit at 1,
 * which is the honest picture of a room whose easy end is two drills and whose
 * next step up is a long one.
 */
export function kindDifficulty(kind: DrillKindId): number {
  const ladder = spotLadder(kind)
  if (!ladder || ladder.length === 0) return 1
  const middle = (ladder[0].rating + ladder[ladder.length - 1].rating) / 2
  return DIFFICULTY_AT.filter((at) => middle >= at).length + 1
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
