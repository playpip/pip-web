// What the AI remembers about the people at its table.
//
// Without this every decision was made fresh, and an opponent's bet was read
// only by its size: chips in meant a strong range, whoever put them in. That is
// the right read of a player who bets when they have it, and exactly the wrong
// one of a player who bets everything, and the second is how a beginner beat
// the top of the ladder by being aggressive (Will, 2026-10-08). A real player
// notices within an orbit or two that somebody never stops betting, and starts
// calling them down.
//
// So the table keeps a running tally per player — how often they raise
// preflop, how often they bet or raise after the flop, how often they fold
// when bet into — and `decideAction` turns it into two adjustments:
//
// - **credibility**: how much a bet from this player says about their hand,
//   relative to a typical player. A maniac's bet says little, so the AI's range
//   for them stays wide and it calls lighter.
// - **foldiness**: how often bets get through. Against somebody who folds a
//   lot the AI bluffs more; against a calling station it bluffs less and bets
//   thinner for value.
//
// Each tally is shrunk toward a typical player's rate with a prior worth
// `PRIOR_WEIGHT` decisions, so one hand never swings it and a few orbits do.
//
// Pure and deterministic: a plain object the store feeds every action into.

import type { Action, HandState } from '../engine'

/** A typical player's rates, which every read starts from and is shrunk toward. */
export const TYPICAL = {
  /** Preflop raises per voluntary preflop decision. */
  preflopRaise: 0.18,
  /** Bets and raises per postflop decision. */
  postflopAggression: 0.32,
  /** Folds per time facing a bet. */
  foldToBet: 0.45,
} as const

/** How many decisions' worth of "typical" every read starts with. */
export const PRIOR_WEIGHT = 10

interface Tally {
  hits: number
  chances: number
}

export interface PlayerReads {
  preflopRaise: Tally
  postflopAggression: Tally
  foldToBet: Tally
}

export interface TableMemory {
  players: Record<string, PlayerReads>
}

export function createTableMemory(): TableMemory {
  return { players: {} }
}

function readsFor(memory: TableMemory, id: string): PlayerReads {
  memory.players[id] ??= {
    preflopRaise: { hits: 0, chances: 0 },
    postflopAggression: { hits: 0, chances: 0 },
    foldToBet: { hits: 0, chances: 0 },
  }
  // A memory saved before the fold tally existed has players without one.
  memory.players[id].foldToBet ??= { hits: 0, chances: 0 }
  return memory.players[id]
}

/**
 * Record one action, given the state it was taken *from*. Call it for every
 * betting action at the table, the human's included, before `applyAction`.
 */
export function observeAction(memory: TableMemory, state: HandState, action: Action): void {
  if (action.type === 'draw') return
  const p = state.players[state.toActIndex]
  if (!p) return
  const reads = readsFor(memory, p.id)
  const facingBet = state.currentBet > p.committedThisStreet
  const aggressive = action.type === 'bet' || action.type === 'raise'

  if (state.street === 'preflop') {
    // A free check in the big blind is not a decision about raising.
    if (facingBet || aggressive) {
      reads.preflopRaise.chances++
      if (aggressive) reads.preflopRaise.hits++
    }
  } else {
    reads.postflopAggression.chances++
    if (aggressive) reads.postflopAggression.hits++
  }

  if (facingBet) {
    reads.foldToBet.chances++
    if (action.type === 'fold') reads.foldToBet.hits++
  }
}

function shrunk(t: Tally, typical: number): number {
  return (t.hits + PRIOR_WEIGHT * typical) / (t.chances + PRIOR_WEIGHT)
}

/** A player's rates, shrunk toward typical. An unseen player reads as typical. */
export function ratesFor(memory: TableMemory | undefined, id: string) {
  const r = memory?.players[id]
  if (!r) return { ...TYPICAL }
  return {
    preflopRaise: shrunk(r.preflopRaise, TYPICAL.preflopRaise),
    postflopAggression: shrunk(r.postflopAggression, TYPICAL.postflopAggression),
    foldToBet: r.foldToBet ? shrunk(r.foldToBet, TYPICAL.foldToBet) : TYPICAL.foldToBet,
  }
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

/**
 * How much this player's chips in the pot say about their hand, as a multiple
 * of what a typical player's would: below 1 for somebody who bets too often to
 * mean it, above 1 for somebody who only bets the goods. Read off the street's
 * own rate, because plenty of players raise every hand preflop and play
 * honestly after the flop, and the reverse.
 */
export function credibility(memory: TableMemory | undefined, id: string, preflop: boolean): number {
  const rates = ratesFor(memory, id)
  const ratio = preflop
    ? TYPICAL.preflopRaise / rates.preflopRaise
    : TYPICAL.postflopAggression / rates.postflopAggression
  return clamp(ratio, 0.2, 1.3)
}

/**
 * How much more (above 1) or less (below 1) often than a typical player this
 * opponent folds when bet into.
 */
export function foldiness(memory: TableMemory | undefined, id: string): number {
  return clamp(ratesFor(memory, id).foldToBet / TYPICAL.foldToBet, 0.3, 1.6)
}
