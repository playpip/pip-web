// Pure Texas Hold'em betting engine. No React, no I/O — a state value plus pure
// transitions, so it can be driven by the UI store now and a server later, and
// exhaustively unit-tested. Hand ranking is delegated to handEval (pokersolver);
// everything here — blinds, streets, action legality, pots, payouts — is ours.

import type { Card, Rng } from './cards'
import { shuffledDeck } from './cards'
import { DECK_RANKS, HOLE_CARDS, type Variant, determineWinners, isOmaha } from './handEval'
import { determineLowWinners } from './hiLo'
import { buildPots, type Pot } from './pots'

/**
 * Where a hand is.
 *
 * `flop`/`turn`/`river` are board streets and never happen at Five-Card Draw;
 * `draw`/`postdraw` are the draw streets and never happen anywhere else. They
 * share one type because everything that reads a street — the pot, the pacing,
 * the coach, the history — cares only that the hand moved on, and a second
 * street type would have every one of those handling both.
 */
export type Street =
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'draw'
  | 'postdraw'
  | 'showdown'
  | 'complete'
export type PlayerStatus = 'active' | 'folded' | 'allin' | 'out'
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'draw'

export interface Action {
  type: ActionType
  /** For bet/raise: the TOTAL to commit this street (the "raise to" amount). */
  amount?: number
  /**
   * For `draw`: which of your own cards to throw away, by index.
   *
   * An empty array is standing pat, which is a real and common decision rather
   * than a no-op — it is why the draw round is a turn everybody takes rather
   * than something that happens to them.
   */
  discard?: number[]
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
  /**
   * Which game this hand is.
   *
   * On the state rather than passed around because every rule that differs —
   * how many cards were dealt, how a showdown is read, what a raise may be —
   * has to agree with the deal that already happened. A hand that was dealt
   * four cards and then evaluated as Hold'em is the bug this field exists to
   * make impossible.
   */
  variant: Variant
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
  /** Defaults to Hold'em, so every existing caller is unchanged. */
  variant?: Variant
}

// --- seat iteration helpers ------------------------------------------------

/** Next seat (from exclusive) whose status is any of `statuses`, or -1. */
function nextSeatWith(players: Player[], from: number, statuses: PlayerStatus[]): number {
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
  // The variant is read before the deck is built, because at Short Deck it
  // decides what is in it: thirty-six cards, no deuce through five. A short-deck
  // table dealt from a full deck is not short deck, and nothing downstream
  // would notice — the hands would just be wrong in a way that looks like luck.
  const variant = opts.variant ?? 'holdem'
  const deck = opts.deck
    ? [...opts.deck]
    : shuffledDeck(opts.rng ?? Math.random, DECK_RANKS[variant])

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

  // Deal each dealt-in player their hole cards, one card per player per round
  // the way a dealer does it. Two at Hold'em and Short Deck, four at Omaha.
  for (let round = 0; round < HOLE_CARDS[variant]; round++) {
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
    variant,
  }

  const dealt = players.filter((p) => p.status !== 'out').length
  const heads = dealt === 2

  // Blind positions. Heads-up: button is the small blind.
  const sbIndex = heads ? buttonIndex : nextSeatWith(players, buttonIndex, ['active'])
  const bbIndex = nextSeatWith(players, sbIndex, ['active'])

  commit(players[sbIndex], smallBlind)
  commit(players[bbIndex], bigBlind)
  state.currentBet = bigBlind

  // First to act preflop: heads-up the SB/button acts first; otherwise the
  // seat left of the big blind (UTG).
  state.toActIndex = heads ? sbIndex : nextSeatWith(players, bbIndex, ['active'])

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
  /**
   * The draw round, where discarding is the only thing you may do.
   *
   * Every betting flag above is false when this is true and vice versa: they
   * are two different kinds of turn, and a screen that offered Fold during the
   * draw would be offering something the engine will refuse.
   */
  canDraw: boolean
  /** How many cards you may throw away. Never more than you are holding. */
  maxDiscards: number
}

/**
 * The most a pot-limit player may put it to.
 *
 * The standard rule, written out because it is the one people get wrong: you
 * may raise by the size of the pot *after* your call. So the pot you are
 * raising into is everything already committed plus the chips you are about to
 * call, and your maximum total for this action is that call plus that pot —
 *
 *     maxTo = committedThisStreet + toCall + (pot + toCall)
 *
 * — where `pot` is every chip committed this hand, on every street, including
 * the current round's bets. A first bet on a street has `toCall === 0`, which
 * collapses to "bet the pot", exactly as it should.
 *
 * Capped by the stack upstream: pot-limit never lets you put in more than you
 * have, and it never stops you putting in all of it when the pot is bigger.
 */
function potLimitMaxTo(state: HandState, p: Player, toCall: number): number {
  const pot = state.players.reduce((sum, player) => sum + player.committedThisHand, 0)
  return p.committedThisStreet + toCall + (pot + toCall)
}

const NO_BETTING = {
  canFold: false,
  canCheck: false,
  callAmount: 0,
  canCall: false,
  canBet: false,
  canRaise: false,
  minRaiseTo: 0,
  maxRaiseTo: 0,
} as const

export function legalActions(state: HandState): LegalActions | null {
  const p = state.players[state.toActIndex]

  // The draw round admits all-in players, who still get their cards: they have
  // no chips left to argue with and every right to a better hand. `canAct` is
  // about betting and would shut them out of it.
  if (state.street === 'draw') {
    if (!p || !inHand(p) || p.hasActed) return null
    return { ...NO_BETTING, canDraw: true, maxDiscards: p.hole.length }
  }

  if (!p || !canAct(p)) return null

  const toCall = state.currentBet - p.committedThisStreet
  const allInTo = p.committedThisStreet + p.stack
  const betOpen = state.currentBet > 0

  // Omaha is pot-limit here, and Hold'em is no-limit. They are not separate
  // settings because we do not ship the other two combinations, and a `betting`
  // field nothing varies independently would be a lie about the design.
  const maxRaiseTo = isOmaha(state.variant)
    ? Math.min(allInTo, potLimitMaxTo(state, p, toCall))
    : allInTo

  const minBetTo = state.bigBlind
  const minRaiseTo = state.currentBet + state.lastRaiseSize

  return {
    canFold: true,
    canCheck: toCall === 0,
    callAmount: Math.min(toCall, p.stack),
    canCall: toCall > 0 && p.stack > 0,
    canBet: !betOpen && p.stack > 0,
    // At pot limit the cap can sit below the minimum raise on a short stack, in
    // which case the only legal aggressive action is all-in — and that is
    // already covered by calling. Offering a raise you cannot size is worse
    // than not offering one.
    canRaise: betOpen && p.stack > toCall && maxRaiseTo > state.currentBet,
    minRaiseTo: Math.min(betOpen ? minRaiseTo : minBetTo, maxRaiseTo),
    maxRaiseTo,
    canDraw: false,
    maxDiscards: 0,
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
      // Guarded like every other action, which it was not until Five-Card Draw
      // arrived and `tests/draw.test.ts` folded during the discard round and
      // was allowed to. Nothing before this could reach `applyAction` with
      // folding illegal — every betting street lets you fold — so the missing
      // check had never been wrong until there was a turn that is not a bet.
      if (!legal.canFold) throw new Error('Cannot fold here')
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
    case 'draw': {
      if (!legal.canDraw) throw new Error('Cannot draw outside the draw round')
      // De-duplicated and bounds-checked, because the indices come off a
      // screen: a repeated index would discard one card and draw two, which is
      // a deck leak rather than a rendering glitch.
      const discard = [...new Set(action.discard ?? [])]
        .filter((i) => Number.isInteger(i) && i >= 0 && i < p.hole.length)
        .sort((a, b) => a - b)
      const kept = p.hole.filter((_, i) => !discard.includes(i))
      const replacements: Card[] = []
      for (let i = 0; i < discard.length; i++) {
        const card = state.deck.pop()
        // Cannot happen at the sizes we deal — five seats of five is
        // twenty-five cards with twenty-five replacements at most, and the deck
        // is fifty-two. Thrown rather than `!`-asserted so that if a bigger
        // draw table is ever configured it fails loudly here instead of dealing
        // `undefined` to somebody.
        if (!card) throw new Error('the deck ran out during the draw')
        replacements.push(card)
      }
      p.hole = [...kept, ...replacements]
      p.hasActed = true
      return advanceDraw(state)
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
  return actors.every((p) => p.hasActed && p.committedThisStreet === state.currentBet)
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

/**
 * Pass the action to the next player who still owes a discard, or move on.
 *
 * Its own loop rather than `advance()`'s, because the draw round is not a
 * betting round: it admits all-in players (`inHand`, not `canAct`) and it is
 * over when everybody has drawn rather than when everybody has matched a bet.
 * Routing it through the betting machinery would have ended the round early
 * every time somebody was all-in, and dealt them their original five at a
 * showdown they had paid to reach.
 */
function advanceDraw(state: HandState): HandState {
  const from = state.toActIndex
  for (let i = 1; i <= state.players.length; i++) {
    const idx = (from + i) % state.players.length
    const p = state.players[idx]
    if (inHand(p) && !p.hasActed) {
      state.toActIndex = idx
      return state
    }
  }
  return advanceStreet(state)
}

/**
 * Five-Card Draw's streets: bet, discard, bet, show.
 *
 * Written out rather than folded into `STREET_ORDER` because the middle one is
 * not a betting round and the loop below is entirely about betting rounds —
 * dealing a board, skipping a street when nobody can act, resuming the action.
 * The draw round does none of those things and skipping it is never right.
 */
function advanceDrawStreet(state: HandState): HandState {
  if (state.street === 'preflop') {
    state.street = 'draw'
    for (const p of state.players) if (inHand(p)) p.hasActed = false
    state.toActIndex = nextSeatWith(state.players, state.buttonIndex, ['active', 'allin'])
    // Everybody left is all-in, so there is nobody to pass the action to and
    // nothing to bet afterwards. They keep what they were dealt.
    if (state.toActIndex === -1) {
      state.street = 'showdown'
      return resolveShowdown(state)
    }
    return state
  }

  if (state.street === 'draw') {
    // One player or fewer can still bet, so the second round would be a formality.
    if (state.players.filter(canAct).length <= 1) {
      state.street = 'showdown'
      return resolveShowdown(state)
    }
    state.street = 'postdraw'
    state.toActIndex = nextSeatWith(state.players, state.buttonIndex, ['active'])
    return state
  }

  state.street = 'showdown'
  return resolveShowdown(state)
}

function advanceStreet(state: HandState): HandState {
  collectStreet(state)
  if (state.variant === 'draw') return advanceDrawStreet(state)

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

  const award = (amount: number, winners: string[]) => {
    if (amount <= 0 || winners.length === 0) return
    for (const [share, id] of splitChips(amount, winners, state)) {
      payouts[id] = (payouts[id] ?? 0) + share
      byId.get(id)!.stack += share
    }
    potsAwarded.push({ amount, winners })
  }

  for (const pot of pots) {
    const contenders = pot.eligible.map((id) => ({ id, hole: byId.get(id)!.hole }))
    const { winners, evaluations: evals } = determineWinners(
      contenders,
      state.community,
      state.variant,
    )
    for (const [id, ev] of evals) {
      evaluations[id] = { name: ev.name, description: ev.description }
    }

    if (state.variant === 'omahahilo') {
      // Half the pot to the best low, when there is one. Two rules hold this
      // together and both are about chips going missing:
      //
      // 1. **No qualifying low means the high hand scoops.** Awarding half a
      //    pot to an empty winner list would silently delete it, and roughly
      //    half of all hi-lo pots have no low in them.
      // 2. **The odd chip goes high.** Halving an odd pot leaves one chip over,
      //    and it is the high half that gets it — the standard rule, and more
      //    importantly a stated one, because "round it somewhere" is how a pot
      //    stops adding up.
      const low = determineLowWinners(contenders, state.community)
      if (low.winners.length === 0) {
        award(pot.amount, winners)
      } else {
        const lowHalf = Math.floor(pot.amount / 2)
        award(pot.amount - lowHalf, winners)
        award(lowHalf, low.winners)
        for (const [id, hand] of low.lows) {
          const shown = evaluations[id]
          if (shown) shown.description = `${shown.description} · low ${hand.description}`
        }
      }
      continue
    }

    award(pot.amount, winners)
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
function splitChips(amount: number, winners: string[], state: HandState): Array<[number, string]> {
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
