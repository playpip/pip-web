// The low half of Omaha Hi-Lo, which is the half that is nothing like poker.
//
// Everything else in this engine asks "which hand is best". A low asks "which
// five cards are *smallest*", under rules that contradict most of what the rest
// of the file knows:
//
// - **The ace is one.** It is also still an ace for the high hand, from the
//   same card, in the same hand. A-2-3-4-5 is simultaneously the best low and a
//   five-high straight.
// - **Straights and flushes do not count.** 5-4-3-2-A of one suit is the
//   *nuts* low, not a straight flush that has stopped being low.
// - **Pairs disqualify.** Five cards, five different ranks, or there is no low.
// - **Eight or better.** Every one of the five must be an eight or lower, or the
//   low does not qualify and the high hand takes the whole pot.
// - **And still exactly two from your hand and three from the board** — the
//   Omaha rule, applied independently of whichever two you used for the high.
//   The same player routinely makes their high from one pair of hole cards and
//   their low from the other.
//
// None of that is expressible to pokersolver, and none of it is worth trying to
// bolt onto `handEval`, where every assumption runs the other way. So it is
// here, on its own, with `tests/hiLo.test.ts` to hold it.

import type { Card, Rank } from './cards'

/** Ace is one at a low, and nothing above eight qualifies at all. */
const LOW_VALUE: Partial<Record<Rank, number>> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
}

/** Every k-sized combination. Called with 4-choose-2 and 5-choose-3. */
function combinations<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = []
  const pick = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc)
      return
    }
    for (let i = start; i < items.length; i++) pick(i + 1, [...acc, items[i]])
  }
  pick(0, [])
  return out
}

export interface LowHand {
  /** The five values, highest first — the order they are compared in. */
  values: number[]
  cards: Card[]
  /** "8-7-4-2-A", the way a low is read out. */
  description: string
}

const FACE = (v: number) => (v === 1 ? 'A' : String(v))

/** Five exact cards as a low, or `null` if they do not qualify. */
function scoreFive(cards: readonly Card[]): LowHand | null {
  const values: number[] = []
  for (const card of cards) {
    const value = LOW_VALUE[card.rank]
    // A nine or higher kills it outright; so does a second card of a rank
    // already used, because a low has to be five different ranks.
    if (value === undefined || values.includes(value)) return null
    values.push(value)
  }
  const ordered = [...values].sort((a, b) => b - a)
  const byValue = [...cards].sort((a, b) => (LOW_VALUE[b.rank] ?? 0) - (LOW_VALUE[a.rank] ?? 0))
  return {
    values: ordered,
    cards: byValue,
    description: ordered.map(FACE).join('-'),
  }
}

/** Lower wins. Negative means `a` is the better low. */
export function compareLow(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < 5; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * The best qualifying low from four hole cards and a board, or `null`.
 *
 * Enumerated over the same sixty combinations the high hand uses, and
 * independently of it: the two halves of one holding are allowed to disagree
 * about which cards they want, and usually do.
 *
 * A board with fewer than three low cards on it cannot make a low for anybody,
 * which is why roughly half of all hi-lo pots are scooped by the high hand.
 */
export function bestLow(
  holeCards: readonly Card[],
  communityCards: readonly Card[],
): LowHand | null {
  if (holeCards.length < 2 || communityCards.length < 3) return null
  let best: LowHand | null = null
  for (const two of combinations(holeCards, 2)) {
    for (const three of combinations(communityCards, 3)) {
      const low = scoreFive([...two, ...three])
      if (low && (!best || compareLow(low.values, best.values) < 0)) best = low
    }
  }
  return best
}

export interface LowContender<T> {
  id: T
  hole: readonly Card[]
}

/**
 * Who has the best low, and `[]` when nobody qualifies.
 *
 * An empty list is the common case and the caller has to treat it as "the high
 * hand takes everything" rather than as an error or an empty split — awarding
 * half a pot to nobody is how chips vanish out of a hand.
 */
export function determineLowWinners<T>(
  contenders: readonly LowContender<T>[],
  communityCards: readonly Card[],
): { winners: T[]; lows: Map<T, LowHand> } {
  const lows = new Map<T, LowHand>()
  for (const c of contenders) {
    const low = bestLow(c.hole, communityCards)
    if (low) lows.set(c.id, low)
  }
  if (lows.size === 0) return { winners: [], lows }

  let best: number[] | null = null
  for (const low of lows.values()) {
    if (!best || compareLow(low.values, best) < 0) best = low.values
  }
  const winners = [...lows.entries()]
    .filter(([, low]) => compareLow(low.values, best ?? []) === 0)
    .map(([id]) => id)
  return { winners, lows }
}
