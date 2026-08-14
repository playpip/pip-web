// The seats on /learn/position, and the order they act in.
//
// The whole page is one claim: the button is fourth of six before the flop and
// last of six after it. So the two orders are computed from the rule the engine
// actually follows rather than copied off a diagram, and tests/positions.test.ts
// plays a real six-handed hand through src/lib/poker/engine.ts and checks the
// order that comes out matches this file seat for seat. If the engine ever
// changes, the page fails the gate instead of quietly becoming wrong.

import { BAND_ORDER, type Band, HAND_BANDS, TOTAL_COMBOS, comboCount } from '@/config/startingHands'

/** A six-handed table. Anything shorter renames seats; six is the full set. */
export const SEATS_AT_A_TABLE = 6

export interface Seat {
  id: string
  /** The name people use, which is what the page's table is keyed on. */
  name: string
  /** The same seat with the table's own shorthand, for the ring diagram. */
  short: string
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
  { id: 'utg', name: 'Under the gun', short: 'UTG', offset: 3, opens: 'any' },
  { id: 'mp', name: 'Middle', short: 'MP', offset: 4, opens: 'middle' },
  { id: 'co', name: 'Cutoff', short: 'CO', offset: 5, opens: 'late' },
  { id: 'btn', name: 'Button', short: 'BTN', offset: 0, opens: 'late' },
  { id: 'sb', name: 'Small blind', short: 'SB', offset: 1, opens: null },
  { id: 'bb', name: 'Big blind', short: 'BB', offset: 2, opens: null },
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
 * The three seats the SameHandThreeSeats widget puts side by side: the first to
 * act, the middle of the table, and the best seat on it. Read off SEATS rather
 * than retyped, so the widget cannot name a seat the page's own table does not
 * have.
 */
export const COMPARED_SEATS: readonly Seat[] = ['utg', 'mp', 'btn'].map(
  (id) => SEATS.find((seat) => seat.id === id)!,
)

/**
 * The hands it cycles through. Four of them change verdict across those three
 * seats and AA does not, which is exactly why AA is in the list: a demo where
 * every example moves teaches that position decides everything, and it does not
 * decide aces.
 */
export const COMPARED_HANDS: readonly string[] = ['J9s', 'A9o', '76s', 'KJo', 'AA']

/**
 * Whether a seat opens a hand when it folds round to it. A seat opens its own
 * band and every band earlier than it, so this is one comparison against
 * BAND_ORDER and never a second list of hands: if a hand moves band on
 * /learn/starting-hands, it moves here too. The blinds open nothing, because
 * the chart is an opening chart and a blind is defending.
 */
export function opensHand(seat: Seat, hand: string): boolean {
  const band = HAND_BANDS[hand]
  if (band === undefined || seat.opens === null) return false
  return BAND_ORDER.indexOf(band) <= BAND_ORDER.indexOf(seat.opens)
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
