// Heuristic poker AI. There's no drop-in "good bot" library, so we build one on
// top of Monte-Carlo equity: estimate our chance of winning, compare to the pot
// odds, then let per-venue personality knobs decide how loose/aggressive/bluffy
// the action is. Pure and deterministic given an RNG.

import type { Rng } from '../cards'
import {
  legalActions,
  potSize,
  type Action,
  type HandState,
} from '../engine'
import { estimateEquity } from '../equity'

export interface AiProfile {
  /** Loose (0) → nitty (1). Raises the equity needed to continue. */
  tightness: number
  /** Passive (0) → aggressive (1). Governs raise frequency and bet sizing. */
  aggression: number
  /** Probability of firing with a weak hand (0 → ~0.3). */
  bluff: number
  /** Monte-Carlo sims per decision. More = sharper estimate = smarter. */
  iterations: number
  /**
   * Play quality, 1 (its best game) → 0 (blundery). Below 1 the AI misreads
   * its own hand strength and gives up too easily under pressure — genuine,
   * exploitable mistakes rather than a personality shift. Defaults to 1.
   */
  skill?: number
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n))

/** Count opponents still contesting the hand (folded/out excluded). */
function opponentCount(state: HandState, selfId: string): number {
  return state.players.filter(
    (p) => p.id !== selfId && p.status !== 'folded' && p.status !== 'out',
  ).length
}

/**
 * Choose a "to" amount for a bet/raise sized as a fraction of the pot, then
 * clamp into the legal band. Adds a little RNG jitter so sizing isn't robotic.
 */
function sizedRaise(
  state: HandState,
  fractionOfPot: number,
  minRaiseTo: number,
  maxRaiseTo: number,
  rng: Rng,
): number {
  const pot = Math.max(potSize(state), state.bigBlind)
  const jitter = 0.85 + rng() * 0.3 // ±15%
  const chips = Math.round(pot * fractionOfPot * jitter)
  const target = state.currentBet + Math.max(chips, state.lastRaiseSize)
  return clamp(target, minRaiseTo, maxRaiseTo)
}

/**
 * Decide the AI's action for the player currently to act. Guaranteed to return
 * an action that is legal for the current state.
 */
export function decideAction(
  state: HandState,
  profile: AiProfile,
  rng: Rng = Math.random,
): Action {
  const legal = legalActions(state)
  const player = state.players[state.toActIndex]
  if (!legal || !player) throw new Error('decideAction: no player to act')

  const opponents = opponentCount(state, player.id)
  if (opponents <= 0) {
    return legal.canCheck ? { type: 'check' } : { type: 'call' }
  }

  const { equity: trueEquity } = estimateEquity({
    hole: player.hole,
    community: state.community,
    opponents,
    iterations: profile.iterations,
    rng,
  })

  // Unskilled players misread their hand strength. The noisy estimate feeds
  // every decision below, so mistakes compound naturally: missed value bets,
  // bad calls, folded winners.
  const skill = clamp(profile.skill ?? 1, 0, 1)
  const misread = (rng() - 0.5) * (1 - skill) * 0.6
  const equity = clamp(trueEquity + misread, 0.02, 0.98)

  const toCall = legal.callAmount
  const pot = potSize(state)
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0
  const roll = rng()

  // --- unbet pot: check or lead out --------------------------------------
  if (toCall === 0) {
    const wantsValue = equity > 0.62 && roll < 0.35 + profile.aggression * 0.55
    const wantsBluff = equity < 0.4 && roll < profile.bluff
    if ((wantsValue || wantsBluff) && (legal.canBet || legal.canRaise)) {
      const fraction = wantsValue ? 0.55 + profile.aggression * 0.25 : 0.5
      return {
        type: legal.canBet ? 'bet' : 'raise',
        amount: sizedRaise(state, fraction, legal.minRaiseTo, legal.maxRaiseTo, rng),
      }
    }
    return { type: 'check' }
  }

  // --- facing a bet ------------------------------------------------------
  // Unskilled players also just give up under pressure — the exploitable
  // tell a casual human can actually find and use.
  if (skill < 1 && rng() < (1 - skill) * 0.35) {
    return { type: 'fold' }
  }

  // Tightness demands more equity than the raw pot odds before continuing.
  const continueThreshold = potOdds + profile.tightness * 0.15

  if (equity < continueThreshold) {
    // Usually fold; occasionally bluff-raise, or peel one cheaply when close.
    if (legal.canRaise && roll < profile.bluff * 0.5) {
      return { type: 'raise', amount: sizedRaise(state, 0.6, legal.minRaiseTo, legal.maxRaiseTo, rng) }
    }
    const cheap = toCall <= pot * 0.15
    if (legal.canCall && cheap && equity > potOdds * 0.85 && roll < 0.5) {
      return { type: 'call' }
    }
    return { type: 'fold' }
  }

  // Strong enough to continue: value-raise the strongest holdings.
  if (equity > 0.78 && legal.canRaise && roll < 0.45 + profile.aggression * 0.5) {
    return { type: 'raise', amount: sizedRaise(state, 0.7, legal.minRaiseTo, legal.maxRaiseTo, rng) }
  }
  if (equity > 0.6 && legal.canRaise && roll < profile.aggression * 0.4) {
    return { type: 'raise', amount: sizedRaise(state, 0.5, legal.minRaiseTo, legal.maxRaiseTo, rng) }
  }
  return legal.canCall ? { type: 'call' } : { type: 'check' }
}
