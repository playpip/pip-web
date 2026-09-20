// Sitting down at, and standing up from, the blackjack table.
//
// The money shape is the Rail's: a buy-in leaves the Roll and becomes a stack
// in front of you, the stack goes up and down while you play, and standing up
// puts whatever is left back. One-to-one, so `cashOutValue` has nothing to
// convert and a sit-and-stand is exactly Roll-neutral.
//
// **It is persisted, and re-checked on the way back in.** The session lives on
// the profile so a refresh does not delete your chips, which means it is
// client-written, which means nothing here may trust it. `resumeBlackjack`
// rejects an unknown table, a non-finite stack, or a negative one, and a
// refusal costs the player nothing they had.

import { BLACKJACK_STACKS, HOUSE_RULES, type HouseRules } from './rules'

export interface BlackjackSession {
  /** Which house rules were chosen, by id. */
  table: string
  /** Chips in front of the player right now, in Roll chips. */
  stack: number
  /** What was paid to sit down — the P/L line reads against this. */
  boughtIn: number
}

export interface ResumedSession {
  rules: HouseRules
  stack: number
  boughtIn: number
}

/**
 * A stored session as something safe to play with, or `null`.
 *
 * Returns `null` rather than repairing, on the principle that a profile blob
 * that does not describe a real table is not a table we should be inventing
 * chips for. The caller sends the player back to the shelf.
 */
export function resumeBlackjack(session: unknown): ResumedSession | null {
  if (!session || typeof session !== 'object') return null
  const { table, stack, boughtIn } = session as Partial<BlackjackSession>
  const rules = HOUSE_RULES.find((r) => r.id === table)
  if (!rules) return null
  if (typeof stack !== 'number' || !Number.isFinite(stack) || stack < 0) return null
  if (typeof boughtIn !== 'number' || !Number.isFinite(boughtIn) || boughtIn <= 0) return null
  return { rules, stack: Math.floor(stack), boughtIn: Math.floor(boughtIn) }
}

/** Is this a stack the shelf actually offers? Guards the sit-down link. */
export function isOfferedStack(stack: number): boolean {
  return BLACKJACK_STACKS.includes(stack)
}

/**
 * The smallest bet the table takes, derived from the stack rather than set.
 *
 * A fixed minimum would be wrong at both ends: unplayable at the 500 stack and
 * pointless at the 50,000 one. A hundredth of what you sat down with gives
 * every table the same number of hands before it matters, which is the thing a
 * table minimum is actually for.
 */
export function minimumBet(boughtIn: number): number {
  return Math.max(1, Math.round(boughtIn / 100))
}

/** The bet buttons a table offers, smallest first. */
export function betLadder(boughtIn: number): number[] {
  const min = minimumBet(boughtIn)
  return [min, min * 2, min * 5, min * 10]
}
