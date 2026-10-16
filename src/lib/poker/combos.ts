// The 1,326 two-card Hold'em holdings as small integers, for the places that
// keep a number per holding: a weighted range (`ai/weightedRange.ts`) and the
// Monte-Carlo draw that samples from one (`equity.ts`).
//
// A card is `rank * 4 + suit`, 0..51, ranks and suits in the order `cards.ts`
// lists them. A combo is an index into `COMBO_A`/`COMBO_B`, the two cards of
// the holding with `COMBO_A < COMBO_B`.

import { type Card, RANKS, SUITS } from './cards'

export const COMBOS = 1326

const RANK_INDEX = new Map(RANKS.map((r, i) => [r, i]))
const SUIT_INDEX = new Map(SUITS.map((s, i) => [s, i]))

/** Every card, by its index. */
export const CARD_AT: readonly Card[] = RANKS.flatMap((rank) =>
  SUITS.map((suit) => ({ rank, suit })),
)

export function cardIndex(c: Card): number {
  return (RANK_INDEX.get(c.rank) as number) * 4 + (SUIT_INDEX.get(c.suit) as number)
}

/** The lower card of each combo. */
export const COMBO_A = new Uint8Array(COMBOS)
/** The higher card of each combo. */
export const COMBO_B = new Uint8Array(COMBOS)
{
  let n = 0
  for (let a = 0; a < 52; a++) {
    for (let b = a + 1; b < 52; b++) {
      COMBO_A[n] = a
      COMBO_B[n] = b
      n++
    }
  }
}

/** The two cards of a combo, as `Card`s. */
export function comboCards(combo: number): [Card, Card] {
  return [CARD_AT[COMBO_A[combo]], CARD_AT[COMBO_B[combo]]]
}

/** The combo two cards make, in either order. */
export function comboIndex(x: Card, y: Card): number {
  let a = cardIndex(x)
  let b = cardIndex(y)
  if (a > b) [a, b] = [b, a]
  // Combos before `a` start: a * 51 - a * (a - 1) / 2 of them.
  return a * 51 - (a * (a - 1)) / 2 + (b - a - 1)
}

/** A 52-entry mask with the given cards set. */
export function deadMask(cards: readonly Card[]): Uint8Array {
  const dead = new Uint8Array(52)
  for (const c of cards) dead[cardIndex(c)] = 1
  return dead
}
