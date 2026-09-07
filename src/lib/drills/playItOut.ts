import { BET_SIZES, pct } from '@/config/potOdds'
import { type Card, mulberry32, shuffledDeck } from '@/lib/poker/cards'
import { estimateEquity } from '@/lib/poker/equity'
import { evaluateHand, handPhrase } from '@/lib/poker/handEval'
import { formatChips } from '@/lib/useMoney'
import { type PriceShape, priceDifficulty } from './rating'
import type { Drill, DrillChoice } from './types'

// The "play it out" mode: one hand, dealt once, priced street by street against
// a range instead of against a hand you can see.
//
// **It is a mode of `pot-odds`, not a fifth kind** (RULED technology#86,
// 2026-09-06). Every street it grades carries `kind: 'pot-odds'`, so it
// inherits `membersOnly` from that kind's registry entry, adds no row to
// `LADDERS`, adds no `RejectReason`, and rule #8's free-forever exposure never
// comes up. Nothing here is registered anywhere.
//
// **Why it is not graded against the bot.** The spec's original row wanted a
// street played out against `decideAction`. The policy cannot be an answer key:
// asked about the identical `HandState` twelve times it gives more than one
// answer on 82.5% of postflop spots and flips between folding and continuing on
// 81.7% (n=120 per venue, 2026-09-02, `pip-web` #111). The jitter is what makes
// the bots feel human, so it is not going away. The price is the answer key
// instead, and on the 46 spots where the policy was stable it never disagreed
// with the price.
//
// **This is the first paid grade that comes off a sampled number**, and the
// whole of the care in this file is about that. The three shipped kinds count:
// both hands are face up, so 44 or 990 showdowns settle them exactly and no
// tolerance exists that could mark a correct answer wrong. A hand played out
// against a *range* cannot be counted, so the equity is `estimateEquity` and it
// arrives with a band on it. See MARGIN.

/**
 * How many simulations settle one street.
 *
 * The ruling's number, and the direction of travel is up: the band this buys
 * has to stay small against MARGIN, so lowering it is a change to the grade
 * rather than a performance tweak. `tests/playItOut.test.ts` fails the build if
 * the two stop being safe together.
 */
export const ITERATIONS = 20_000

/**
 * The most a sampled equity can be out by, in points, at 95%.
 *
 * One iteration returns a share of one pot, in [0, 1], so the standard error of
 * the mean is at most `0.5 / sqrt(iterations)` whatever the ranges, the board
 * or the opponent do. That is a bound rather than a fit, which is what makes it
 * safe to build a margin on: it cannot be wrong in our favour.
 *
 * Measured at 20,000 iterations over 20 rng seeds on one spot, the observed
 * standard deviation is 0.26 points on a flop and 0.28 on a turn, against the
 * bound's 0.35. The bound is doing what a bound should.
 */
export const BAND = 1.96 * (50 / Math.sqrt(ITERATIONS))

/**
 * The face-up kinds' margin: under four points apart, calling and folding are
 * worth the same to within a rounding and the spot is not a fair question.
 *
 * Imported as a number rather than from `potOdds.ts` because it means something
 * slightly different here: there it is the whole margin, here it is the part of
 * the margin that is about the question rather than about the estimate.
 */
export const FAIR_QUESTION = 4

/**
 * How far apart the two numbers must be, in points, for a street to be asked.
 *
 * **The face-up margin plus room for the band, written as that sum rather than
 * as a 6**, because the relationship is the whole point and a bare constant
 * loses it. The ruling was explicit that the iterations are the budget and the
 * margin is not the knob: a street accepted at a measured gap of six has a true
 * gap of at least `6 - BAND`, which is still clear of FAIR_QUESTION. Tuning
 * this down to buy back some iterations is how a correct answer gets marked
 * wrong.
 *
 * The visible cost is that this mode cannot ask the thinnest questions the
 * face-up kind can, so it deals `thin-price` spots (a gap under seven) through
 * a sliver rather than a band. That is honest: the estimate is not precise
 * enough to grade a three-point edge, so it does not pretend to.
 */
export const MARGIN = FAIR_QUESTION + 2

/** And how far apart before a street stops being a question. The face-up number. */
const MAX_GAP = 20

/**
 * How tight the opponent's range is, in `estimateEquity`'s terms.
 *
 * One constant, and it is part of the question rather than a hidden variable:
 * the player is told they are up against someone who keeps betting, and this is
 * what that means numerically. Drawing it per hand from the seed would move the
 * answer by something nobody on the screen can see.
 */
const SELECTIVITY = [0.5] as const

/** The pot a hand starts on, before a chip of it is contested. Multiples of 60. */
const STARTING_POTS = [120, 180, 240, 360, 480, 600] as const

/**
 * The bets a street can be facing, as a fraction of the pot before it.
 *
 * The same ladder as the face-up kind, and for the same reason: the guide's
 * sizes start at a quarter pot, and without the three small ones below it a
 * hand that is a modest favourite could not be priced as a fold by any bet.
 */
const FRACTIONS = [1 / 6, 1 / 5, 2 / 5, ...BET_SIZES.map((size) => size.fraction)].sort(
  (a, b) => a - b,
)

/** Which streets a hand is played through, and how much board each one shows. */
const STREETS = [
  { id: 'flop', cards: 3 },
  { id: 'turn', cards: 4 },
  { id: 'river', cards: 5 },
] as const

export type StreetId = (typeof STREETS)[number]['id']

/** One street of a played-out hand. */
export interface PlayedStreet {
  street: StreetId
  /** The board as it stands here: three cards, then four, then five. */
  board: Card[]
  /**
   * The decision, or `null` where there is nothing to ask.
   *
   * A street is only a question if some bet this pot could carry makes it a
   * call and some other bet makes it a fold. Where neither exists the opponent
   * checks and the hand moves on, which is also what poker does: not every
   * street is a decision, and inventing one on a hand that has no price in it
   * would be the generator asking a question it made up.
   */
  drill: Drill | null
  /** The pot once this street is settled, whether it was called or checked through. */
  potAfter: number
}

/** A hand to play out: dealt once, scripted, and reproducible from its seed. */
export interface PlayedHand {
  seed: number
  /** The hero's two cards. The opponent has a range, not a hand. */
  hole: Card[]
  /** What the hero holds right now, e.g. "Pair". Absent when it is high card. */
  detail?: string
  /** All three streets, in order. Folding ends the hand early; the script does not. */
  streets: PlayedStreet[]
}

export interface GeneratedHand {
  hand: PlayedHand | null
  rejected: 'one-sided' | 'ambiguous' | null
}

/** A price this pot could be charging, and what it would take to call it. */
interface Price {
  toCall: number
  /** The pot as the table shows it: what was there, plus their bet. */
  pot: number
  /** The share of the pot you have to win for calling to break even. */
  required: number
}

/**
 * Every price this pot could be offering.
 *
 * `required` is derived from the **rounded chips** rather than from the nominal
 * fraction, which is the one place this file departs from the face-up kind. It
 * has to: there the pot is always a multiple of 60 so the rounding never has
 * anything to do, and here the pot grows by two called bets a street and stops
 * being round after the first one. It is `requiredEquity`'s own arithmetic
 * applied to the bet the player is actually shown, so the drill and
 * /learn/pot-odds still hold one definition of a price between them, and a test
 * pins the two together.
 */
const pricesFor = (potBefore: number): Price[] =>
  FRACTIONS.map((fraction) => {
    const toCall = Math.max(1, Math.round(potBefore * fraction))
    return {
      toCall,
      pot: potBefore + toCall,
      required: toCall / (potBefore + 2 * toCall),
    }
  })

/**
 * Deal a hand at `seed`, price each street against the range, and keep it if
 * any street is a fair question.
 *
 * The whole hand is settled here, before a card is on the screen. That is the
 * same contract the four kinds have — same seed, same spot, same grade, forever
 * — and it is what makes a played-out hand gradeable at all: every continuation
 * is the same line (you called), so the only branch is folding, and folding
 * ends the hand. There is nothing about a later street that depends on anything
 * but the seed.
 */
export function generatePlayedHand(seed: number): GeneratedHand {
  const deck = shuffledDeck(mulberry32(seed))
  const hole = deck.slice(0, 2)
  const full = deck.slice(4, 9)

  // A second stream, seeded from the spot's own seed, so the pots and the bets
  // are as reproducible as the cards and still independent of the shuffle.
  const rng = mulberry32((seed ^ 0x5f37_59df) >>> 0)
  let pot: number = STARTING_POTS[Math.floor(rng() * STARTING_POTS.length)]

  const streets: PlayedStreet[] = []
  let asked = 0
  let missedByMargin = false

  for (const [index, street] of STREETS.entries()) {
    const board = full.slice(0, street.cards)
    const { equity } = estimateEquity({
      hole,
      community: board,
      opponents: 1,
      opponentSelectivity: SELECTIVITY,
      iterations: ITERATIONS,
      // Salted per street so the three readings of one hand are independent,
      // and derived from the seed so they are the same three every time.
      rng: mulberry32((seed + 0x9e37_79b9 * (index + 1)) >>> 0),
    })

    const prices = pricesFor(pot)
    const gapOf = (price: Price) => Math.abs(equity - price.required) * 100
    const askable = prices.filter((price) => {
      const gap = gapOf(price)
      return gap >= MARGIN && gap <= MAX_GAP
    })
    const calls = askable.filter((price) => equity > price.required)
    const folds = askable.filter((price) => price.required > equity)

    if (calls.length === 0 || folds.length === 0) {
      // Nothing this pot could bet asks this street both ways, so there is no
      // fair question here. The opponent checks and the hand moves on.
      const missing =
        calls.length === 0
          ? prices.filter((price) => equity > price.required)
          : prices.filter((price) => price.required > equity)
      if (missing.some((price) => gapOf(price) < MARGIN)) missedByMargin = true
      streets.push({ street: street.id, board, drill: null, potAfter: pot })
      continue
    }

    const wantsCall = rng() < 0.5
    const side = wantsCall ? calls : folds
    const price = side[Math.floor(rng() * side.length)]
    const answer = wantsCall ? 'call' : 'fold'
    const shape = shapeOf(gapOf(price))
    const choices: DrillChoice[] = [
      { id: 'call', label: 'Call', cards: [], winning: answer === 'call' },
      { id: 'fold', label: 'Fold', cards: [], winning: answer === 'fold' },
    ]

    streets.push({
      street: street.id,
      board,
      drill: {
        kind: 'pot-odds',
        seed,
        board,
        choices,
        hands: [{ label: 'You', cards: hole, ...detailOf(hole, board) }],
        stakes: { pot: price.pot, toCall: price.toCall },
        answer,
        settledBy: shape,
        difficulty: priceDifficulty(shape),
        explanation: explain(equity, price),
      },
      // Both bets go in: theirs, and the call the script is written around.
      potAfter: pot + 2 * price.toCall,
    })
    pot += 2 * price.toCall
    asked++
  }

  if (asked === 0) {
    // A hand with no decision in it is not a hand to play out. Which of the two
    // reasons it is says whether the prices were too close to be fair or were
    // never there at all, and that is the same distinction the face-up kind
    // draws with the same two words.
    return { hand: null, rejected: missedByMargin ? 'ambiguous' : 'one-sided' }
  }

  return {
    hand: { seed, hole, ...detailOf(hole, full.slice(0, 3)), streets },
    rejected: null,
  }
}

/**
 * How many seeds `nextPlayedHand` walks before it gives up.
 *
 * An order of magnitude below the kinds' MAX_ATTEMPTS, because a seed costs
 * three `estimateEquity` calls here rather than 44 showdowns: giving up early
 * and loudly beats grinding for a minute behind a spinner. Hitting it means the
 * filter has started rejecting everything, and throwing is the honest answer.
 */
export const MAX_HAND_ATTEMPTS = 50

/** The first hand at or after `seed` with a decision in it. */
export function nextPlayedHand(seed: number): PlayedHand {
  for (let attempt = 0; attempt < MAX_HAND_ATTEMPTS; attempt++) {
    const { hand } = generatePlayedHand((seed + attempt) >>> 0)
    if (hand) return hand
  }
  throw new Error(`No played hand in ${MAX_HAND_ATTEMPTS} seeds from ${seed}`)
}

/** How much room there was between the two numbers. Shared with the face-up kind. */
function shapeOf(gap: number): PriceShape {
  return gap < 7 ? 'thin-price' : gap < 11 ? 'close-price' : 'clear-price'
}

const detailOf = (hole: Card[], board: Card[]) => {
  const phrase = handPhrase(evaluateHand(hole, board))
  return phrase ? { detail: phrase[0].toUpperCase() + phrase.slice(1) } : {}
}

/**
 * The one sentence, out of the same estimate and the same price that set the
 * answer.
 *
 * **It says "about", and the face-up kind's sentence deliberately does not.**
 * That one counted all 44 cards, so hedging an exact number would be the
 * dishonest thing in the other direction. This one is reading twenty thousand
 * simulations against a range, and a number that arrives with a band on it
 * should be said as one. It is the same reason `lib/coach.ts` says "about".
 *
 * It never says "you should have" and never says "wrong": the player gets the
 * two numbers and can see which is bigger.
 */
function explain(equity: number, price: Price): string {
  const head = `Against the hands they keep betting here you win about ${pct(equity)}%`
  const call = `calling ${formatChips(price.toCall)} to win ${formatChips(price.pot)} needs ${pct(price.required)}%`
  const verdict =
    equity > price.required ? 'Enough, so it is a call.' : 'Not enough, so it is a fold.'
  return `${head}, and ${call}. ${verdict}`
}
