import { holeKey } from '@/config/handNames'
import { type Seat, type SeatId, opensHand, playersBehind, seatById } from '@/config/positions'
import { type Band, HAND_BANDS } from '@/config/startingHands'
import { type Card, RANKS, type Rank, mulberry32, shuffledDeck } from '@/lib/poker/cards'
import { type OpenShape, openDifficulty } from './rating'
import { type DrillChoice, type Generated, accept, reject } from './types'

// Open or fold: the second practice pack, and the first one before the flop.
//
// It folds round to you. You are in a given seat with a given hand, a hundred
// big blinds deep, and there are two answers: raise, or let it go. That is the
// decision the Position lesson builds to, and the one the coaching report's
// "you enter too many pots" is about.
//
// **Graded against the chart, and only the chart.** The answer is
// `opensHand(seat, hand)` from config/positions, which is the same function the
// position guide's "same hand, three seats" widget calls and which reads the
// same three band lists the starting-hand chart on /learn/starting-hands is
// drawn from. So this pack cannot mark a hand differently from the free guides:
// move a hand a band on the chart and the pack moves with it, in the same
// commit, because there is only one list.
//
// **That chart is a taught beginner's chart, not solver output**, and the
// guides say so in their own words. The pack is honest about the same thing in
// its small print: it grades against the chart the guides teach. What it
// guarantees is that it agrees with them, not that it is the last word on
// preflop poker.
//
// **The blinds are not asked.** The chart is an opening chart and a blind is
// defending, not opening (see `Seat.opens`), so a spot in the small blind would
// be a question the chart has no answer to. The four seats that can open are.

/** The seats a spot can fold round to: every seat the chart opens from. */
export const OPENING_SEATS = ['utg', 'mp', 'co', 'btn'] as const satisfies readonly SeatId[]

export type OpeningSeat = (typeof OPENING_SEATS)[number]

/** Where the chart says a band starts, as the end of a sentence. */
const BAND_WHERE: Record<Band, string> = {
  any: 'every seat',
  middle: 'the middle seat onwards',
  late: 'the cutoff and the button',
}

/** Where you are, as the middle of a sentence: "you are on the button". */
const SEAT_PHRASE: Record<OpeningSeat, string> = {
  utg: 'under the gun',
  mp: 'in the middle seat',
  co: 'in the cutoff',
  btn: 'on the button',
}

const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five'] as const

/** A rank's height, deuce low. */
const height = (rank: Rank): number => RANKS.indexOf(rank)

/**
 * The verdict on a hand from a seat, in one sentence, ending in the answer.
 *
 * Shared with the Position lesson rather than written twice, so the lesson and
 * the pack cannot explain the same spot two ways. Every clause is read off the
 * chart: the band, the seats that open it, and how many players are still to
 * act behind you.
 */
export function openVerdict(seat: OpeningSeat, hand: string): string {
  const band = HAND_BANDS[hand]
  const where = SEAT_PHRASE[seat]
  if (band === undefined) {
    return `${hand} is not on the chart from any seat${seat === 'btn' ? ', the button included' : ''}, so it is a fold.`
  }
  if (opensHand(seatById(seat), hand)) {
    return band === 'any'
      ? `${hand} opens from every seat, so ${where} it is a raise.`
      : `${hand} opens from ${BAND_WHERE[band]}, and you are ${where}, so it is a raise.`
  }
  const behind = playersBehind(seatById(seat))
  return `${hand} only opens from ${BAND_WHERE[band]}, and you are ${where} with ${NUMBER[behind]} still to act behind you, so it is a fold.`
}

/** Raise or fold, for this hand in this seat. The chart's answer, and the only one. */
export function openAnswer(seat: Seat, hand: string): 'raise' | 'fold' {
  return opensHand(seat, hand) ? 'raise' : 'fold'
}

/**
 * Does this hand look like one you raise? An ace, two cards ten or higher, or a
 * pair of sevens or better — the hands a beginner reaches for chips with.
 */
function looksStrong(cards: readonly Card[]): boolean {
  const [a, b] = cards.map((c) => height(c.rank))
  if (a === b) return a >= height('7')
  return a === height('A') || b === height('A') || Math.min(a, b) >= height('T')
}

/** Nothing above a nine, small pairs included: the hands a beginner throws away. */
function looksWeak(cards: readonly Card[]): boolean {
  return !looksStrong(cards) && cards.every((c) => height(c.rank) <= height('9'))
}

/**
 * The hands one step from this one: the other suitedness, and either card one
 * rank higher. A pair is not a step from two different cards, so it is skipped.
 */
function neighbours(hand: string): string[] {
  const [hi, lo] = [hand[0] as Rank, hand[1] as Rank]
  if (hi === lo) return []
  const suited = hand.endsWith('s')
  const up = (rank: Rank) => RANKS[height(rank) + 1]
  const out = [`${hi}${lo}${suited ? 'o' : 's'}`]
  const higher = up(hi)
  if (higher) out.push(`${higher}${lo}${suited ? 's' : 'o'}`)
  const lower = up(lo)
  if (lower && lower !== hi) out.push(`${hi}${lower}${suited ? 's' : 'o'}`)
  return out
}

/**
 * Is this a hand nobody would stop to think about? Off the chart, and not even
 * next to it: nothing a step away from it is on the chart either. 7-2, J-6, Q-2
 * offsuit. True, and a fold, and not a question — the same objection
 * `one-sided` makes on every kind.
 *
 * **A hand next to the chart is kept**, because that is where the chart is
 * actually learned: K8o is a fold because K8s is the one on it, and 65o is a
 * fold because 65s is. Keeping those and dropping the rags is also what keeps
 * the stream from being mostly folds (see the balance test).
 */
function noQuestion(hand: string): boolean {
  if (HAND_BANDS[hand] !== undefined) return false
  return !neighbours(hand).some((next) => HAND_BANDS[next] !== undefined)
}

/**
 * How a spot is shaped. See {@link OpenShape}: whether the seat is what decides
 * it, and whether the cards look like the opposite of the answer.
 */
function shapeOf(seat: Seat, cards: readonly Card[], hand: string): OpenShape {
  const opens = opensHand(seat, hand)
  if ((opens && looksWeak(cards)) || (!opens && looksStrong(cards))) return 'looks-wrong'
  const everywhere = OPENING_SEATS.map((id) => opensHand(seatById(id), hand))
  return everywhere.every((v) => v === opens) ? 'every-seat' : 'seat-decides'
}

/**
 * Deal the open-or-fold spot at `seed`, or say why it was thrown away.
 *
 * One rejection, from the shared vocabulary: `one-sided`, for the rags that
 * fold from every seat without anybody having to look (see
 * {@link noQuestion}). Everything else is asked. With the coin above, that
 * keeps the stream from being mostly folds, and the pack on top of it deals
 * exactly five raises and five folds, so no single button beats a coin there.
 */
export function generateOpenOrFold(seed: number): Generated {
  const deck = shuffledDeck(mulberry32(seed))
  const hero = deck.slice(0, 2)
  const hand = holeKey(hero)
  if (!hand) return reject('unexplainable')
  if (noQuestion(hand)) return reject('one-sided')

  // The second stream, as the other kinds do it: reproducible from the seed and
  // independent of the shuffle.
  const rng = mulberry32((seed ^ 0x2c1b_3c6d) >>> 0)
  // **A coin decides which way a spot the seat decides is asked**, the way the
  // pricing kinds toss for call or fold. A hand in the middle of the chart
  // opens from three seats of four, so a seat picked at random would make
  // "raise" the answer most of the time on exactly the rung the pack is for.
  // A hand the seat does not decide has one answer wherever it sits.
  const raising = OPENING_SEATS.filter((id) => opensHand(seatById(id), hand))
  const folding = OPENING_SEATS.filter((id) => !opensHand(seatById(id), hand))
  const coin = rng()
  const pool =
    raising.length === 0 || folding.length === 0 ? OPENING_SEATS : coin < 0.5 ? raising : folding
  const seatId = pool[Math.floor(rng() * pool.length)]
  const seat = seatById(seatId)
  const answer = openAnswer(seat, hand)
  const shape = shapeOf(seat, hero, hand)

  const choices: DrillChoice[] = [
    { id: 'fold', label: 'Fold', cards: [], winning: answer === 'fold' },
    { id: 'raise', label: 'Raise', cards: [], winning: answer === 'raise' },
  ]

  return accept({
    kind: 'open-or-fold',
    seed,
    board: [],
    choices,
    hands: [{ label: 'You', cards: hero, detail: hand }],
    seat: seatId,
    answer,
    settledBy: shape,
    difficulty: openDifficulty(shape),
    explanation: openVerdict(seatId, hand),
  })
}
