// Grading the first move before the flop, when it folds round to you
// (docs/rating.md → "What counts"). Two charts the app already teaches answer
// these spots, so the Pip Rating reads its verdict off them instead of the
// call-or-fold arithmetic, which has nothing to say about a raise.
//
// **Fifteen big blinds or fewer: the shove chart.** lib/drills/shoveRange
// solves shove-or-fold for every seat and stack from 3 to 15 big blinds, and
// prices every hand against the solved calling ranges behind (`shoveEv`). So a
// shove or a fold here has an exact value in big blinds, with the chart's own
// sampling margin as the noise floor. Nothing is guessed about the players
// behind: the callers are the equilibrium ones, not Pip's bots.
//
// **Twenty-five big blinds or more: the opening chart.** The chart the guides
// and the open-or-fold pack teach (`opensHand` in config/positions). It says
// raise or fold and nothing about how much either is worth, so the costs below
// are fixed sizes by how far off the chart a move was. That is a stated
// simplification, not a solver: a hand one band off costs a little, junk from
// under the gun costs more, and folding a premium costs the most.
//
// Not graded: the blinds' deep-stacked first move (the chart opens from four
// seats only), stacks between 15 and 25 big blinds (neither chart is for
// them), a short-stacked limp or small raise (the shove chart has no value for
// either), and folding a hand that is on no chart from any seat, or that
// would lose more than a big blind shoved. That last one is a choice: folding junk is right and free, and counting thousands of
// free folds would let a player who never plays a hand rate well on them.

import { holeKey } from '@/config/handNames'
import { PREMIUM_HANDS, type SeatId, opensHand, seatById } from '@/config/positions'
import { BAND_ORDER, HAND_BANDS } from '@/config/startingHands'
import {
  BLINDS,
  MAX_STACK,
  MIN_STACK,
  type ShoveSeat,
  classOf,
  nashFor,
  posted,
  shoveEv,
} from '@/lib/drills/shoveRange'
import type { Card } from '@/lib/poker/cards'
import type { RatingKind } from './maths'

/** What a first-in spot looked like (`HeroDecision.firstIn`). */
export interface FirstIn {
  behind: number
  effectiveBb: number
  totalChips: number
}

/** The hero's first move, as the hand record has it. */
export interface FirstMove {
  type: string
  /** A raise's "to" total, in chips. */
  amount?: number
}

/** One graded first move: the same three numbers every rated decision has. */
export interface PreflopGrade {
  kind: RatingKind
  loss: number
  stake: number
}

/** The deepest stack the shove chart answers, and the shallowest the opening chart does. */
export const SHOVE_UP_TO_BB = MAX_STACK
export const OPEN_FROM_BB = 25

/**
 * A short-stacked fold is only counted when shoving was worth more than this,
 * in big blinds: folding a hand that loses this much shoved is as free as
 * folding junk deep, and as uncounted.
 */
const CLEAR_FOLD_BB = -1

/** A raise of at least this share of your stack is a shove: you cannot fold to a reshove. */
const COMMITTED = 0.5

const SHOVE_SEAT: Record<number, ShoveSeat> = { 1: 'sb', 2: 'btn', 3: 'co', 4: 'mp', 5: 'utg' }
const OPEN_SEAT: Record<number, SeatId> = { 2: 'btn', 3: 'co', 4: 'mp', 5: 'utg' }

/**
 * The opening chart's costs, in big blinds. Sized so one mistake reads like
 * one: a hand a band too loose costs less than a typical bad call, junk under
 * the gun about a big blind, a missed premium two.
 */
export const OPEN_COST = {
  /** Per band a raised hand sits past where this seat opens. */
  loosePerBand: 0.4,
  /** Folding a hand this seat opens, plus `loosePerBand` per band it was inside. */
  tightBase: 0.3,
  /** Folding jacks or better, or ace-king. */
  premiumFold: 2,
  /** Limping a hand worth a raise: raising was better, not by much. */
  limpInRange: 0.25,
  /** Limping a hand worth a fold, per band past the line. */
  limpPerBand: 0.3,
} as const

/** The pot an open is played for: the blinds and a standard raise. */
const OPEN_STAKE = BLINDS + 2.5

/** How deep in the chart a hand sits: 0 opens everywhere, 3 is on no chart at all. */
function handLevel(hand: string): number {
  const band = HAND_BANDS[hand]
  return band === undefined ? BAND_ORDER.length : BAND_ORDER.indexOf(band)
}

/**
 * Grade the hero's first move in a spot it folded round to them, or null when
 * neither chart answers it (see the top of the file).
 */
export function gradeFirstIn(
  hole: readonly Card[],
  spot: FirstIn,
  move: FirstMove,
  bigBlind: number,
): PreflopGrade | null {
  if (hole.length !== 2 || bigBlind <= 0) return null
  const raised = move.type === 'raise' || move.type === 'bet' || move.type === 'allin'
  const shoved =
    raised && (move.type === 'allin' || (move.amount ?? 0) >= spot.totalChips * COMMITTED)

  if (spot.effectiveBb <= SHOVE_UP_TO_BB) {
    const seat = SHOVE_SEAT[Math.min(spot.behind, 5)]
    if (!seat) return null
    if (!shoved && move.type !== 'fold') return null
    const stack = Math.min(MAX_STACK, Math.max(MIN_STACK, Math.round(spot.effectiveBb)))
    const value = shoveEv(classOf(hole), { seat, stack }, nashFor({ seat, stack }).call)
    if (!shoved && value.ev < CLEAR_FOLD_BB) return null
    const stake = BLINDS + stack - posted(seat)
    // Inside the chart's own sampling margin it cannot say which was better.
    const wrong = shoved ? -value.ev : value.ev
    const loss = Math.abs(value.ev) <= value.band ? 0 : Math.min(stake, Math.max(0, wrong))
    return { kind: 'preflop-shove', loss, stake }
  }

  if (spot.effectiveBb < OPEN_FROM_BB) return null
  const seatId = OPEN_SEAT[Math.min(spot.behind, 5)]
  if (!seatId) return null
  const hand = holeKey(hole)
  if (!hand) return null
  const seat = seatById(seatId)
  const level = handLevel(hand)
  const seatLevel = seat.opens === null ? -1 : BAND_ORDER.indexOf(seat.opens)
  const opens = opensHand(seat, hand)
  const premium = (PREMIUM_HANDS as readonly string[]).includes(hand)

  let loss: number
  if (raised) {
    loss = opens ? 0 : OPEN_COST.loosePerBand * (level - seatLevel)
  } else if (move.type === 'call') {
    loss = opens ? OPEN_COST.limpInRange : OPEN_COST.limpPerBand * (level - seatLevel)
  } else if (move.type === 'fold') {
    // Folding junk is right and free, and not counted (top of the file).
    if (level >= BAND_ORDER.length) return null
    loss = premium
      ? OPEN_COST.premiumFold
      : opens
        ? OPEN_COST.tightBase + OPEN_COST.loosePerBand * (seatLevel - level)
        : 0
  } else {
    return null
  }
  return { kind: 'preflop-open', loss: Math.min(OPEN_STAKE, loss), stake: OPEN_STAKE }
}
