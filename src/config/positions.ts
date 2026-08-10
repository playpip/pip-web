// The seats on /learn/position, and the order they act in.
//
// The whole page is one claim: the button is fourth of six before the flop and
// last of six after it. So the two orders are computed from the rule the engine
// actually follows rather than copied off a diagram, and tests/positions.test.ts
// plays a real six-handed hand through src/lib/poker/engine.ts and checks the
// order that comes out matches this file seat for seat. If the engine ever
// changes, the page fails the gate instead of quietly becoming wrong.

import { type Band, TOTAL_COMBOS, comboCount } from '@/config/startingHands'

/** A six-handed table. Anything shorter renames seats; six is the full set. */
export const SEATS_AT_A_TABLE = 6

export interface Seat {
  id: string
  /** The name people use, which is what the page's table is keyed on. */
  name: string
  /**
   * Seats to the left of the button, so the button is 0 and the small blind
   * is 1. Both betting orders are a rotation of this and nothing else.
   */
  offset: number
  /** The chart band this seat opens. The blinds defend rather than open. */
  opens: Band | null
}

/** In the order the page's table lists them, which is the preflop order. */
export const SEATS: readonly Seat[] = [
  { id: 'utg', name: 'Under the gun', offset: 3, opens: 'any' },
  { id: 'mp', name: 'Middle', offset: 4, opens: 'middle' },
  { id: 'co', name: 'Cutoff', offset: 5, opens: 'late' },
  { id: 'btn', name: 'Button', offset: 0, opens: 'late' },
  { id: 'sb', name: 'Small blind', offset: 1, opens: null },
  { id: 'bb', name: 'Big blind', offset: 2, opens: null },
]

/**
 * Where a seat comes in the preflop betting order, counting from 1. The first
 * to act is the seat left of the big blind, which is three left of the button.
 */
export function preflopPlace(seat: Seat): number {
  return ((seat.offset - 3 + SEATS_AT_A_TABLE) % SEATS_AT_A_TABLE) + 1
}

/**
 * ...and from the flop onwards, where the first to act is the first live seat
 * left of the button. That single change is why the button is the best seat.
 */
export function postflopPlace(seat: Seat): number {
  return ((seat.offset - 1 + SEATS_AT_A_TABLE) % SEATS_AT_A_TABLE) + 1
}

/** How many players still act after this one, before the flop. */
export function playersBehind(seat: Seat): number {
  return SEATS_AT_A_TABLE - preflopPlace(seat)
}

/**
 * The hands that make "somebody behind me woke up with a real one" true: jacks
 * or better, and ace-king. 40 of the 1,326 combinations, which is the exact
 * figure the one-opponent row on the page quotes.
 */
export const PREMIUM_HANDS = ['JJ', 'QQ', 'KK', 'AA', 'AKs', 'AKo'] as const

/** The chance a single opponent has one of them, as a percentage. Exact. */
export function premiumShare(): number {
  return (PREMIUM_HANDS.reduce((total, hand) => total + comboCount(hand), 0) / TOTAL_COMBOS) * 100
}

export interface PremiumRow {
  behind: number
  from: string
  /** Percentage. See the note below on where the multi-player rows come from. */
  chance: number
}

/**
 * How often at least one player still to act holds a premium.
 *
 * The one-opponent row is exact. The other two are not a simple power of it,
 * because the cards you can see are cards they cannot have: they come from two
 * million dealt hands with real card removal (14.39% and 5.97%), reproduced
 * here independently at 14.40% and 5.96%. That is a simulation, so the page
 * quotes them to one decimal and says what it is doing.
 */
export const PREMIUM_BEHIND: readonly PremiumRow[] = [
  { behind: 5, from: 'from under the gun', chance: 14.4 },
  { behind: 2, from: 'from the button', chance: 6.0 },
  { behind: 1, from: '', chance: premiumShare() },
]
