// The story of the hand so far, read off the engine's action log.
//
// `decideAction` used to see only where the chips were, so every street was a
// fresh decision with no past: it could not tell that it raised before the
// flop (and so should usually bet it), that the player in front checked and
// then raised (the strongest line in poker), or that it has been betting a
// bluff for two streets and is one bet from taking the pot. These answer those
// questions and nothing else.

import type { ActionRecord, HandState, Street } from '../engine'

const aggressive = (a: ActionRecord) => a.type === 'bet' || a.type === 'raise'

/** The hand's log, or an empty one for a live hand an older build saved. */
export function lineOf(state: HandState): readonly ActionRecord[] {
  return state.actions ?? []
}

/** Who made the last bet or raise before the flop, or null if it was limped. */
export function preflopAggressor(state: HandState): string | null {
  let who: string | null = null
  for (const a of lineOf(state)) if (a.street === 'preflop' && aggressive(a)) who = a.playerId
  return who
}

/** Whether anybody has bet this street yet. */
export function streetIsUnbet(state: HandState): boolean {
  return !lineOf(state).some((a) => a.street === state.street && aggressive(a))
}

/** Whether this player bet or raised on a given street. */
export function wasAggressor(state: HandState, playerId: string, street: Street): boolean {
  return lineOf(state).some((a) => a.street === street && a.playerId === playerId && aggressive(a))
}

/** Whether this player checked and then raised on the current street. */
export function checkRaised(state: HandState, playerId: string): boolean {
  let checked = false
  for (const a of lineOf(state)) {
    if (a.street !== state.street || a.playerId !== playerId) continue
    if (a.type === 'check') checked = true
    else if (checked && a.type === 'raise') return true
  }
  return false
}

/**
 * Whether this player has led the betting on every board street before this
 * one: the "story" a river bet finishes. False on the flop.
 */
export function barrelledEveryStreet(state: HandState, playerId: string): boolean {
  const before: Street[] =
    state.street === 'turn' ? ['flop'] : state.street === 'river' ? ['flop', 'turn'] : []
  return before.length > 0 && before.every((s) => wasAggressor(state, playerId, s))
}
