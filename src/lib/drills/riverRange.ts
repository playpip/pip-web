import { type Card, RANKS, type Rank, SUITS } from '@/lib/poker/cards'
import { evaluateHand } from '@/lib/poker/handEval'
import { holeStrength } from '@/lib/poker/range'

// What a river bet is made of, as a set of hands you can count.
//
// **Why this exists, and why it is not `estimateEquity`.** The play-it-out mode
// prices a street against a range that is a *procedure*: `drawRangedHoles`
// takes the best of a few random pairs, so there is no list of hands to count
// and every number it produces is sampled, with a band on it (see MARGIN in
// ./playItOut). On the river nothing is left to come, so if the range is a
// **list of hands with a weight on each**, the equity is not an estimate at
// all: every hand they could hold is compared with yours once and the answer
// is a fraction. That is what this file builds, and it is the reason the river
// pack can grade to the same four-point margin as the face-up kinds rather than
// the wider one a sampled number needs.
//
// **The model, in the words the lesson uses.** A river bet is two kinds of hand:
//
// 1. **Value.** Hands good enough to want a call. Here: the stronger half of
//    the made hands they could have (a pair or better that uses one of their
//    own cards), or the strongest third when the bet is bigger than two-thirds
//    of the pot. A bigger bet means a stronger hand, and that is the one
//    concession to bet size in the value half.
// 2. **Bluffs.** Hands that missed and can only win by getting you to fold.
//    Here: the hands in their range with nothing (no pair of their own), each
//    counted at a weight — they bet some of those, not all of them.
//
// Everything in the middle (a made hand not good enough to bet) checks, and so
// is not in the range you are facing. What "the hands they could have" means
// is the line: see {@link riverRange}.
//
// **Where the bluff weight comes from, because it is the number that decides
// the hardest spots.** It was measured, not chosen. 3,000 heads-up hands per
// profile between the app's own bots (`decideAction`, the Garage's, the
// Casino's and the Main Event's profiles, iterations held at 300 for time),
// counting every river bet into an unbet pot and whether the bettor held a
// pair of their own (2026-09-23):
//
// | profile | river bets | missed, all lines | missed, checked to the river |
// |---|---|---|---|
// | the Garage     | 337 | 13% | 14% (37 of 259) |
// | the Casino     | 326 | 24% | 28% (67 of 242) |
// | the Main Event | 298 | 31% | 42% (79 of 188) |
//
// The three weights in {@link BLUFF_WEIGHTS} are the ones at which this model's
// checked-through line reproduces the last column (the like-for-like line,
// and the one most of the bots' river bets come from). A spot is only asked
// when its answer is the same at the Garage's weight and at the Main Event's
// (see `generateRiverCall`), so the answer never depends on which of those
// players is betting — which is also why the face across the felt is company,
// not a clue. The same measurement found no bluffs at all on lines where the
// bot had bet both earlier streets (0 of 31 at the Casino); the model allows
// a few there (missed draws), which is the cautious direction for a pack that
// mostly teaches folding.

/**
 * How strong a starting hand has to be for them to have played it, on
 * `holeStrength`'s scale: about the best two in five (544 of the 1,326
 * starting hands, 41%). Between the ladder's measured VPIPs, which run from the
 * Garage's 35% down (tests/ai.test.ts); heads-up at the river, a little wider
 * is the honest direction.
 */
export const PLAYABLE = 0.525

/**
 * The share of their made hands they bet for value.
 *
 * Two tiers and a judgement, stated rather than hidden: up to two-thirds of the
 * pot they bet the stronger half, and above it the strongest third. The price
 * already rises with the bet; this is the other half of the same idea, that a
 * bigger bet is a narrower range.
 */
export const VALUE_SHARE = { standard: 1 / 2, big: 1 / 3 } as const

/** The bet, as a fraction of the pot, above which the value half narrows. */
export const BIG_BET = 2 / 3

/**
 * How much each hand that missed counts, as a share of a hand they would
 * certainly bet. Fitted to the bots (see the table at the top of the file): at
 * these weights a checked-through line's river bets are 14.1%, 27.9% and 41.8%
 * missed hands, averaged over 300 boards at half pot, against the bots'
 * measured 14%, 28% and 42%.
 *
 * `low` is the Garage, `typical` the Casino, `high` the Main Event. The
 * explanation quotes `typical`; the generator only asks a spot whose answer
 * holds at both `low` and `high`.
 */
export const BLUFF_WEIGHTS = { low: 0.1, typical: 0.27, high: 0.55 } as const

export type StreetAction = 'check' | 'bet'

/**
 * What they did before the river. You called whenever they bet, so a bet here
 * is also a street you paid to see.
 */
export interface Line {
  flop: StreetAction
  turn: StreetAction
}

/** One two-card hand they could hold, read on the river. */
interface Combo {
  hole: [Card, Card]
  /** pokersolver's own ordering, as one number: higher beats lower, equal ties. */
  score: number
  /** A pair or better that uses one of their own cards. */
  made: boolean
}

/** How one side of the range does against you. Weighted counts. */
export interface Side {
  /** Hands in this side, weighted. */
  total: number
  /** Of those, the ones you beat (a tie counts half). */
  beaten: number
}

/** The range you are facing, counted against your hand. */
export interface Facing {
  value: Side
  bluffs: Side
  /** Your share of the pot against the whole range. Exact, in [0, 1]. */
  equity: number
  /** The weakest hand they bet for value, in words: "a pair of queens". */
  weakestValue: string
  /** How many distinct two-card hands are in the value half (unweighted). */
  valueHands: number
  /** How many distinct hands that missed they could be bluffing with (unweighted). */
  missedHands: number
}

const cardKey = (card: Card) => `${card.rank}${card.suit}`

/**
 * A hand as one comparable number: the category, then the five cards that
 * rank it, most significant first, on pokersolver's own scales.
 *
 * This is `Hand.compare` written as a number — category first, then
 * `cards[0..4].rank` — so sorting by it and comparing with it agree with
 * `determineWinners` exactly. It goes through the solver, which is the
 * authority and is slow; {@link fastScore} is the same number counted by hand,
 * and `tests/riverRange.test.ts` holds the two to each other.
 */
export function handScore(hole: readonly Card[], board: readonly Card[]): number {
  const solved = evaluateHand(hole, board).solved
  if (!solved) throw new Error('handScore: a Hold’em hand came back unsolved')
  let score = solved.rank
  for (let i = 0; i < 5; i++) score = score * 15 + (solved.cards[i]?.rank ?? 0)
  return score
}

/** pokersolver's rank index: a deuce is 1 and an ace 13, so a wheel's ace can be 0. */
const INDEX: Record<Rank, number> = {
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
  '9': 8,
  T: 9,
  J: 10,
  Q: 11,
  K: 12,
  A: 13,
}

const encode = (category: number, ranks: readonly number[]) => {
  let score = category
  for (let i = 0; i < 5; i++) score = score * 15 + (ranks[i] ?? 0)
  return score
}

/** The top card of the highest straight in a set of rank bits, or 0. The ace plays low too. */
function straightTop(bits: number): number {
  const withLowAce = bits & (1 << 13) ? bits | 1 : bits
  for (let top = 13; top >= 4; top--) {
    const run = 0b11111 << (top - 4)
    if ((withLowAce & run) === run) return top
  }
  return 0
}

/** The highest `n` ranks set in `bits`, highest first, skipping any in `except`. */
function highest(bits: number, n: number, except: readonly number[] = []): number[] {
  const out: number[] = []
  for (let r = 13; r >= 1 && out.length < n; r--) {
    if (bits & (1 << r) && !except.includes(r)) out.push(r)
  }
  return out
}

/**
 * {@link handScore}, counted by hand rather than solved: the same number for
 * the same seven cards, about ten times faster.
 *
 * It exists because the range is every two-card hand they could hold, scored
 * once each, on every spot the generator considers — a thousand solves a spot,
 * and most spots are thrown away. The solver stays the authority: a test deals
 * tens of thousands of random hands and requires the two numbers to be equal,
 * so this can only ever be a faster route to the solver's answer, never a
 * second opinion.
 */
export function fastScore(cards: readonly Card[]): number {
  const counts = new Array<number>(14).fill(0)
  const suitBits: Record<string, number> = { c: 0, d: 0, h: 0, s: 0 }
  const suitCount: Record<string, number> = { c: 0, d: 0, h: 0, s: 0 }
  let bits = 0
  for (const card of cards) {
    const r = INDEX[card.rank]
    counts[r]++
    bits |= 1 << r
    suitBits[card.suit] |= 1 << r
    suitCount[card.suit]++
  }

  // Five of a suit rules out quads and a full house in seven cards, so the
  // flush can be settled first without skipping a better hand.
  for (const suit of SUITS) {
    if (suitCount[suit] < 5) continue
    const top = straightTop(suitBits[suit])
    if (top) return encode(9, [top, top - 1, top - 2, top - 3, top - 4])
    return encode(6, highest(suitBits[suit], 5))
  }

  const quads: number[] = []
  const trips: number[] = []
  const pairs: number[] = []
  for (let r = 13; r >= 1; r--) {
    if (counts[r] === 4) quads.push(r)
    else if (counts[r] === 3) trips.push(r)
    else if (counts[r] === 2) pairs.push(r)
  }

  if (quads.length) {
    const q = quads[0]
    return encode(8, [q, q, q, q, ...highest(bits, 1, [q])])
  }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const t = trips[0]
    const p = Math.max(trips[1] ?? 0, pairs[0] ?? 0)
    return encode(7, [t, t, t, p, p])
  }
  const top = straightTop(bits)
  if (top) return encode(5, [top, top - 1, top - 2, top - 3, top - 4])
  if (trips.length) {
    const t = trips[0]
    return encode(4, [t, t, t, ...highest(bits, 2, [t])])
  }
  if (pairs.length >= 2) {
    const [a, b] = pairs
    return encode(3, [a, a, b, b, ...highest(bits, 1, [a, b])])
  }
  if (pairs.length === 1) {
    const a = pairs[0]
    return encode(2, [a, a, ...highest(bits, 3, [a])])
  }
  return encode(1, highest(bits, 5))
}

/**
 * The category of a hand, from its score, on pokersolver's numbering: high card
 * is 1, a pair 2, two pair 3, and so on up to 9 for a straight flush.
 */
export const categoryOf = (score: number) => Math.floor(score / 15 ** 5)

/** pokersolver's number for two pair. */
export const TWO_PAIR = 3

/**
 * Anything worth a bet on the flop or turn: a pair of their own, or a draw to
 * a flush or a straight that uses one of their cards.
 *
 * Counted by hand rather than solved, because it is asked of every hand they
 * could hold on two streets and it only needs to say yes or no. A made flush or
 * straight passes as the draw it grew out of, which is the right answer.
 */
export function hasSomething(hole: readonly Card[], board: readonly Card[]): boolean {
  const [a, b] = hole
  if (a.rank === b.rank) return true
  if (board.some((card) => card.rank === a.rank || card.rank === b.rank)) return true

  for (const suit of SUITS) {
    const mine = hole.filter((card) => card.suit === suit).length
    if (mine === 0) continue
    if (mine + board.filter((card) => card.suit === suit).length >= 4) return true
  }

  // Four of any five ranks in a row, one of them theirs. The ace plays at both
  // ends, as it does in a straight.
  const value = (rank: Rank) => RANKS.indexOf(rank) + 2
  const ranks = new Set<number>()
  for (const card of [...hole, ...board]) {
    ranks.add(value(card.rank))
    if (card.rank === 'A') ranks.add(1)
  }
  const theirs = new Set<number>()
  for (const card of hole) {
    theirs.add(value(card.rank))
    if (card.rank === 'A') theirs.add(1)
  }
  for (let low = 1; low <= 10; low++) {
    let hit = 0
    let usesTheirs = false
    for (let r = low; r < low + 5; r++) {
      if (ranks.has(r)) {
        hit++
        if (theirs.has(r)) usesTheirs = true
      }
    }
    if (hit >= 4 && usesTheirs) return true
  }
  return false
}

/**
 * Every hand they could be holding on this river, given the line.
 *
 * Three filters, in the order the hand was played:
 *
 * 1. **They played it before the flop**: `holeStrength` of at least
 *    {@link PLAYABLE}, which is the middle of the ladder's own preflop gate
 *    (`0.15 + tightness × 0.5` at tightness 0.38, in ai/policy.ts). About the
 *    better half of starting hands.
 * 2. **A bet on the flop or the turn means they had something** there: a pair
 *    of their own or a draw ({@link hasSomething}). This is what puts missed
 *    draws into a range that bet twice, and what keeps most of the air out.
 * 3. **A check tells you nothing**, so it removes nothing. That is a
 *    simplification in their favour — real players bet some strong hands and
 *    check others — and it is stated because it is one.
 *
 * Your two cards and the board are out of the deck, so card removal is counted
 * without anybody having to think about it.
 */
export function riverRange(hero: readonly Card[], board: readonly Card[], line: Line): Combo[] {
  const dead = new Set([...hero, ...board].map(cardKey))
  const deck: Card[] = []
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      const card = { rank, suit }
      if (!dead.has(cardKey(card))) deck.push(card)
    }
  }
  const boardCategory = categoryOf(fastScore(board))
  const out: Combo[] = []
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      const hole: [Card, Card] = [deck[i], deck[j]]
      if (holeStrength(hole, []) < PLAYABLE) continue
      if (line.flop === 'bet' && !hasSomething(hole, board.slice(0, 3))) continue
      if (line.turn === 'bet' && !hasSomething(hole, board.slice(0, 4))) continue
      const score = fastScore([...hole, ...board])
      out.push({ hole, score, made: categoryOf(score) > boardCategory })
    }
  }
  return out
}

/**
 * The part of the range that bets this size: the value half and the misses.
 *
 * The value cut takes every hand tied with the weakest one it keeps, so two
 * identical hands are never split across the line — a cut through the middle of
 * a tie would be the model asserting a difference the cards do not have.
 */
export function bettingRange(range: readonly Combo[], fraction: number) {
  const made = range.filter((combo) => combo.made).sort((x, y) => y.score - x.score)
  const share = fraction > BIG_BET ? VALUE_SHARE.big : VALUE_SHARE.standard
  const keep = Math.max(1, Math.ceil(made.length * share))
  const cut = made[Math.min(keep, made.length) - 1]?.score ?? Number.POSITIVE_INFINITY
  return {
    value: made.filter((combo) => combo.score >= cut),
    missed: range.filter((combo) => !combo.made),
  }
}

/** Your hand against one size's betting range, before any weight goes on the misses. */
export interface Counted {
  /** The value half: how many hands, and how many of them you beat (ties half). */
  value: Side
  /** Every hand that missed, unweighted: how many, and how many you beat. */
  missed: Side
  /** The weakest hand they bet for value, in words. */
  weakestValue: string
}

/**
 * Your hand against what bets this size, counted once.
 *
 * Every hand in the range is compared with yours exactly once: a win counts
 * one, a tie a half, a loss nothing. Split from the weighting below because the
 * generator asks the same count at three bluffing rates, and the count is the
 * only part that costs anything.
 */
export function count(
  hero: readonly Card[],
  board: readonly Card[],
  range: readonly Combo[],
  fraction: number,
): Counted {
  const mine = fastScore([...hero, ...board])
  const { value, missed } = bettingRange(range, fraction)
  const against = (combos: readonly Combo[]): Side => {
    let beaten = 0
    for (const combo of combos) {
      if (mine > combo.score) beaten += 1
      else if (mine === combo.score) beaten += 0.5
    }
    return { total: combos.length, beaten }
  }
  const weakest = value.at(-1)
  return {
    value: against(value),
    missed: against(missed),
    weakestValue: weakest ? describe(weakest.hole, board) : 'nothing',
  }
}

/**
 * The count, with the misses weighted by how often they are bet.
 *
 * `bluffWeight` is how much each missed hand counts (see {@link BLUFF_WEIGHTS}).
 * No sampling, no rng, no band: the equity is a ratio of two sums, and the only
 * approximation left is the model itself, stated in full at the top of this
 * file.
 */
export function weigh(counted: Counted, bluffWeight: number): Facing {
  const value = counted.value
  const bluffs = {
    total: counted.missed.total * bluffWeight,
    beaten: counted.missed.beaten * bluffWeight,
  }
  const total = value.total + bluffs.total
  return {
    value,
    bluffs,
    equity: total === 0 ? 0 : (value.beaten + bluffs.beaten) / total,
    weakestValue: counted.weakestValue,
    valueHands: value.total,
    missedHands: counted.missed.total,
  }
}

/** {@link count} and {@link weigh} in one call, for a single bluffing rate. */
export function facing(
  hero: readonly Card[],
  board: readonly Card[],
  range: readonly Combo[],
  fraction: number,
  bluffWeight: number,
): Facing {
  return weigh(count(hero, board, range, fraction), bluffWeight)
}

const PLURAL: Record<Rank, string> = {
  '2': 'twos',
  '3': 'threes',
  '4': 'fours',
  '5': 'fives',
  '6': 'sixes',
  '7': 'sevens',
  '8': 'eights',
  '9': 'nines',
  T: 'tens',
  J: 'jacks',
  Q: 'queens',
  K: 'kings',
  A: 'aces',
}

/**
 * A made hand in the words a player would use: "a pair of queens", "two pair,
 * kings and sevens", "three nines". Read off the solver's own best five, so it
 * names the cards that actually play.
 */
export function describe(hole: readonly Card[], board: readonly Card[]): string {
  const hand = evaluateHand(hole, board)
  const [first, , , fourth] = hand.best
  const second = hand.best[2]
  switch (hand.name) {
    case 'Pair':
      return `a pair of ${PLURAL[first.rank]}`
    case 'Two Pair':
      return `two pair, ${PLURAL[first.rank]} and ${PLURAL[second.rank]}`
    case 'Three of a Kind':
      return `three ${PLURAL[first.rank]}`
    case 'Full House':
      return `a full house, ${PLURAL[first.rank]} full of ${PLURAL[fourth.rank]}`
    case 'Four of a Kind':
      return `four ${PLURAL[first.rank]}`
    case 'High Card':
      return `${PLURAL[first.rank].slice(0, -1).replace(/xe$/, 'x')} high`
    default:
      return hand.name === 'Straight Flush' ? 'a straight flush' : `a ${hand.name.toLowerCase()}`
  }
}
