// Short-stacked preflop play, from the solved chart.
//
// Blinds here climb every few hands, so most of a sit-and-go is played at
// fifteen big blinds or fewer, where the only sensible first move is all-in or
// fold. The equity-and-gates policy was written for deep stacks and plays this
// part of the game by accident: it opens to about three times the blind, which
// at ten big blinds is a third of its stack, and it calls a shove by comparing
// equity against a range read off chips committed rather than against the hands
// that actually shove at that depth.
//
// The app already carries the right answer. The shove-or-fold drills solve the
// Nash equilibrium of exactly this spot for every seat and every stack from 3 to
// 15 big blinds (lib/drills/shoveRange, written by `pnpm shove-chart`): which
// hands shove when it folds to you, and which hands call behind. A skilled seat
// plays straight off it, both as the shover and as the caller.
//
// The chart is six-handed. A shorter table is mapped by how many players are
// left to act behind, which is what a seat in the chart actually means: the
// button of a four-handed table is the chart's cutoff, with two behind it.
// Hold'em only, because the chart is Hold'em equities.

import type { SeatId } from '@/config/positions'
import {
  behind,
  classOf,
  MAX_STACK,
  MIN_STACK,
  nashFor,
  type ShoveSeat,
} from '@/lib/drills/shoveRange'
import type { Rng } from '../cards'
import { type Action, type HandState, legalActions } from '../engine'

type Player = HandState['players'][number]

const SEAT_BY_BEHIND: Record<number, ShoveSeat> = { 1: 'sb', 2: 'btn', 3: 'co', 4: 'mp', 5: 'utg' }

/** Dealt-in players in preflop acting order: first to act after the big blind, ending with it. */
function preflopOrder(state: HandState): Player[] {
  const n = state.players.length
  const dealt: Player[] = []
  for (let i = 1; i <= n; i++) {
    const p = state.players[(state.buttonIndex + i) % n]
    if (p.status !== 'out') dealt.push(p)
  }
  // Heads-up the button is the small blind and acts first preflop.
  if (dealt.length === 2) return [dealt[1], dealt[0]]
  // dealt is [sb, bb, first, ...button]; the order runs first..button, sb, bb.
  return [...dealt.slice(2), dealt[0], dealt[1]]
}

/** The chart seat for a player, by how many act after them preflop. Null for the big blind. */
function chartSeat(order: Player[], id: string): ShoveSeat | null {
  const after = order.length - 1 - order.findIndex((p) => p.id === id)
  if (after <= 0) return null
  return SEAT_BY_BEHIND[Math.min(after, 5)]
}

/** The same, but any seat including the big blind, for reading a calling range. */
function seatOf(order: Player[], id: string): SeatId {
  return chartSeat(order, id) ?? 'bb'
}

const total = (p: Player) => p.stack + p.committedThisHand

const inChart = (bb: number) => Math.min(MAX_STACK, Math.max(MIN_STACK, Math.round(bb)))

/**
 * The chart's move for this spot, or null when the spot is not one the chart
 * answers (deep stacks, a limp or raise in front, Omaha, postflop).
 */
export function pushFoldAction(state: HandState, rng: Rng): Action | null {
  if (state.street !== 'preflop' || state.variant !== 'holdem') return null
  const legal = legalActions(state)
  const me = state.players[state.toActIndex]
  if (!legal || !me) return null
  const bb = Math.max(state.bigBlind, 1)
  const order = preflopOrder(state)
  const others = order.filter((p) => p.id !== me.id && p.status !== 'folded')

  // --- folded to us: shove or fold ---------------------------------------
  const untouched = state.currentBet === state.bigBlind && others.every((p) => !p.hasActed)
  if (untouched) {
    const seat = chartSeat(order, me.id)
    if (!seat) return null
    const biggestBehind = Math.max(0, ...others.map(total))
    const effective = Math.min(total(me), biggestBehind) / bb
    if (effective > MAX_STACK) return null
    const range = nashFor({ seat, stack: inChart(effective) }).shove
    if (rng() < range[classOf(me.hole)]) {
      return legal.canRaise
        ? { type: 'raise', amount: legal.maxRaiseTo }
        : legal.canCall
          ? { type: 'call' }
          : { type: 'check' }
    }
    return legal.canCheck ? { type: 'check' } : { type: 'fold' }
  }

  // --- one short all-in in front, everyone else folded: call or fold -------
  const shovers = others.filter((p) => p.hasActed)
  if (shovers.length !== 1) return null
  const shover = shovers[0]
  if (shover.status !== 'allin' || shover.committedThisStreet !== state.currentBet) return null
  // Nobody may have called or raised along the way, me included. And there has
  // to be something to call: an all-in for exactly the big blind leaves the big
  // blind a free check, which is the policy's to take.
  if (me.hasActed || !legal.canCall) return null
  const shoverSeat = chartSeat(order, shover.id)
  if (!shoverSeat) return null
  const shoveBb = Math.min(total(shover), total(me)) / bb
  if (shoveBb > MAX_STACK) return null
  const callers = behind(shoverSeat)
  const idx = callers.indexOf(seatOf(order, me.id))
  if (idx < 0) return null
  const range = nashFor({ seat: shoverSeat, stack: inChart(shoveBb) }).call[idx]
  if (rng() < range[classOf(me.hole)]) return { type: 'call' }
  return { type: 'fold' }
}
