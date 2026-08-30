import { BET_SIZES, pct, requiredEquity } from '@/config/potOdds'
import { type Card, mulberry32 } from '@/lib/poker/cards'
import { determineWinners } from '@/lib/poker/handEval'
import { formatChips } from '@/lib/useMoney'
import { type PriceShape, priceDifficulty } from './rating'
import { HERO, UNSEEN, VILLAIN, dealTurn, faceUpHands } from './turnSpot'
import { type DrillChoice, type Generated, accept, reject } from './types'

// The membership's second kind: the same turn spot as counting outs with a
// price on it. They have bet, both hands are face up, one card is to come, and
// the only question is whether the pot is laying you enough.
//
// **Exact, like both kinds before it.** The spec had this graded by
// `estimateEquity` (technology#55), and the first equity-graded thing in the app
// should not be the thing people pay for. It does not have to be: one card to
// come against a hand you can see is 44 showdowns, so the equity here is
// counted rather than sampled. Same answer as a million simulations would
// eventually give, no tolerance, and nothing that can mark a correct call
// wrong. The price is a fraction and was always exact.
//
// **The two numbers come from one place each.** What the hand gets there is the
// enumeration below; what the pot is charging is `requiredEquity` from
// config/potOdds, which is the same function /learn/pot-odds prints its table
// from. A player who reads the guide and then plays the drill is being taught
// and graded by one definition of a price, and the guide's tests pin it.
//
// **`membersOnly` lives in config/drills.ts and had to be there in the commit
// that registered this kind** (technology#55). A paid kind that ships without
// it is free forever by rule #8.

/**
 * How far apart the two numbers must be, in points, for the spot to be asked at
 * all.
 *
 * Under this the two answers are worth the same to within a rounding, and a
 * player who folds a call that was right by three points has not misread
 * anything. The spec's number, and it is a judgement that wants play-testing
 * rather than theory: the equity is exact, so this is not a tolerance on a
 * noisy estimate, it is a statement about which questions are fair.
 */
const MARGIN = 4

/**
 * And how far apart they may be before the spot stops being a question.
 *
 * A call that is right by thirty points is right whether or not you counted
 * anything, so it teaches nothing and rates nobody. Same instinct as the
 * ranking kind's `one-sided`: a spot you can answer by looking is a look.
 */
const MAX_GAP = 20

/**
 * The pots a spot can be played for. Multiples of 60, so that every bet size
 * below lands on a whole chip and the price the player is shown is exactly the
 * price they are graded against.
 */
const POTS = [120, 180, 240, 360, 480, 600, 900, 1200, 1800] as const

/**
 * The bets a spot can be facing, as a fraction of the pot before it.
 *
 * The seven from `config/potOdds` — the sizes /learn/bet-sizing teaches — plus
 * two small stabs and one between half and two-thirds. **The extra three are
 * not a second opinion about bet sizing**, which is why the prices they set are
 * still `requiredEquity`'s and not this file's: they exist because the guide's
 * ladder starts at a quarter pot, and a hand with eight outs cannot be priced
 * as a call by any bet on it. Without them this kind would only ever deal the
 * big draws, and the eight-out straight draw is the spot the whole lesson is
 * usually taught with.
 */
const FRACTIONS = [1 / 6, 1 / 5, 2 / 5, ...BET_SIZES.map((size) => size.fraction)].sort(
  (a, b) => a - b,
)

/** One card to come, and what it does for the hero. */
interface Enumerated {
  /** Rivers the hero wins outright. */
  wins: number
  /** Rivers that split the pot. Any at all and the spot is thrown away. */
  chops: number
}

/**
 * Deal every card that is left, one at a time, and read the showdown.
 *
 * One pass, and both the grade and the sentence read it. Identical in shape to
 * the counting kind's enumeration and deliberately not shared with it: that one
 * also reads what each winning card *makes*, because its sentence names the
 * draws, and this one has no use for the phrases. Sharing would mean doing the
 * expensive half of that work on every spot here to throw it away.
 */
function enumerateRivers(hero: Card[], villain: Card[], board: Card[], rest: Card[]): Enumerated {
  const contenders = [
    { id: HERO, hole: hero },
    { id: VILLAIN, hole: villain },
  ]
  const enumerated: Enumerated = { wins: 0, chops: 0 }

  for (const card of rest) {
    const { winners } = determineWinners(contenders, [...board, card])
    if (winners.length > 1) enumerated.chops++
    else if (winners[0] === HERO) enumerated.wins++
  }

  return enumerated
}

/** A price this pot could be charging, and what it would take to call it. */
interface Price {
  /**
   * The bet, in chips. A whole number of them, and every pot above is a
   * multiple of 60 so that rounding it never has anything to do: a bet of
   * 199.99999999 chips would be shown as 200 and graded as neither.
   */
  toCall: number
  /** The pot as the table shows it: what was there, plus their bet. */
  pot: number
  /** The share of the pot you have to win for calling to break even. */
  required: number
}

const pricesFor = (potBefore: number): Price[] =>
  FRACTIONS.map((fraction) => {
    const toCall = Math.round(potBefore * fraction)
    return {
      toCall,
      pot: potBefore + toCall,
      // From the guide's own function rather than from the two numbers above.
      // `toCall / (pot + toCall)` is the same fraction and a test holds the two
      // together to the chip; taking it from there means the drill and
      // /learn/pot-odds cannot come to different answers about the same bet.
      required: requiredEquity(fraction),
    }
  })

/**
 * Generate the spot at `seed`, or say why it was thrown away.
 *
 * **A spot survives only if the price could have made it either answer**, and
 * that is the load-bearing rule in this file. The cards come out of the shuffle
 * and are never chosen; the size of the bet is, which in a real hand is chosen
 * by the opponent anyway. So the filter keeps the hands that some bet this pot
 * could carry would make a call and some other bet would make a fold, and then
 * a coin decides which of the two this spot is.
 *
 * Two things fall out of that, and both are the point:
 *
 * 1. **The answers are half calls and half folds**, so answering "fold" to
 *    everything scores what a coin scores. Priced at random instead, four
 *    accepted spots in five are folds — honest about the population of poker
 *    hands, and useless as a drill, because the rating would be reading who had
 *    noticed the habit rather than who can count.
 * 2. **Every spot is one the price decides.** A hand with three outs is a fold
 *    against any bet anybody would make, so it is not asked here. That is the
 *    same ruling as the ranking kind's `one-sided`: a spot you can answer
 *    without reading it is a look, not a question.
 */
export function generatePotOdds(seed: number): Generated {
  const { hero, villain, board, rest } = dealTurn(seed)

  // You are the one drawing, on every spot this kind deals. A hand that is
  // already in front is not a price to read: it wins unless it is caught, so no
  // bet anybody would make could turn it into a fold, and it would be thrown
  // away below anyway. Rejecting it here rather than there is worth the line —
  // it is half of all deals, and it costs one showdown to see instead of 44.
  const turn = determineWinners(
    [
      { id: HERO, hole: hero },
      { id: VILLAIN, hole: villain },
    ],
    board,
  )
  if (turn.winners.includes(HERO)) return reject('already-ahead')

  const { wins, chops } = enumerateRivers(hero, villain, board, rest)
  // A river that splits the pot is half an out, and whether half an out is an
  // out is a real disagreement between reasonable players. Same ruling as the
  // counting kind: the spot goes in the bin rather than the player being marked
  // wrong for the other reading.
  if (chops > 0) return reject('chop-possible')
  // Nothing wins it, so there is nothing to price. True and useful about a hand
  // and a bad question: "fold" is right without reading anything.
  if (wins === 0) return reject('drawing-dead')

  const equity = wins / UNSEEN

  // A second stream, seeded from the spot's own seed, so the pot and the bet
  // are as reproducible as the cards and still independent of the shuffle that
  // dealt them.
  const rng = mulberry32((seed ^ 0x5f37_59df) >>> 0)
  const potBefore = POTS[Math.floor(rng() * POTS.length)]

  const gapOf = (price: Price) => Math.abs(equity - price.required) * 100
  const prices = pricesFor(potBefore)
  const askable = prices.filter((price) => {
    const gap = gapOf(price)
    return gap >= MARGIN && gap <= MAX_GAP
  })
  const calls = askable.filter((price) => equity > price.required)
  const folds = askable.filter((price) => price.required > equity)

  if (calls.length === 0 || folds.length === 0) {
    // The hand cannot be asked both ways at this pot. Either the bets that
    // would ask the missing half are too close to the hand to be fair, or there
    // are none: nothing anybody would bet turns this hand into that answer.
    const missing =
      calls.length === 0
        ? prices.filter((price) => equity > price.required)
        : prices.filter((price) => price.required > equity)
    return reject(missing.some((price) => gapOf(price) < MARGIN) ? 'ambiguous' : 'one-sided')
  }

  const wantsCall = rng() < 0.5
  const side = wantsCall ? calls : folds
  const price = side[Math.floor(rng() * side.length)]
  const answer = wantsCall ? 'call' : 'fold'
  const choices: DrillChoice[] = [
    { id: 'call', label: 'Call', cards: [], winning: answer === 'call' },
    { id: 'fold', label: 'Fold', cards: [], winning: answer === 'fold' },
  ]

  return accept({
    kind: 'pot-odds',
    seed,
    board,
    choices,
    hands: faceUpHands(hero, villain, board),
    stakes: { pot: price.pot, toCall: price.toCall },
    answer,
    settledBy: shapeOf(gapOf(price)),
    difficulty: priceDifficulty(shapeOf(gapOf(price))),
    explanation: explain(wins, equity, price),
  })
}

/** How much room there was between the two numbers. See {@link PriceShape}. */
function shapeOf(gap: number): PriceShape {
  return gap < 7 ? 'thin-price' : gap < 11 ? 'close-price' : 'clear-price'
}

/**
 * The one sentence, out of the same enumeration and the same fraction that set
 * the answer.
 *
 * Three numbers in the order they are useful: what gets there, what that is as
 * a percentage, and what the pot is charging. Then the comparison, said as a
 * comparison. It never says "you should have" and it never says "wrong": the
 * player is told the two numbers and can see for themselves which is bigger,
 * which is Build 2's register and the reason drills grade with arithmetic
 * instead of an opinion.
 *
 * No "about" anywhere, unlike the coach's version of this sentence. That one
 * says "about" because it is reading fifteen hundred simulations; this one
 * counted all 44 cards, and hedging an exact number would be the first
 * dishonest thing in the feature in the other direction.
 */
function explain(wins: number, equity: number, price: Price): string {
  const head =
    wins === 1
      ? `One of the ${UNSEEN} cards left wins it for you`
      : `${wins} of the ${UNSEEN} cards left win it for you`
  const call = `calling ${formatChips(price.toCall)} to win ${formatChips(price.pot)} needs ${pct(price.required)}%`
  const verdict =
    equity > price.required ? 'Enough, so it is a call.' : 'Not enough, so it is a fold.'
  return `${head}, which is ${pct(equity)}%, and ${call}. ${verdict}`
}
