// The rating: one number that says how well you read these spots, on the same
// scale as the spots themselves.
//
// **Why a rating rather than a streak.** Will asked for something that keeps a
// player coming back ("no score keeping, no rating, streaks or anything",
// 15 Aug) and there are two ways to build that. One is a clock: a daily streak,
// a goal, a thing you lose by not turning up. That is the exact chess.com
// behaviour this app is positioned against, and `lib/daily.ts` already refuses
// it ("no streaks, no history pressure"). The other is a mirror: a number that
// only ever reflects what you actually did, that moves both ways, and that is
// exactly where you left it whenever you come back. This is the mirror.
//
// So, three properties, and all three are held by a test rather than by this
// comment:
//
// 1. **Nothing here reads the clock.** No decay, no day, no "last played". A
//    rating cannot rot while you are away because nothing in the drills layer
//    can tell that you were away.
// 2. **Nothing here caps anything.** The rating is not a currency and not an
//    allowance; the free kind is unmetered by ruling (technology#38) and a
//    number on the screen must never become a number you run out of.
// 3. **The arithmetic is Elo and it is honest.** An easy spot answered right by
//    a strong player is worth nothing, and it says nothing rather than
//    inventing a point for turning up.

/** Where everybody starts, and roughly where a spot settled by the hand ranks sits. */
export const STARTING_RATING = 1000

/**
 * The rating cannot fall below this.
 *
 * Not a kindness, an honesty: below the floor the number stops carrying
 * information (it only means "answered a lot at random") and starts being a
 * thing to feel bad about. The ceiling is left open on purpose because the
 * spots supply their own: each kind's hardest spot is rated ({@link
 * HARDEST_SPOT} for the ranking spots, {@link HARDEST_OUTS} for counting), so
 * gains shrink to nothing above it on their own rather than by a rule.
 *
 * The floor is shared across kinds and the ceilings are not, which is the right
 * way round: the floor is a statement about a number carrying no information
 * any more, and that is true of any rating whatever earned it.
 */
export const RATING_FLOOR = 400

/**
 * How a "which hand wins" spot was settled, easiest first. This is the drill's
 * own reading of the hand, taken from the same evaluation that set the answer
 * and wrote the sentence, so the difficulty cannot disagree with the grade.
 *
 * - `category`: the two hands are different hands. You need the hand ranking.
 * - `rank`: the same hand twice, settled inside the made cards (the higher two
 *   pair, the bigger trips).
 * - `kicker`: the same hand twice, made of the same cards, settled by a kicker.
 *   The one people get wrong.
 * - `split`: neither is higher. The one people do not think to look for.
 */
export type SettledBy = 'category' | 'rank' | 'kicker' | 'split'

/**
 * How a "count your outs" spot is shaped, easiest first. Read off the same
 * enumeration that counted the outs and wrote the sentence, so, as above, the
 * difficulty cannot disagree with the grade.
 *
 * What makes counting hard is not how many outs there are, it is how many
 * different ways there are to get there. Nine hearts is one thing to see; nine
 * hearts *and* three sevens is two things to see and then add up without
 * counting a card twice.
 *
 * - `one-draw`: every card that wins makes you the same hand.
 * - `two-draws`: two different hands get you there, and they may overlap.
 * - `many-draws`: three or more. Rare, and the one nobody counts correctly.
 */
export type OutsShape = 'one-draw' | 'two-draws' | 'many-draws'

/**
 * How a "pot odds" spot is shaped, easiest first: how far apart what the hand
 * gets there and what the pot is charging turned out to be. Read off the same
 * enumeration and the same fraction that set the answer, so, as above, the
 * difficulty cannot disagree with the grade.
 *
 * What makes a price hard is not the size of the bet, it is how little room
 * there is between the two numbers. A quarter-pot bet with a flush draw is a
 * call you can make without arithmetic; the same draw against a pot-sized bet
 * is four points from being a fold and you have to actually count.
 *
 * - `clear-price`: 11 points or more between them.
 * - `close-price`: 7 to 11 points. Counting badly gets it wrong.
 * - `thin-price`: under 7, and never under the margin at which the spot is
 *   thrown away instead (see `RejectReason` in ./types).
 *
 * **The two boundaries were measured before they were chosen.** Over 6,000
 * seeds the gap has a median of 8.3 points and never exceeds 20, so 7 and 11
 * cut the spots roughly 27 / 43 / 30. Boundaries picked as round numbers
 * instead put four spots in five in one band, and a shape that nearly every
 * spot has is not a difficulty, it is a constant.
 */
export type PriceShape = 'clear-price' | 'close-price' | 'thin-price'

/**
 * Any spot's shape, whichever kind dealt it.
 *
 * One union rather than a field per kind, because everything downstream of a
 * spot (the rating arithmetic, the ladder, the record on the profile) cares
 * only that a spot has a shape and a number, never which kind's vocabulary the
 * shape is drawn from.
 */
export type SpotKind = SettledBy | OutsShape | PriceShape

/**
 * What each shape is rated.
 *
 * These are a judgement about the spots, not a measurement of players: nobody
 * has played this yet, so calibrating from real answers is not available and
 * pretending otherwise would be the invented-authority failure the whole build
 * avoids. The ordering is the defensible part and it is the part that matters
 * (a kicker asks more than a flush against a pair). Re-derive the numbers from
 * real accuracy per shape once there is any, and expect them to move.
 */
const BASE: Record<SettledBy, number> = {
  category: 820,
  rank: 1010,
  kicker: 1240,
  split: 1400,
}

/**
 * Added when the hand that loses holds the higher card, so the spot reads like
 * the wrong answer at a glance. The only adjustment there is, because it is the
 * only one that can be computed from the cards rather than asserted about them.
 */
const DECOY = 120

/** The least a spot can be rated. Two different hands, and the higher card wins. */
export const EASIEST_SPOT = BASE.category

/** The most a spot can be rated, and therefore where the rating flattens out. */
export const HARDEST_SPOT = BASE.split

/**
 * What each shape of an outs spot is rated.
 *
 * The same judgement, with the same caveat as {@link BASE}: the ordering is
 * defensible and the numbers are not measured, because nobody has answered one
 * of these yet. Re-derive them from real accuracy per shape once there is any.
 *
 * Pitched above the ranking spots on purpose. "Which hand wins" asks you to
 * read two finished hands; this asks you to read every card that has not come
 * yet and decide, one at a time, whether it wins. The floor here sits above the
 * floor there because there is no version of counting outs that is settled by
 * looking.
 */
const OUTS_BASE: Record<OutsShape, number> = {
  'one-draw': 950,
  'two-draws': 1180,
  'many-draws': 1380,
}

/**
 * Added when the cards that improve your hand and still lose are at least twice
 * as many as the cards that win.
 *
 * The one adjustment, and the same rule as {@link DECOY}: computed from the
 * cards rather than asserted about them. It is the miscount that actually costs
 * money at a table (counting every card that pairs you as an out when most of
 * them leave you second best), so a spot full of those is genuinely harder than
 * one where everything that helps you wins.
 *
 * **Twice is a judgement and it was measured before it was chosen.** Over 4,000
 * seeds the ratio of improve-but-lose cards to real outs has a median of 1.8, so
 * this threshold fires on about 44% of accepted spots. A looser rule fires on
 * nearly all of them and stops carrying information: "any card that improves you
 * and loses" is true of 99% of spots, which is a constant, not a difficulty.
 */
const TRAP = 140

/** The least an outs spot can be rated. One draw, and nothing much to mislead you. */
export const EASIEST_OUTS = OUTS_BASE['one-draw']

/** The most an outs spot can be rated. */
export const HARDEST_OUTS = OUTS_BASE['many-draws'] + TRAP

/**
 * What each shape of a pricing spot is rated.
 *
 * Same judgement, same caveat: the ordering is the defensible part and the
 * numbers are not measured, because nobody has answered one of these either.
 *
 * Pitched above both other kinds on purpose, and the reason is arithmetic
 * rather than taste. Counting the outs is the *first* half of one of these
 * spots: you then have to turn the count into a percentage and hold it against
 * a fraction of a pot. A player who can do the counting kind perfectly still
 * has a step left here, so the floor sits above that kind's floor.
 *
 * **No adjustment on top, and that is deliberate.** The other two kinds each
 * carry one (a decoy, a trap) because there was something computable about the
 * cards that made a spot harder than its shape. Here the gap between the two
 * numbers *is* that thing, and it is already the shape. A second adjustment
 * would be asserting something about the spot rather than reading it.
 */
const PRICE_BASE: Record<PriceShape, number> = {
  'clear-price': 1060,
  'close-price': 1280,
  'thin-price': 1460,
}

/** The least a pricing spot can be rated. Both numbers a long way apart. */
export const EASIEST_PRICE = PRICE_BASE['clear-price']

/** The most a pricing spot can be rated. */
export const HARDEST_PRICE = PRICE_BASE['thin-price']

/**
 * What this spot is worth. Splits take no decoy adjustment: with two winners
 * there is no losing hand to be misled by.
 */
export function spotDifficulty(settledBy: SettledBy, decoy: boolean): number {
  return BASE[settledBy] + (decoy && settledBy !== 'split' ? DECOY : 0)
}

/** What an outs spot is worth: its shape, plus the trap adjustment if it has one. */
export function outsDifficulty(shape: OutsShape, trap: boolean): number {
  return OUTS_BASE[shape] + (trap ? TRAP : 0)
}

/** What a pricing spot is worth. Its shape, and nothing else — see {@link PRICE_BASE}. */
export function priceDifficulty(shape: PriceShape): number {
  return PRICE_BASE[shape]
}

/** Elo's expectation: the share of spots at this difficulty you should get right. */
export function expectedScore(player: number, difficulty: number): number {
  return 1 / (1 + 10 ** ((difficulty - player) / 400))
}

/**
 * How far one answer can move the rating.
 *
 * High while the number means nothing, so the first twenty spots find roughly
 * the right level instead of grinding towards it, then settling so that a
 * distracted five minutes does not undo a month.
 */
export function kFactor(answered: number): number {
  if (answered < 15) return 48
  if (answered < 50) return 32
  return 20
}

/**
 * The rating after one answer. `answered` is the count *before* this spot.
 *
 * Rounded, floored, and deliberately capable of returning the number it was
 * given: an easy spot answered right by somebody well above it is worth a
 * fraction of a point, and rounding that to zero is the honest outcome. A
 * guaranteed +1 for every answer would make this a counter of how much you
 * played rather than a reading of how well, which is the whole distinction.
 */
export function nextRating(
  player: number,
  difficulty: number,
  correct: boolean,
  answered: number,
): number {
  const delta = kFactor(answered) * ((correct ? 1 : 0) - expectedScore(player, difficulty))
  return Math.max(RATING_FLOOR, Math.round(player + delta))
}
