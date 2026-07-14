// Thin, typed wrapper over pokersolver. We delegate the fiddly 5-from-7 ranking
// and kicker logic to a battle-tested library; the rest of the engine is ours.

import pokersolver, { type Hand as SolvedHand } from 'pokersolver'
import type { Card } from './cards'

// pokersolver is CommonJS; grab Hand off the default (module.exports) object.
// The named import above is type-only (erased at runtime) for the SolvedHand type.
const { Hand } = pokersolver
import { cardsToStrings } from './cards'

export interface EvaluatedHand {
  /** Category label, e.g. "Full House". */
  name: string
  /** Full description incl. kickers, e.g. "Two Pair, A's & K's". */
  description: string
  /** Category rank from pokersolver (higher = better category). */
  categoryRank: number
  /** Opaque solved hand, used for winner comparison. */
  readonly solved: SolvedHand
}

/** Evaluate the best 5-card hand from a player's hole + community cards. */
export function evaluateHand(
  holeCards: readonly Card[],
  communityCards: readonly Card[],
): EvaluatedHand {
  const all = cardsToStrings([...holeCards, ...communityCards])
  const solved = Hand.solve(all)
  return {
    name: solved.name,
    description: solved.descr,
    categoryRank: solved.rank,
    solved,
  }
}

export interface HandContenders<T> {
  /** Caller-supplied id/handle for a player. */
  id: T
  hole: readonly Card[]
}

export interface ShowdownResult<T> {
  /** Winning player ids (more than one on a tie). */
  winners: T[]
  /** Every contender's evaluated hand, keyed by id, for display. */
  evaluations: Map<T, EvaluatedHand>
}

/**
 * Compare contenders sharing a board and return the winner id(s). Ties (equal
 * hands) yield multiple winners so the caller can split the pot.
 */
export function determineWinners<T>(
  contenders: readonly HandContenders<T>[],
  communityCards: readonly Card[],
): ShowdownResult<T> {
  const evaluations = new Map<T, EvaluatedHand>()
  for (const c of contenders) {
    evaluations.set(c.id, evaluateHand(c.hole, communityCards))
  }

  const solvedList = contenders.map((c) => evaluations.get(c.id)!.solved)
  const winningSolved = new Set(Hand.winners(solvedList))

  const winners = contenders
    .filter((c) => winningSolved.has(evaluations.get(c.id)!.solved))
    .map((c) => c.id)

  return { winners, evaluations }
}
