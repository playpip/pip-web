import { holeKey } from '@/config/handNames'
import { SEATS_AT_A_TABLE, type SeatId, seatById } from '@/config/positions'
import { pct } from '@/config/potOdds'
import { seatOfIndex } from '@/lib/lessons/scene'
import { type Card, cardToString, mulberry32, shuffledDeck } from '@/lib/poker/cards'
import { type HandState, applyAction, startHand } from '@/lib/poker/engine'
import { type ShoveShape, shoveDifficulty } from './rating'
import {
  SHOVE_SEATS,
  STACKS,
  type ShoveSeat,
  type ShoveValue,
  type Spot,
  behind,
  callerModels,
  classOf,
  shoveEv,
} from './shoveRange'
import { type DrillChoice, type Generated, type ShoveSummary, accept, reject } from './types'

// Shove or fold: the practice pack for a short stack.
//
// It folds to you in a tournament. You have somewhere between three and
// fifteen big blinds, two cards, and two answers: all of it, or none of it.
// The spot a beginner handles worst in both directions — folding a stack away
// one blind at a time waiting for aces, or shoving fifteen big blinds with a
// hand that is only ever called by better.
//
// **Graded by arithmetic, not by feel.** The answer is the sign of one line of
// expected value — the blinds you win when everybody folds, against what you
// win and lose when somebody calls — over the Nash calling ranges for the seat
// and the stack. All of it is in ./shoveRange, including what is a model and
// why each simplification is there.
//
// **Asked only when it is clear.** Every spot is priced three times: against
// Nash's callers, a fifth tighter, and a quarter looser (CALLER_SPREAD). It is
// asked when all three agree and each is clear of the margin after the chart's
// own sampling band is taken off. The chart is the only sampled number in this
// kind, so the band is exactly how far it could be out, carried through to big
// blinds (see `shoveEv`).
//
// **Near the line, never miles from it.** A spot is only dealt from a seat and
// stack where the shove is within two and a half big blinds of folding
// (MAX_GAP): aces fifteen deep are not a question, and nor is seven-deuce under
// the gun. Where a hand is a shove from some spots and a fold from others, a
// coin decides which of the two it is dealt as; the pack on top deals five of
// each (lib/drills/pack.ts).
//
// **What it says about the free guides.** /learn teaches opening at a hundred
// big blinds, where a raise is two and a half and a fold costs nothing. None of
// that is contradicted here, because none of it is about fifteen big blinds:
// the sentence under every spot names the stack, and the lesson says in as
// many words that a short stack changes the question.

/** Under this many big blinds apart, after the sampling band, shoving and folding are the same decision. */
export const SHOVE_MARGIN = 0.25

/** And a spot this far apart at Nash is a look rather than a question. */
const MAX_GAP = 2.5

/** Big blinds apart, at Nash, at or above which a spot is clear. */
const CLEAR_EV = 0.8

/** And at or above which it is close rather than thin. */
const CLOSE_EV = 0.5

/** Where you are, as the middle of a sentence. */
export const SHOVE_WHERE: Record<ShoveSeat, string> = {
  utg: 'under the gun',
  mp: 'in the middle seat',
  co: 'in the cutoff',
  btn: 'on the button',
  sb: 'in the small blind',
}

const NUMBER = ['nobody', 'one', 'two', 'three', 'four', 'five'] as const

/** One spot priced at the three sets of callers, and what that settles. */
export interface ShoveVerdict {
  spot: Spot
  tight: ShoveValue
  nash: ShoveValue
  loose: ShoveValue
  /** The answer, or null when the three disagree or any is inside the margin. */
  answer: 'shove' | 'fold' | null
}

/** Price hand class `h` from one spot, and say whether it is a question. */
export function shoveVerdict(h: number, spot: Spot): ShoveVerdict {
  const models = callerModels(spot)
  const tight = shoveEv(h, spot, models.tight)
  const nash = shoveEv(h, spot, models.nash)
  const loose = shoveEv(h, spot, models.loose)
  const all = [tight, nash, loose]
  const clear = (v: ShoveValue) => Math.abs(v.ev) - v.band >= SHOVE_MARGIN
  const answer = all.every((v) => v.ev > 0 && clear(v))
    ? 'shove'
    : all.every((v) => v.ev < 0 && clear(v))
      ? 'fold'
      : null
  return { spot, tight, nash, loose, answer }
}

/** Every seat and stack the chart is solved for. */
const SPOTS: readonly Spot[] = SHOVE_SEATS.flatMap((seat) =>
  STACKS.map((stack) => ({ seat, stack })),
)

/**
 * Deal the shove-or-fold spot at `seed`, or say why it was thrown away.
 *
 * - `one-sided`: every seat and stack is too far from the line to be a
 *   question (aces, and the very worst hands, nearly everywhere).
 * - `ambiguous`: it would have been asked, but one side only ever comes out
 *   inside the margin or with the three sets of callers disagreeing.
 */
export function generateShoveOrFold(seed: number): Generated {
  const deck = shuffledDeck(mulberry32(seed))
  const hero = deck.slice(0, 2)
  const hand = holeKey(hero)
  if (!hand) return reject('unexplainable')
  const h = classOf(hero)

  const verdicts = SPOTS.map((spot) => shoveVerdict(h, spot))
  const askable = verdicts.filter((v) => v.answer && Math.abs(v.nash.ev) <= MAX_GAP)
  const shoves = askable.filter((v) => v.answer === 'shove')
  const folds = askable.filter((v) => v.answer === 'fold')
  if (askable.length === 0) {
    const nearMiss = verdicts.some((v) => !v.answer && Math.abs(v.nash.ev) <= MAX_GAP)
    return reject(nearMiss ? 'ambiguous' : 'one-sided')
  }

  // The second stream, as the other kinds do it: reproducible from the seed and
  // independent of the shuffle. A coin for which way it is asked, where the hand
  // has both; a hand that is only ever a shove (or only ever a fold) near the
  // line is asked that way, from wherever it is closest to being the other.
  const rng = mulberry32((seed ^ 0x6a09_e667) >>> 0)
  const coin = rng() < 0.5
  const wantsShove = folds.length === 0 || (shoves.length > 0 && coin)
  const side = wantsShove ? shoves : folds
  // A stack first, then a seat at that stack. Uniform over spots would deal the
  // three- and four-big-blind spots most of the time, because that is where the
  // most seats are clear; a stack first spreads the pack across the depths.
  const stacks = [...new Set(side.map((v) => v.spot.stack))]
  const stack = stacks[Math.floor(rng() * stacks.length)]
  const atStack = side.filter((v) => v.spot.stack === stack)
  const picked = atStack[Math.floor(rng() * atStack.length)]
  const answer = wantsShove ? 'shove' : 'fold'
  const { spot, nash } = picked

  const choices: DrillChoice[] = [
    { id: 'fold', label: 'Fold', cards: [], winning: answer === 'fold' },
    { id: 'shove', label: 'All in', cards: [], winning: answer === 'shove' },
  ]
  const shape = shapeOf(Math.abs(nash.ev))

  return accept({
    kind: 'shove-or-fold',
    seed,
    board: [],
    choices,
    hands: [{ label: 'You', cards: hero, detail: hand }],
    seat: spot.seat,
    shove: summarise(spot, nash),
    answer,
    settledBy: shape,
    difficulty: shoveDifficulty(shape),
    explanation: shoveExplanation(hand, spot, nash),
  })
}

/** See {@link ShoveShape}: how far the shove is from the line, not which side of it. */
function shapeOf(gap: number): ShoveShape {
  return gap >= CLEAR_EV ? 'clear-shove' : gap >= CLOSE_EV ? 'close-shove' : 'thin-shove'
}

function summarise(spot: Spot, value: ShoveValue): ShoveSummary {
  return {
    stack: spot.stack,
    ev: value.ev,
    foldAll: value.foldAll,
    equityCalled: value.equityCalled,
    callers: value.callers.map((c) => ({ seat: c.seat, calls: c.calls, equity: c.equity })),
  }
}

/** Big blinds, to one place, the way the sentence says them. */
const bb = (n: number) => {
  const text = Math.abs(n).toFixed(1).replace(/\.0$/, '')
  return `${text} big ${text === '1' ? 'blind' : 'blinds'}`
}

/**
 * The sentence, out of the same numbers that set the answer, at Nash's callers.
 *
 * Three facts and the verdict: how often everybody folds (which is what wins
 * the blinds), how often you win when somebody does not, and what the shove is
 * worth against folding. The stack comes first, because it is what the spot is
 * about and it is what a player at a hundred big blinds forgets.
 */
export function shoveExplanation(hand: string, spot: Spot, value: ShoveValue): string {
  const where = `With ${spot.stack} big blinds ${SHOVE_WHERE[spot.seat]}`
  const left = behind(spot.seat).length
  const folds = pct(value.foldAll)
  const wins = pct(value.equityCalled)
  if (value.ev > 0) {
    const everybody =
      left === 1
        ? 'the big blind folds'
        : left === 2
          ? 'both players behind you fold'
          : `all ${NUMBER[left]} behind you fold`
    return `${where}, ${hand} is a shove: ${everybody} ${folds}% of the time, which wins the blinds, and when you are called you still win ${wins}%. Shoving is worth ${bb(value.ev)} more than folding.`
  }
  return `${where}, ${hand} is a fold: with ${NUMBER[left]} still to act you are called ${pct(1 - value.foldAll)}% of the time, and against the hands that call you win ${wins}%. Shoving loses ${bb(value.ev)} against folding.`
}

// ---------------------------------------------------------------------------
// The table the spot is drawn on.
// ---------------------------------------------------------------------------

/** The blinds on the felt, in chips: a hundred to the big blind, so seven big blinds reads as 700. */
export const SHOVE_BLINDS = { small: 50, big: 100 } as const

/**
 * The spot as a real hand, dealt and played by the engine to the moment it is
 * your turn: six seats, the blinds posted, everybody before you folded.
 *
 * Your stack is the spot's; everybody else's covers it, drawn from the seed,
 * because the chart assumes you are the short stack and a table that showed
 * somebody shorter would be the screen contradicting the answer key. Pure and
 * seeded, like the lesson scenes it borrows its seating from.
 */
export function shoveTable(
  hero: readonly Card[],
  seat: ShoveSeat,
  stack: number,
  seed: number,
): HandState {
  const fixed = new Set(hero.map(cardToString))
  const rest = shuffledDeck(mulberry32(seed)).filter((card) => !fixed.has(cardToString(card)))
  const rng = mulberry32((seed ^ 0x3c6e_f372) >>> 0)
  const heroOffset = seatById(seat).offset
  const seats = Array.from({ length: SEATS_AT_A_TABLE }, (_, i) => {
    const id = seatOfIndex(seat, i)
    const big = i === 0 ? stack : stack + 3 + Math.floor(rng() * 36)
    return { id, name: i === 0 ? 'You' : seatById(id).name, stack: big * SHOVE_BLINDS.big }
  })
  let state = startHand({
    seats,
    buttonIndex: (SEATS_AT_A_TABLE - heroOffset) % SEATS_AT_A_TABLE,
    smallBlind: SHOVE_BLINDS.small,
    bigBlind: SHOVE_BLINDS.big,
    deck: rest,
  })
  // Your two cards are the spot's; the two the deal gave you are set aside.
  state = {
    ...state,
    players: state.players.map((p, i) => (i === 0 ? { ...p, hole: [...hero] } : p)),
  }
  const order: SeatId[] = ['utg', 'mp', 'co', 'btn', 'sb', 'bb']
  for (const id of order.slice(0, order.indexOf(seat))) {
    const actor = state.players[state.toActIndex]
    if (actor?.id !== id) throw new Error(`It is not ${id}'s turn`)
    state = applyAction(state, { type: 'fold' })
  }
  return state
}

/** The same table, after your answer: all in, or folded. */
export function playShove(state: HandState, choice: 'shove' | 'fold'): HandState {
  const you = state.players[state.toActIndex]
  if (!you) return state
  return applyAction(
    state,
    choice === 'shove'
      ? { type: 'raise', amount: you.stack + you.committedThisStreet }
      : { type: 'fold' },
  )
}
