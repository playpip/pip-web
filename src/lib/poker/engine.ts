// Pure Texas Hold'em betting engine. No React, no I/O — a state value plus pure
// transitions, so it can be driven by the UI store now and a server later, and
// exhaustively unit-tested. Hand ranking is delegated to handEval (pokersolver);
// everything here — blinds, streets, action legality, pots, payouts — is ours.

import type { Card, Rng } from './cards'
import { shuffledDeck } from './cards'
import { determineWinners } from './handEval'
import { buildPots, type Pot } from './pots'

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'complete'
export type PlayerStatus = 'active' | 'folded' | 'allin' | 'out'
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise'

export interface Action {
  type: ActionType
  /** For bet/raise: the TOTAL to commit this street (the "raise to" amount). */
  amount?: number
}

export interface Player {
  id: string
  name: string
  stack: number
  hole: Card[]
  status: PlayerStatus
  /** Chips in front of the player this betting round. */
  committedThisStreet: number
  /** Total chips committed across the whole hand (drives side pots). */
  committedThisHand: number
  /** Has acted since the last aggressive action this street. */
  hasActed: boolean
}

export interface PotAward {
  amount: number
  winners: string[]
}

export interface HandResult {
  showdown: boolean
  /** Chips won per player id (gross). */
  payouts: Record<string, number>
  potsAwarded: PotAward[]
  /** Only present at a real showdown. */
  evaluations?: Record<string, { name: string; description: string }>
}

export interface HandState {
  players: Player[]
  buttonIndex: number
  smallBlind: number
  bigBlind: number
  street: Street
  community: Card[]
  deck: Card[]
  /** Highest committedThisStreet this round. */
  currentBet: number
  /** Size of the last full raise increment (min-raise reference). */
  lastRaiseSize: number
  /** Index of the player to act, or -1 when nobody needs to act. */
  toActIndex: number
  pots: Pot<string>[]
  result: HandResult | null
}

export interface SeatConfig {
  id: string
  name: string
  stack: number
}

export interface StartHandOptions {
  seats: SeatConfig[]
  buttonIndex: number
  smallBlind: number
  bigBlind: number
  /** RNG for shuffling (ignored if `deck` is supplied). */
  rng?: Rng
  /** Preset deck (tests). Cards are drawn from the END of the array. */
  deck?: Card[]
}

// --- seat iteration helpers ------------------------------------------------

/** Next seat (from exclusive) whose status is any of `statuses`, or -1. */
function nextSeatWith(
  players: Player[],
  from: number,
  statuses: PlayerStatus[],
): number {
  for (let i = 1; i <= players.length; i++) {
    const idx = (from + i) % players.length
    if (statuses.includes(players[idx].status)) return idx
  }
  return -1
}

const inHand = (p: Player): boolean => p.status !== 'folded' && p.status !== 'out'
const canAct = (p: Player): boolean => p.status === 'active'

// --- chip movement ---------------------------------------------------------

function commit(p: Player, chips: number): void {
  const amount = Math.min(chips, p.stack)
  p.stack -= amount
  p.committedThisStreet += amount
  p.committedThisHand += amount
  if (p.stack === 0) p.status = 'allin'
}

// --- start a hand ----------------------------------------------------------

export function startHand(opts: StartHandOptions): HandState {
  const { seats, buttonIndex, smallBlind, bigBlind } = opts
  const deck = opts.deck ? [...opts.deck] : shuffledDeck(opts.rng ?? Math.random)

  const players: Player[] = seats.map((s) => ({
    id: s.id,
    name: s.name,
    stack: s.stack,
    hole: [],
    status: s.stack > 0 ? 'active' : 'out',
    committedThisStreet: 0,
    committedThisHand: 0,
    hasActed: false,
  }))

  // Deal two hole cards to each dealt-in player.
  for (let round = 0; round < 2; round++) {
    for (const p of players) {
      if (p.status !== 'out') p.hole.push(deck.pop()!)
    }
  }

  const state: HandState = {
    players,
    buttonIndex,
    smallBlind,
    bigBlind,
    street: 'preflop',
    community: [],
    deck,
    currentBet: 0,
    lastRaiseSize: bigBlind,
    toActIndex: -1,
    pots: [],
    result: null,
  }

  const dealt = players.filter((p) => p.status !== 'out').length
  const heads = dealt === 2

  // Blind positions. Heads-up: button is the small blind.
  const sbIndex = heads
    ? buttonIndex
    : nextSeatWith(players, buttonIndex, ['active'])
  const bbIndex = nextSeatWith(players, sbIndex, ['active'])

  commit(players[sbIndex], smallBlind)
  commit(players[bbIndex], bigBlind)
  state.currentBet = bigBlind

  // First to act preflop: heads-up the SB/button acts first; otherwise the
  // seat left of the big blind (UTG).
  state.toActIndex = heads
    ? sbIndex
    : nextSeatWith(players, bbIndex, ['active'])

  // Posting a blind can put a player all-in. If the designated first actor
  // can no longer act, pass the action on. And when no further betting is
  // possible — at most one player can act, and they already have the top
  // commitment (their lone opponent is all-in for less) — real rooms deal
  // the board out with no action at all: straight to showdown.
  const first = players[state.toActIndex]
  if (!first || !canAct(first)) {
    const actors = players.filter(canAct)
    const noBettingPossible =
      actors.length === 0 ||
      (actors.length === 1 && actors[0].committedThisStreet >= state.currentBet)
    if (noBettingPossible) return advanceStreet(state)
    return advance(state)
  }

  return state
}

// --- legal actions ---------------------------------------------------------

export interface LegalActions {
  canFold: boolean
  canCheck: boolean
  /** Chips required to call (already capped at the player's stack). */
  callAmount: number
  canCall: boolean
  canBet: boolean
  canRaise: boolean
  /** Minimum legal "to" amount for a bet/raise. */
  minRaiseTo: number
  /** Maximum "to" amount (all-in). */
  maxRaiseTo: number
}

export function legalActions(state: HandState): LegalActions | null {
  const p = state.players[state.toActIndex]
  if (!p || !canAct(p)) return null

  const toCall = state.currentBet - p.committedThisStreet
  const maxRaiseTo = p.committedThisStreet + p.stack
  const betOpen = state.currentBet > 0

  const minBetTo = state.bigBlind
  const minRaiseTo = state.currentBet + state.lastRaiseSize

  return {
    canFold: true,
    canCheck: toCall === 0,
    callAmount: Math.min(toCall, p.stack),
    canCall: toCall > 0 && p.stack > 0,
    canBet: !betOpen && p.stack > 0,
    canRaise: betOpen && p.stack > toCall,
    minRaiseTo: Math.min(betOpen ? minRaiseTo : minBetTo, maxRaiseTo),
    maxRaiseTo,
  }
}

// --- apply an action -------------------------------------------------------

export function applyAction(prev: HandState, action: Action): HandState {
  const state: HandState = structuredClone(prev)
  const legal = legalActions(state)
  if (!legal) throw new Error('No player to act')

  const idx = state.toActIndex
  const p = state.players[idx]

  switch (action.type) {
    case 'fold': {
      p.status = 'folded'
      p.hasActed = true
      break
    }
    case 'check': {
      if (!legal.canCheck) throw new Error('Cannot check facing a bet')
      p.hasActed = true
      break
    }
    case 'call': {
      if (!legal.canCall) throw new Error('Nothing to call')
      commit(p, legal.callAmount)
      p.hasActed = true
      break
    }
    case 'bet':
    case 'raise': {
      const target = action.amount ?? 0
      const isAllIn = target === legal.maxRaiseTo
      if (target > legal.maxRaiseTo) throw new Error('Raise exceeds stack')
      if (target < legal.minRaiseTo && !isAllIn) {
        throw new Error('Raise below minimum')
      }
      const previousBet = state.currentBet
      const increment = target - previousBet
      commit(p, target - p.committedThisStreet)
      p.hasActed = true

      if (target > previousBet) state.currentBet = target
      // A full raise re-opens the action; a short all-in does not.
      if (increment >= state.lastRaiseSize) {
        state.lastRaiseSize = increment
        for (const other of state.players) {
          if (other !== p && other.status === 'active') other.hasActed = false
        }
      }
      break
    }
  }

  return advance(state)
}

// --- round / street progression -------------------------------------------

function bettingRoundComplete(state: HandState): boolean {
  const actors = state.players.filter(canAct)
  if (actors.length === 0) return true
  return actors.every(
    (p) => p.hasActed && p.committedThisStreet === state.currentBet,
  )
}

function advance(state: HandState): HandState {
  // Everyone but one has folded: that player wins immediately.
  const contenders = state.players.filter(inHand)
  if (contenders.length === 1) {
    return resolveNoShowdown(state, contenders[0])
  }

  if (!bettingRoundComplete(state)) {
    // Pass action to the next player who still owes a decision.
    const from = state.toActIndex
    for (let i = 1; i <= state.players.length; i++) {
      const idx = (from + i) % state.players.length
      const p = state.players[idx]
      if (p.status === 'active' && (!p.hasActed || p.committedThisStreet < state.currentBet)) {
        state.toActIndex = idx
        return state
      }
    }
  }

  return advanceStreet(state)
}

function collectStreet(state: HandState): void {
  for (const p of state.players) p.committedThisStreet = 0
  state.currentBet = 0
  state.lastRaiseSize = state.bigBlind
  for (const p of state.players) {
    if (p.status === 'active') p.hasActed = false
  }
}

function dealCommunity(state: HandState, n: number): void {
  for (let i = 0; i < n; i++) state.community.push(state.deck.pop()!)
}

const STREET_ORDER: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown']

function advanceStreet(state: HandState): HandState {
  collectStreet(state)

  // If at most one player can still act, no further betting is possible —
  // run the remaining board out to showdown.
  const runOut = state.players.filter(canAct).length <= 1

  let street = state.street
  while (true) {
    const nextStreet = STREET_ORDER[STREET_ORDER.indexOf(street) + 1]
    street = nextStreet

    if (street === 'flop') dealCommunity(state, 3)
    else if (street === 'turn' || street === 'river') dealCommunity(state, 1)

    if (street === 'showdown') {
      state.street = 'showdown'
      return resolveShowdown(state)
    }

    if (!runOut) {
      // Betting resumes on this street.
      state.street = street
      state.toActIndex = nextSeatWith(state.players, state.buttonIndex, ['active'])
      return state
    }
    // runOut: keep dealing until showdown.
  }
}

// --- resolution ------------------------------------------------------------

function resolveNoShowdown(state: HandState, winner: Player): HandState {
  const pot = state.players.reduce((sum, p) => sum + p.committedThisHand, 0)
  winner.stack += pot
  state.street = 'complete'
  state.toActIndex = -1
  state.pots = [{ amount: pot, eligible: [winner.id] }]
  state.result = {
    showdown: false,
    payouts: { [winner.id]: pot },
    potsAwarded: [{ amount: pot, winners: [winner.id] }],
  }
  return state
}

function resolveShowdown(state: HandState): HandState {
  const pots = buildPots(
    state.players
      .filter((p) => p.committedThisHand > 0)
      .map((p) => ({
        id: p.id,
        committed: p.committedThisHand,
        folded: p.status === 'folded',
      })),
  )

  const byId = new Map(state.players.map((p) => [p.id, p]))
  const payouts: Record<string, number> = {}
  const potsAwarded: PotAward[] = []
  const evaluations: Record<string, { name: string; description: string }> = {}

  for (const pot of pots) {
    const contenders = pot.eligible.map((id) => ({ id, hole: byId.get(id)!.hole }))
    const { winners, evaluations: evals } = determineWinners(contenders, state.community)
    for (const [id, ev] of evals) {
      evaluations[id] = { name: ev.name, description: ev.description }
    }
    for (const [amount, id] of splitChips(pot.amount, winners, state)) {
      payouts[id] = (payouts[id] ?? 0) + amount
      byId.get(id)!.stack += amount
    }
    potsAwarded.push({ amount: pot.amount, winners })
  }

  state.street = 'complete'
  state.toActIndex = -1
  state.pots = pots
  state.result = { showdown: true, payouts, potsAwarded, evaluations }
  return state
}

/**
 * Split a pot among winners, handling odd chips. Remainder chips go to the
 * earliest winners in seat order starting left of the button (poker convention).
 */
function splitChips(
  amount: number,
  winners: string[],
  state: HandState,
): Array<[number, string]> {
  const base = Math.floor(amount / winners.length)
  let remainder = amount - base * winners.length

  // Order winners by seat, starting from the first seat left of the button.
  const order = [...winners].sort((a, b) => seatOrder(state, a) - seatOrder(state, b))

  return order.map((id) => {
    let share = base
    if (remainder > 0) {
      share += 1
      remainder -= 1
    }
    return [share, id] as [number, string]
  })
}

function seatOrder(state: HandState, id: string): number {
  const idx = state.players.findIndex((p) => p.id === id)
  return (idx - state.buttonIndex - 1 + state.players.length) % state.players.length
}

// --- convenience -----------------------------------------------------------

/** Total chips currently in all pots + committed this street. */
export function potSize(state: HandState): number {
  return state.players.reduce((sum, p) => sum + p.committedThisHand, 0)
}

export const isHandComplete = (state: HandState): boolean => state.street === 'complete'
