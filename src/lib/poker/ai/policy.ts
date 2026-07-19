// Heuristic poker AI. There's no drop-in "good bot" library, so we build one on
// top of Monte-Carlo equity: estimate our chance of winning, compare to the pot
// odds, then let per-venue personality knobs decide how loose/aggressive/bluffy
// the action is. Pure and deterministic given an RNG.

import type { Rng } from '../cards'
import { legalActions, potSize, type Action, type HandState } from '../engine'
import { estimateEquity } from '../equity'
import { holeStrength } from '../range'

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

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

/** Opponents still contesting the hand (folded/out excluded). */
function liveOpponents(state: HandState, selfId: string): HandState['players'] {
  return state.players.filter((p) => p.id !== selfId && p.status !== 'folded' && p.status !== 'out')
}

/**
 * How "self-selected" an opponent's range looks, in [0, ~0.8]. Someone who has
 * piled chips in — especially betting later streets — is far likelier to hold a
 * real hand than two random cards, so equity should not treat them as random.
 * Derived from chips committed this hand (in big blinds) plus a bump for backing
 * it postflop. Feeds `estimateEquity`'s `opponentSelectivity`. Shared with the
 * hero's ambient read (store/game.ts) so both sides model ranges the same way.
 */
export function opponentSelectivity(state: HandState, opp: HandState['players'][number]): number {
  const bb = Math.max(state.bigBlind, 1)
  const bbIn = opp.committedThisHand / bb
  let sel = bbIn / (bbIn + 5) // saturating: 1bb→0.17, 5bb→0.5, 15bb→0.75
  const backedItPostflop =
    state.street !== 'preflop' &&
    state.currentBet > 0 &&
    opp.committedThisStreet >= state.currentBet
  if (backedItPostflop) sel += 0.1
  return Math.min(sel, 0.8)
}

/**
 * Positional pressure in [0, 1]: how many live opponents still owe a decision
 * *after* us this street, normalised by the field. Acting with players left to
 * speak is riskier — someone behind can wake up with a raise — so early position
 * tightens (near 1) and last-to-act (the button's late seats) loosens (near 0).
 */
function positionalPressure(state: HandState, self: HandState['players'][number]): number {
  const opponents = liveOpponents(state, self.id)
  if (opponents.length === 0) return 0
  const behind = opponents.filter(
    (p) => p.status === 'active' && !(p.hasActed && p.committedThisStreet === state.currentBet),
  ).length
  return behind / opponents.length
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
export function decideAction(state: HandState, profile: AiProfile, rng: Rng = Math.random): Action {
  const legal = legalActions(state)
  const player = state.players[state.toActIndex]
  if (!legal || !player) throw new Error('decideAction: no player to act')

  const opponents = liveOpponents(state, player.id)
  if (opponents.length === 0) {
    return legal.canCheck ? { type: 'check' } : { type: 'call' }
  }

  // Model each opponent's range by how much they've backed the hand, not as two
  // random cards — otherwise the AI over-values its equity into aggression and
  // calls too light. This mirrors the hero's ambient read (store/game.ts).
  const { equity: trueEquity } = estimateEquity({
    hole: player.hole,
    community: state.community,
    opponents: opponents.length,
    opponentSelectivity: opponents.map((p) => opponentSelectivity(state, p)),
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

  // Out of position (players still to act behind us) we tighten up and bluff
  // less — a steal into a live field is far likelier to run into a real hand.
  const posPressure = positionalPressure(state, player)

  // Preflop, gate voluntary chips on starting-hand quality. Raw equity vs two
  // random cards flatters junk — 2-3o still wins ~a third of the time heads-up —
  // so an equity-only bot limps and cheap-peels hands a real player just mucks.
  // The cutoff scales hard with tightness: it's the main dial separating a loose
  // low-stakes field that plays a wide, junky range from a nosebleed nit that
  // folds everything but premiums. A holding below it won't open-bluff and folds
  // to any bet. This never overrides checking for free (the unbet branch takes
  // its free card) so a limped big blind still sees the flop with anything.
  const preStrength = state.street === 'preflop' ? holeStrength(player.hole, state.community) : 1
  const preflopCutoff = 0.15 + profile.tightness * 0.5
  const trashPreflop = state.street === 'preflop' && preStrength < preflopCutoff

  // --- unbet pot: check or lead out --------------------------------------
  if (toCall === 0) {
    const wantsValue = equity > 0.62 && roll < 0.35 + profile.aggression * 0.55
    const wantsBluff =
      equity < 0.4 && !trashPreflop && roll < profile.bluff * (1 - posPressure * 0.5)
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
  // Muck preflop junk to any bet rather than peel with 2-3 — no price is good
  // enough for a hand a real player never entered the pot with.
  if (trashPreflop) {
    return { type: 'fold' }
  }

  // Unskilled players also just give up under pressure — the exploitable
  // tell a casual human can actually find and use.
  if (skill < 1 && rng() < (1 - skill) * 0.35) {
    return { type: 'fold' }
  }

  // Tightness demands more equity than the raw pot odds before continuing;
  // position asks for a little extra when players are still to act behind us.
  // Preflop it bites harder — a loose field discounts the price and calls wide
  // (station-y, exploitable), a nit demands a premium over it — so the ladder's
  // looseness actually shows up in how many hands each table plays.
  const oddsFactor = state.street === 'preflop' ? 0.42 + profile.tightness * 1.15 : 1
  const tightnessTax = profile.tightness * (state.street === 'preflop' ? 0.2 : 0.15)
  const continueThreshold = potOdds * oddsFactor + tightnessTax + posPressure * 0.06

  if (equity < continueThreshold) {
    // Usually fold; occasionally bluff-raise, or peel one cheaply when close.
    if (legal.canRaise && roll < profile.bluff * 0.5) {
      return {
        type: 'raise',
        amount: sizedRaise(state, 0.6, legal.minRaiseTo, legal.maxRaiseTo, rng),
      }
    }
    const cheap = toCall <= pot * 0.15
    if (legal.canCall && cheap && equity > potOdds * 0.85 && roll < 0.5) {
      return { type: 'call' }
    }
    return { type: 'fold' }
  }

  // Strong enough to continue: value-raise the strongest holdings.
  if (equity > 0.78 && legal.canRaise && roll < 0.45 + profile.aggression * 0.5) {
    return {
      type: 'raise',
      amount: sizedRaise(state, 0.7, legal.minRaiseTo, legal.maxRaiseTo, rng),
    }
  }
  if (equity > 0.6 && legal.canRaise && roll < profile.aggression * 0.4) {
    return {
      type: 'raise',
      amount: sizedRaise(state, 0.5, legal.minRaiseTo, legal.maxRaiseTo, rng),
    }
  }
  return legal.canCall ? { type: 'call' } : { type: 'check' }
}
