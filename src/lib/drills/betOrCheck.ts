import { pct } from '@/config/potOdds'
import { holeStrength } from '@/lib/poker/range'
import { mulberry32, shuffledDeck } from '@/lib/poker/cards'
import { formatChips } from '@/lib/useMoney'
import { type ValueShape, valueDifficulty } from './rating'
import { TWO_PAIR, categoryOf, describe, fastScore, type Line, riverRange } from './riverRange'
import {
  type DrillChoice,
  type DrillLineStep,
  type Generated,
  type CallingRangeSummary,
  accept,
  reject,
} from './types'
import {
  MISSED_CALLS,
  type ValueBand,
  type ValueCount,
  callingGroups,
  countAgainst,
  valueBand,
} from './valueRange'

// Bet or check: the river pack's mirror.
//
// You have a hand on the river and it is checked to you. Bet, or check it back?
// The river pack asks whether what bets like this is beaten often enough to pay;
// this asks whether what *calls* like this is beaten often enough to be worth
// charging. Same board, same kind of range, same honesty rules, the other seat.
//
// **Graded by counting, against a range you can read.** The range is the river
// pack's own list of hands (./riverRange), read as a caller (./valueRange): the
// better part of their made hands, and a few that missed. Every hand in it is
// compared with yours once, so your share against the callers is a fraction,
// not an estimate. The break-even never moves: a value bet wants to win **more
// than half** of the times it is called, whatever the size (the criterion, with
// its derivation, is at the top of ./valueRange).
//
// **The one thing the model cannot know is how wide this player calls**, so the
// generator refuses to guess it. Each size is priced at every cut of the
// measured band, one hand at a time, and at both ends of the missed-hand
// weight, and a spot is only asked when the answer is the same at all of them
// and four points clear of a half at each. A bet that is right against one
// player and wrong against another is a real thing and not a thing a drill can
// mark you wrong on.
//
// **Everything else is the river pack's contract.** Same seed, same spot, same
// grade, forever; the size is one the player is shown in chips; and a coin
// decides whether a spot is asked as a bet or a check, where the hand has both.

/** Under this many points from a half, betting and checking are the same decision. The face-up number. */
export const VALUE_MARGIN = 4

/** And over this many, the spot is a look rather than a question. */
const MAX_GAP = 25

/** The pot going to the flop. Multiples of 20, so every bet rounds to a clean number. */
const STARTING_POTS = [40, 60, 80, 100, 120, 160] as const

/** What you bet on the flop or the turn, when you bet. */
const EARLY_FRACTIONS = [1 / 2, 2 / 3] as const

/**
 * The river bets on offer, as a fraction of the pot. The sizes the bots were
 * measured calling (see ./valueRange): half, two-thirds, three-quarters, the
 * pot. A third is left out because nothing was measured at it.
 */
const RIVER_FRACTIONS = [1 / 2, 2 / 3, 3 / 4, 1] as const

/** Your starting hand, as the river pack deals it: something you would have played. */
const HERO_PLAYABLE = 0.45

/** Points apart at or above which a spot is clear, and at or above which it is close. */
const CLEAR_GAP = 20
const CLOSE_GAP = 15

const roundBet = (chips: number) => Math.max(5, Math.round(chips / 5) * 5)

/** One size, counted at every calling range the band allows. */
interface Offer {
  bet: number
  pot: number
  band: ValueBand
  /** 'bet' or 'check' when every range in the band agrees, clear of the margin; else null. */
  answer: 'bet' | 'check' | null
}

/**
 * What the band says about one size. A bet needs more than half of the calls
 * at every range, by the margin; a check needs the whole gain from betting —
 * folds included — to be negative at every range, by the margin (see
 * `effective` in ./valueRange).
 */
function settle(band: ValueBand): 'bet' | 'check' | null {
  const m = VALUE_MARGIN / 100
  if (band.all.every((c) => c.equity >= 0.5 + m)) return 'bet'
  if (band.all.every((c) => c.effective <= 0.5 - m)) return 'check'
  return null
}

/**
 * Deal the bet-or-check spot at `seed`, or say why it was thrown away.
 *
 * - `unexplainable`: the board is two pair or better on its own, as the river
 *   pack throws away, and for the same reason.
 * - `one-sided`: your hand is not one anybody bets for value (nothing of your
 *   own, or a starting hand you would not have played), or every size is a
 *   look rather than a question.
 * - `ambiguous`: some size would have asked it, but only inside the margin or
 *   only at one end of the band.
 */
export function generateBetOrCheck(seed: number): Generated {
  const deck = shuffledDeck(mulberry32(seed))
  const hero = deck.slice(0, 2)
  const board = deck.slice(2, 7)

  const boardScore = fastScore(board)
  if (categoryOf(boardScore) >= TWO_PAIR) return reject('unexplainable')
  if (holeStrength(hero, []) < HERO_PLAYABLE) return reject('one-sided')
  if (categoryOf(fastScore([...hero, ...board])) <= categoryOf(boardScore)) {
    return reject('one-sided')
  }

  const rng = mulberry32((seed ^ 0x1f83_d9ab) >>> 0)
  const line: Line = {
    flop: rng() < 0.5 ? 'bet' : 'check',
    turn: rng() < 0.5 ? 'bet' : 'check',
  }
  let pot: number = STARTING_POTS[Math.floor(rng() * STARTING_POTS.length)]
  const steps: DrillLineStep[] = []
  for (const street of ['flop', 'turn'] as const) {
    const fraction = EARLY_FRACTIONS[Math.floor(rng() * EARLY_FRACTIONS.length)]
    if (line[street] === 'bet') {
      // You bet, they called.
      const amount = roundBet(pot * fraction)
      steps.push({ street, action: 'bet', amount, potBefore: pot })
      pot += 2 * amount
    } else {
      steps.push({ street, action: 'check', potBefore: pot })
    }
  }
  // And on the river they check to you.
  steps.push({ street: 'river', action: 'check', potBefore: pot })

  const counted = countAgainst(hero, board, riverRange(hero, board, line))
  if (counted.made.length === 0) return reject('one-sided')
  const offers: Offer[] = []
  for (const fraction of RIVER_FRACTIONS) {
    const bet = roundBet(pot * fraction)
    if (offers.some((o) => o.bet === bet)) continue
    const band = valueBand(counted, bet, pot)
    offers.push({ bet, pot, band, answer: settle(band) })
  }

  const gap = (offer: Offer) => Math.abs(offer.band.typical.equity - 0.5) * 100
  const askable = offers.filter((o) => o.answer !== null && gap(o) <= MAX_GAP)
  if (askable.length === 0) {
    const nearMiss = offers.some((o) => o.answer === null && gap(o) <= MAX_GAP)
    return reject(nearMiss ? 'ambiguous' : 'one-sided')
  }
  const bets = askable.filter((o) => o.answer === 'bet')
  const checks = askable.filter((o) => o.answer === 'check')
  const coin = rng() < 0.5
  const wantsBet = checks.length === 0 || (bets.length > 0 && coin)
  const side = wantsBet ? bets : checks
  const offer = side[Math.floor(rng() * side.length)]
  const answer = wantsBet ? 'bet' : 'check'

  const choices: DrillChoice[] = [
    { id: 'check', label: 'Check', cards: [], winning: answer === 'check' },
    { id: 'bet', label: `Bet ${formatChips(offer.bet)}`, cards: [], winning: answer === 'bet' },
  ]
  const shape = shapeOf(gap(offer))
  const yours = describe(hero, board)
  return accept({
    kind: 'bet-or-check',
    seed,
    board,
    choices,
    hands: [{ label: 'You', cards: hero, detail: capitalise(yours) }],
    line: steps,
    calling: summarise(offer, counted),
    answer,
    settledBy: shape,
    difficulty: valueDifficulty(shape),
    explanation: explain(yours, offer.bet, offer.pot, offer.band.typical),
  })
}

function shapeOf(gap: number): ValueShape {
  return gap >= CLEAR_GAP ? 'clear-value' : gap >= CLOSE_GAP ? 'close-value' : 'thin-value'
}

const capitalise = (text: string) => text[0].toUpperCase() + text.slice(1)

function summarise(offer: Offer, counted: ReturnType<typeof countAgainst>): CallingRangeSummary {
  const t = offer.band.typical
  return {
    pot: offer.pot,
    bet: offer.bet,
    calls: t.calls,
    callsBeaten: t.beaten,
    folds: counted.made.length - t.madeCalls + counted.missed * (1 - MISSED_CALLS.typical),
    groups: callingGroups(counted, t.madeCalls, MISSED_CALLS.typical),
    equity: t.equity,
  }
}

/**
 * The sentence, out of the same count that set the answer: how often your hand
 * wins against what calls this size, and the line a value bet has to clear.
 * **No "about"**: it is a count, and hedging it would be dishonest the other way.
 */
function explain(yours: string, bet: number, pot: number, typical: ValueCount): string {
  const hand = yours.replace(/^an? /, '')
  const head = `Your ${hand} wins ${pct(typical.equity)}% against the hands that call ${formatChips(bet)} into ${formatChips(pot)}`
  return typical.equity > 0.5
    ? `${head}. A value bet needs more than half, so it is a bet.`
    : `${head}. A value bet needs more than half, so it is a check.`
}
