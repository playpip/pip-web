import { breakevenFolds, pct, requiredEquity } from '@/config/potOdds'
import { type Card, RANKS, SUITS, cardToString } from '@/lib/poker/cards'
import { determineWinners, evaluateHand } from '@/lib/poker/handEval'
import { holeStrength } from '@/lib/poker/range'
import { UNSEEN } from '@/lib/drills/turnSpot'
import { type Line, PLAYABLE, fastScore, hasSomething, riverRange } from '@/lib/drills/riverRange'

// The arithmetic behind the lessons' questions, in one place and all of it
// borrowed.
//
// **Nothing here is a second opinion.** Every number a lesson grades comes out
// of a function the rest of the app already answers to: outs are counted the
// way the count-your-outs drill counts them (every river dealt, the showdown
// read by `determineWinners`); a price is `requiredEquity` and a bluff's
// break-even is `breakevenFolds` (config/potOdds, which the pot-odds and
// bet-sizing guides print their tables from); a range is the calling-the-river
// pack's model (lib/drills/riverRange). What this file adds is only the shape a
// question needs — a count with its near misses, a price with the two classic
// wrong ones beside it — so the lesson and the thing it hands you into cannot
// disagree about an answer.

const key = (card: Card) => cardToString(card)

/** Every card nobody at the table has shown you, in deck order. */
export function unseenCards(known: readonly Card[]): Card[] {
  const dead = new Set(known.map(key))
  const out: Card[] = []
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      const card = { rank, suit }
      if (!dead.has(key(card))) out.push(card)
    }
  }
  return out
}

/** What each river does for you against a hand you can see. */
export interface Outs {
  /** Rivers that win it for you outright. */
  wins: Card[]
  /** Rivers that split it. */
  chops: number
  /**
   * Rivers that make the same kind of hand your outs make, and still lose: the
   * flush card that pairs the board, the straight card that fills their house.
   * The cards that look like outs and are not. (Pairing up and losing is not
   * one; nobody counts a pair as a draw.)
   */
  traps: Card[]
}

/**
 * One card to come, both hands face up: deal every card that is left and read
 * the showdown. The count-your-outs drill's enumeration, on a lesson's cards.
 */
export function riverOuts(hero: readonly Card[], villain: readonly Card[], board: readonly Card[]) {
  if (board.length !== 4) throw new Error('Outs are counted on the turn, with one card to come')
  const rest = unseenCards([...hero, ...villain, ...board])
  if (rest.length !== UNSEEN) throw new Error(`${rest.length} unseen cards, not ${UNSEEN}`)
  const contenders = [
    { id: 'you', hole: [...hero] },
    { id: 'them', hole: [...villain] },
  ]
  const outs: Outs = { wins: [], chops: 0, traps: [] }
  const losers: { card: Card; made: number }[] = []
  const made: number[] = []
  for (const card of rest) {
    const river = [...board, card]
    const { winners } = determineWinners(contenders, river)
    if (winners.length > 1) outs.chops++
    else if (winners[0] === 'you') {
      outs.wins.push(card)
      made.push(evaluateHand(hero, river).categoryRank)
    } else losers.push({ card, made: evaluateHand(hero, river).categoryRank })
  }
  // A losing river is a trap when it makes you a hand at least as good as the
  // weakest one your outs make: it is the card you would have counted.
  const weakestOut = Math.min(...made)
  outs.traps = losers.filter((l) => l.made >= weakestOut).map((l) => l.card)
  return outs
}

/**
 * Four counts to choose from: the right one, the count you get if you also take
 * the traps (the miscount the lesson is about), and near misses round it.
 * Deterministic, positive, ascending.
 */
export function countChoices(answer: number, naive: number): number[] {
  const pool = [
    answer,
    naive,
    answer - 2,
    answer + 2,
    answer - 1,
    answer + 1,
    answer + 3,
    answer + 4,
  ]
  const picked: number[] = []
  for (const n of pool) {
    if (n >= 1 && n <= UNSEEN && !picked.includes(n)) picked.push(n)
    if (picked.length === 4) break
  }
  return picked.sort((a, b) => a - b)
}

/** A percentage as a guide prints one, with the sign. */
export const percent = (share: number) => `${pct(share)}%`

/**
 * The price of calling `toCall` into a pot that already holds the bet: the
 * share of the pot you must win to break even.
 *
 * Taken from `requiredEquity`, the function the pot-odds guide prints its table
 * from, by way of the bet as a fraction of the pot before it. It is the same
 * number as `toCall / (pot + toCall)`, and a test holds the two together.
 */
export function priceOf(toCall: number, pot: number): number {
  if (toCall <= 0 || pot <= toCall) throw new Error('Nothing to price')
  return requiredEquity(toCall / (pot - toCall))
}

/**
 * The right price and the two wrong ones people actually work out: the call
 * over the pot as it stands, and the bet over the pot before it. Ascending.
 */
export function priceChoices(toCall: number, pot: number): { right: string; all: string[] } {
  const right = percent(priceOf(toCall, pot))
  const all = [right, percent(toCall / pot), percent(toCall / (pot - toCall))]
  if (new Set(all).size !== all.length) throw new Error('Two prices read the same')
  return { right, all: sortPercents(all) }
}

/**
 * How often a bet of `bet` into `pot` has to make them fold to break even, as
 * the bet-sizing guide prints it (`breakevenFolds`), beside the two numbers it
 * is most often confused with: the caller's price for the same bet, and the bet
 * as a share of the pot. Ascending.
 */
export function bluffChoices(bet: number, pot: number): { right: string; all: string[] } {
  const fraction = bet / pot
  const right = percent(breakevenFolds(fraction))
  const all = [right, percent(requiredEquity(fraction)), percent(fraction)]
  if (new Set(all).size !== all.length) throw new Error('Two break-evens read the same')
  return { right, all: sortPercents(all) }
}

const sortPercents = (all: string[]) =>
  [...all].sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b))

/**
 * Why a hand is, or is no longer, in the range of somebody who played the hand
 * a certain way. The calling-the-river pack's model, one filter at a time
 * (`riverRange`): they played it before the flop, and every street they bet
 * they had something there — a pair of their own or a draw.
 */
export type RangeVerdict = 'in' | 'preflop' | 'flop' | 'turn'

export function rangeVerdict(
  hole: readonly Card[],
  board: readonly Card[],
  line: Line,
): RangeVerdict {
  if (holeStrength(hole, []) < PLAYABLE) return 'preflop'
  if (board.length >= 3 && line.flop === 'bet' && !hasSomething(hole, board.slice(0, 3)))
    return 'flop'
  if (board.length >= 4 && line.turn === 'bet' && !hasSomething(hole, board.slice(0, 4)))
    return 'turn'
  return 'in'
}

/** A pair of their own, on this board: the made half of `hasSomething`. */
export function pairsTheBoard(hole: readonly Card[], board: readonly Card[]): boolean {
  const [a, b] = hole
  return a.rank === b.rank || board.some((c) => c.rank === a.rank || c.rank === b.rank)
}

/**
 * How often this hand wins a showdown against every hand in the range, if you
 * check it down: a win counts one, a tie a half. Unweighted, because checking
 * it down meets the whole range, not the part of it that bets.
 */
export function showdownShare(hole: readonly Card[], board: readonly Card[], line: Line): number {
  const range = riverRange(hole, board, line)
  if (range.length === 0) throw new Error('An empty range')
  const mine = fastScore([...hole, ...board])
  let beaten = 0
  for (const combo of range) {
    if (mine > combo.score) beaten += 1
    else if (mine === combo.score) beaten += 0.5
  }
  return beaten / range.length
}

/** A stack in big blinds, as a whole number: lessons deal stacks that divide. */
export function bigBlinds(chips: number, bigBlind: number): number {
  const n = chips / bigBlind
  if (!Number.isInteger(n)) throw new Error(`${chips} is not a whole number of ${bigBlind}s`)
  return n
}

/** Four stack sizes to choose from: the answer and the three a player gets by mistake. */
export function stackChoices(answer: number, others: readonly number[]): number[] {
  const pool = [answer, ...others, answer * 2, Math.round(answer / 2), answer * 10, answer + 5]
  const picked: number[] = []
  for (const n of pool) {
    if (n >= 1 && !picked.includes(n)) picked.push(n)
    if (picked.length === 4) break
  }
  return picked.sort((a, b) => a - b)
}
