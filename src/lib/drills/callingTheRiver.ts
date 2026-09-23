import { pct } from '@/config/potOdds'
import { mulberry32, shuffledDeck } from '@/lib/poker/cards'
import { formatChips } from '@/lib/useMoney'
import { type RiverShape, riverDifficulty } from './rating'
import {
  BLUFF_WEIGHTS,
  type Facing,
  type Line,
  TWO_PAIR,
  categoryOf,
  count,
  describe,
  fastScore,
  riverRange,
  weigh,
} from './riverRange'
import { holeStrength } from '@/lib/poker/range'
import {
  type DrillChoice,
  type DrillLineStep,
  type Generated,
  type RiverRangeSummary,
  accept,
  reject,
} from './types'

// The first practice pack: calling the river.
//
// They have bet the river and you have a hand. The board is finished, so there
// is nothing to draw to and nothing left to hope for: the only question is
// whether you win often enough, against the hands that bet like this, to pay
// what the pot is charging. It is the spot a beginner finds most alien
// (Will, 2026-09-23), because every other decision in poker has a card to come.
//
// **Graded exactly, against a range you can read.** The range is
// ./riverRange's model: the value half of what they could have, plus the hands
// that missed at a weight. Every hand in it is compared with yours once, so the
// equity is a fraction rather than an estimate and there is no sampling band to
// pay for. That is why the margin here is the face-up kinds' four points and
// not the play-it-out mode's six and a half.
//
// **The one thing the model cannot know is how often this player bluffs**, so
// the generator refuses to guess it. Every spot is priced three times — at the
// Garage's bluffing, the middle of the ladder's, and the top's (see
// BLUFF_WEIGHTS) — and it is only asked when the answer is the same at both
// ends and clear of the margin at both. A river call that is right against one
// player and wrong against another is a real and important thing, and it is
// not a thing a drill can mark you wrong on.
//
// **Everything else is the pot odds kind's contract.** Same seed, same spot,
// same grade, forever; the price is `toCall / (pot + toCall)` on the chips the
// player is shown; and a coin decides whether a spot is asked as a call or a
// fold, so folding everything scores what a coin scores.

/** Under this many points apart, calling and folding are the same decision. The face-up number. */
export const RIVER_MARGIN = 4

/** And over this many, the spot is a look rather than a question. */
const MAX_GAP = 25

/** The pot going to the flop. Multiples of 20, so every bet below rounds to a clean number. */
const STARTING_POTS = [40, 60, 80, 100, 120, 160] as const

/** What they bet on the flop or the turn, when they bet. */
const EARLY_FRACTIONS = [1 / 2, 2 / 3] as const

/**
 * The river bets a spot can be facing, as a fraction of the pot before it.
 *
 * From a fifth of the pot to twice it, because the river is where the sizes
 * spread out, and because a spot is only asked when some bet here makes it a
 * call and another makes it a fold: the wider the ladder, the more hands have
 * both. The overbets are here on purpose. They are the bets a beginner calls
 * because they look like bluffs, and they are the narrowest range the model has.
 */
const RIVER_FRACTIONS = [
  1 / 5,
  1 / 4,
  1 / 3,
  2 / 5,
  1 / 2,
  3 / 5,
  2 / 3,
  3 / 4,
  1,
  5 / 4,
  3 / 2,
  2,
] as const

/**
 * How good a starting hand of yours has to be for the spot to be dealt, on
 * `holeStrength`'s scale: about the better three in five.
 *
 * Looser than the range you are up against (`PLAYABLE` in ./riverRange), because you are
 * the one who called twice to get here and a beginner's hand usually is looser.
 * It changes nothing about the grade; it keeps 7-2 from calling down.
 */
const HERO_PLAYABLE = 0.45

/** Bets are in fives, the way a person sizes them. */
const roundBet = (chips: number) => Math.max(5, Math.round(chips / 5) * 5)

/** A price this river could be charging, and the range that bets it. */
interface RiverPrice {
  toCall: number
  /** The pot as the table shows it: what was there, plus their bet. */
  pot: number
  required: number
  /** The range at each of the three bluffing rates. */
  low: Facing
  typical: Facing
  high: Facing
}

/**
 * Deal the river spot at `seed`, or say why it was thrown away.
 *
 * Rejections reuse the shared vocabulary rather than adding to it:
 *
 * - `unexplainable`: the board is two pair or better on its own, so "a hand of
 *   their own" and "a hand that missed" stop meaning what the lesson says they
 *   mean. Rare, and not worth a paragraph of exceptions in the copy.
 * - `one-sided`: your hand is not one anybody calls with (nothing of your own
 *   on the river, or a starting hand you would not have played), or no bet this
 *   pot could carry asks it both ways.
 * - `ambiguous`: some bet would have asked it, but only inside the margin or
 *   only at one end of the bluffing band.
 */
export function generateRiverCall(seed: number): Generated {
  const deck = shuffledDeck(mulberry32(seed))
  const hero = deck.slice(0, 2)
  const board = deck.slice(2, 7)

  const boardScore = fastScore(board)
  if (categoryOf(boardScore) >= TWO_PAIR) return reject('unexplainable')

  // A hand you would have played, with a pair of your own on the river: the
  // spot a beginner is actually in. Ace-high bluff-catching is a real skill and
  // a later pack.
  if (holeStrength(hero, []) < HERO_PLAYABLE) return reject('one-sided')
  const heroScore = fastScore([...hero, ...board])
  if (categoryOf(heroScore) <= categoryOf(boardScore)) {
    return reject('one-sided')
  }

  // The second stream, as the other pricing kinds do it: reproducible from the
  // seed and independent of the shuffle.
  const rng = mulberry32((seed ^ 0x5f37_59df) >>> 0)
  const line: Line = {
    flop: rng() < 0.5 ? 'bet' : 'check',
    turn: rng() < 0.5 ? 'bet' : 'check',
  }

  let pot: number = STARTING_POTS[Math.floor(rng() * STARTING_POTS.length)]
  const steps: DrillLineStep[] = []
  for (const street of ['flop', 'turn'] as const) {
    const fraction = EARLY_FRACTIONS[Math.floor(rng() * EARLY_FRACTIONS.length)]
    if (line[street] === 'bet') {
      const amount = roundBet(pot * fraction)
      steps.push({ street, action: 'bet', amount, potBefore: pot })
      // You called: that is how the hand got here.
      pot += 2 * amount
    } else {
      steps.push({ street, action: 'check', potBefore: pot })
    }
  }

  const range = riverRange(hero, board, line)
  const prices: RiverPrice[] = RIVER_FRACTIONS.map((fraction) => {
    const toCall = roundBet(pot * fraction)
    // The value half narrows on the bet the player sees, not on the nominal
    // fraction, so a rounded bet cannot land on the other side of `BIG_BET` from
    // the one the chips say.
    const counted = count(hero, board, range, toCall / pot)
    return {
      toCall,
      pot: pot + toCall,
      required: toCall / (pot + 2 * toCall),
      low: weigh(counted, BLUFF_WEIGHTS.low),
      typical: weigh(counted, BLUFF_WEIGHTS.typical),
      high: weigh(counted, BLUFF_WEIGHTS.high),
    }
  })

  // Deduplicate: two fractions can round to the same bet on a small pot.
  const unique = prices.filter(
    (price, i) => prices.findIndex((other) => other.toCall === price.toCall) === i,
  )

  const gap = (f: Facing, price: RiverPrice) => (f.equity - price.required) * 100
  const settled = (price: RiverPrice) => {
    const ends = [gap(price.low, price), gap(price.high, price)]
    const sameSide = ends.every((g) => g > 0) || ends.every((g) => g < 0)
    return sameSide && ends.every((g) => Math.abs(g) >= RIVER_MARGIN)
  }
  const askable = unique.filter(
    (price) => settled(price) && Math.abs(gap(price.typical, price)) <= MAX_GAP,
  )
  const calls = askable.filter((price) => gap(price.typical, price) > 0)
  const folds = askable.filter((price) => gap(price.typical, price) < 0)

  if (calls.length === 0 || folds.length === 0) {
    const nearMiss = unique.some((price) => {
      const g = Math.abs(gap(price.typical, price))
      return g <= MAX_GAP && !settled(price)
    })
    return reject(nearMiss ? 'ambiguous' : 'one-sided')
  }

  const wantsCall = rng() < 0.5
  const side = wantsCall ? calls : folds
  const price = side[Math.floor(rng() * side.length)]
  const answer = wantsCall ? 'call' : 'fold'
  const choices: DrillChoice[] = [
    { id: 'fold', label: 'Fold', cards: [], winning: answer === 'fold' },
    { id: 'call', label: 'Call', cards: [], winning: answer === 'call' },
  ]
  steps.push({ street: 'river', action: 'bet', amount: price.toCall, potBefore: pot })

  const shape = shapeOf(Math.abs(gap(price.typical, price)))
  const yours = describe(hero, board)
  return accept({
    kind: 'calling-the-river',
    seed,
    board,
    choices,
    hands: [{ label: 'You', cards: hero, detail: capitalise(yours) }],
    stakes: { pot: price.pot, toCall: price.toCall },
    line: steps,
    range: summarise(price.typical),
    answer,
    settledBy: shape,
    difficulty: riverDifficulty(shape),
    explanation: explain(yours, price),
  })
}

/**
 * How much room the price left. See {@link RiverShape}: a gap rather than a
 * hand type, so the rung a spot sits on does not give its answer away.
 */
function shapeOf(gap: number): RiverShape {
  return gap >= CLEAR_GAP ? 'clear-read' : gap >= CLOSE_GAP ? 'close-read' : 'thin-read'
}

/** Points apart at or above which a spot is clear. */
const CLEAR_GAP = 16

/** And at or above which it is close rather than thin. */
const CLOSE_GAP = 10

const capitalise = (text: string) => text[0].toUpperCase() + text.slice(1)

/** The numbers the felt draws the range from, at the rate the sentence quotes. */
function summarise(f: Facing): RiverRangeSummary {
  return {
    value: f.value.total,
    valueBeaten: f.value.beaten,
    bluffs: f.bluffs.total,
    bluffsBeaten: f.bluffs.beaten,
    weakestValue: f.weakestValue,
    equity: f.equity,
  }
}

/**
 * The sentence, out of the same count that set the answer.
 *
 * Two facts and a comparison, in the pot odds kind's register: how often your
 * hand wins against what bets like this, and what the call costs as a share.
 * **No "about"**: the equity is a count of every hand in the range, and hedging
 * an exact number would be dishonest in the other direction. What it is a count
 * *of* — the model — is said on the lesson and under the felt, not squeezed in
 * here.
 */
function explain(yours: string, price: RiverPrice): string {
  const { equity } = price.typical
  const head = `Your ${yours.replace(/^an? /, '')} wins ${pct(equity)}% of the time against what bets like this`
  const call = `calling ${formatChips(price.toCall)} to win ${formatChips(price.pot)} needs ${pct(price.required)}%`
  const verdict =
    equity > price.required ? 'Enough, so it is a call.' : 'Not enough, so it is a fold.'
  return `${head}, and ${call}. ${verdict}`
}
