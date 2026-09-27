// Short Deck (6+) hand ranking, written out rather than delegated.
//
// **pokersolver cannot do this one, and it will not tell you so.** Every other
// variant in here is a five-from-seven problem the library already solves; Short
// Deck changes the ranking itself, in two ways that a general evaluator gets
// silently wrong:
//
// 1. **A flush beats a full house.** Thirty-six cards means nine of each suit
//    rather than thirteen, so flushes get rarer while full houses do not, and
//    the standard order stops matching the odds. Ask pokersolver and it ranks
//    them the other way round, confidently.
// 2. **A-6-7-8-9 is a straight.** With the deuce through five gone the ace has
//    to play low somewhere, and it plays below the six. pokersolver looks for
//    A-2-3-4-5 and finds ace-high nothing.
//
// This project already has a blog post about trusting `pokersolver`'s
// undocumented behaviour (`/blog/pokersolver-undocumented`), and the Omaha rule
// next door is hand-rolled for exactly the same reason: a rule you cannot test
// is a rule you are hoping about. So this file owns the ranking, and
// `tests/shortDeck.test.ts` owns the proof.
//
// **The rule set is Triton's**, which is the one most rooms and most players
// mean by "short deck": flush over full house, ace low under the six, and
// everything else in the usual order. Three-of-a-kind does *not* beat a
// straight here — that is a real variant rule in some rooms and it is not this
// one. Stated because a silent choice between two real rule sets is how a
// showdown ships wrong.

import type { Card, Rank } from './cards'

/** Rank order for scoring. The ace is high here and demoted by hand in the wheel. */
const VALUE: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

/**
 * Category order, low to high. The two lines that are not standard poker are
 * marked, because they are the whole point of the file.
 */
export const SHORT_DECK_CATEGORIES = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Full House',
  'Flush', // ← above the full house, and this is the short-deck rule
  'Four of a Kind',
  'Straight Flush',
] as const

export interface ShortDeckHand {
  /** Category label, in pokersolver's spelling so the rest of the app matches. */
  name: string
  /** Full description with the cards that settled it. */
  description: string
  /** Category index into SHORT_DECK_CATEGORIES. Higher wins. */
  categoryRank: number
  /** Comparable lexicographically: category first, then tiebreakers. */
  score: number[]
  /** The five cards that made it, most significant first. */
  cards: Card[]
}

const NAMES_PLURAL: Record<number, string> = {
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
}
const face = (v: number) => NAMES_PLURAL[v] ?? String(v)

/** Every k-sized combination. Small n only — this is called with 7 choose 5. */
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

/**
 * The straight's high card, or 0 for no straight.
 *
 * Two shapes: the ordinary run of five consecutive values, and the short-deck
 * wheel — A-6-7-8-9, where the ace plays below the six and the hand is a
 * *nine*-high straight, not an ace-high one. Getting that second part wrong
 * loses a pot rather than mis-labelling one: A9876 beats nothing it should not,
 * but scored as ace-high it would beat a genuine T-high straight.
 */
function straightHigh(values: readonly number[]): number {
  const uniq = [...new Set(values)].sort((a, b) => b - a)
  if (uniq.length !== 5) return 0
  if (uniq[0] - uniq[4] === 4) return uniq[0]
  const isWheel = uniq[0] === 14 && uniq[1] === 9 && uniq[2] === 8 && uniq[3] === 7 && uniq[4] === 6
  return isWheel ? 9 : 0
}

/** Score one exact five-card holding. */
function scoreFive(cards: readonly Card[]): ShortDeckHand {
  const values = cards.map((c) => VALUE[c.rank])
  const flush = cards.every((c) => c.suit === cards[0].suit)
  const high = straightHigh(values)

  // Group by rank: count first (so quads/trips lead), then value.
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const shape = groups.map(([, n]) => n).join('')
  const byGroup = groups.map(([v]) => v)
  const descending = [...values].sort((a, b) => b - a)

  // Cards in significance order: the made hand first, then kickers. The wheel
  // is re-ordered so the ace trails, because it is the low end of that straight.
  const ordered = (() => {
    if (high > 0 && !flush) return straightOrder(cards, high)
    if (flush && high > 0) return straightOrder(cards, high)
    const out: Card[] = []
    for (const v of byGroup) out.push(...cards.filter((c) => VALUE[c.rank] === v))
    return out
  })()

  const make = (categoryRank: number, tie: number[], description: string): ShortDeckHand => ({
    name: SHORT_DECK_CATEGORIES[categoryRank],
    description,
    categoryRank,
    score: [categoryRank, ...tie],
    cards: ordered,
  })

  if (flush && high > 0) {
    return make(8, [high], high === 14 ? 'Royal Flush' : `Straight Flush, ${face(high)} High`)
  }
  if (shape === '41') return make(7, byGroup, `Four of a Kind, ${face(byGroup[0])}'s`)
  // The short-deck promotion. Tie-broken on every card, like any flush.
  if (flush) return make(6, descending, `Flush, ${face(descending[0])} High`)
  if (shape === '32') {
    return make(5, byGroup, `Full House, ${face(byGroup[0])}'s over ${face(byGroup[1])}'s`)
  }
  if (high > 0) return make(4, [high], `Straight, ${face(high)} High`)
  if (shape === '311') return make(3, byGroup, `Three of a Kind, ${face(byGroup[0])}'s`)
  if (shape === '221') {
    return make(2, byGroup, `Two Pair, ${face(byGroup[0])}'s & ${face(byGroup[1])}'s`)
  }
  if (shape === '2111') return make(1, byGroup, `Pair, ${face(byGroup[0])}'s`)
  return make(0, descending, `${face(descending[0])} High`)
}

/** A straight's cards top-down, with the wheel's ace moved to the bottom. */
function straightOrder(cards: readonly Card[], high: number): Card[] {
  const sorted = [...cards].sort((a, b) => VALUE[b.rank] - VALUE[a.rank])
  if (high !== 9) return sorted
  const ace = sorted.findIndex((c) => c.rank === 'A')
  if (ace < 0) return sorted
  return [...sorted.slice(0, ace), ...sorted.slice(ace + 1), sorted[ace]]
}

/** Lexicographic compare of two score tuples. Positive means `a` wins. */
export function compareShortDeck(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * The best five-card short-deck hand from everything available.
 *
 * Enumerated (twenty-one ways to pick five of seven) rather than reasoned
 * about, for the same reason the Omaha solver next door is: the reasoning is
 * where evaluators go wrong, and twenty-one scorings at a showdown is nothing.
 *
 * Fewer than five cards cannot make a hand, so the preflop strength estimates
 * that call this with two get scored on what they have. Nothing settles a pot
 * in that state.
 */
export function evaluateShortDeck(cards: readonly Card[]): ShortDeckHand {
  if (cards.length <= 5) return scoreFive(cards)
  let best: ShortDeckHand | null = null
  for (const five of combinations(cards, 5)) {
    const hand = scoreFive(five)
    if (!best || compareShortDeck(hand.score, best.score) > 0) best = hand
  }
  // `cards.length > 5` guarantees at least one combination, so this cannot be
  // null; the fallback exists so the type does not need an assertion.
  return best ?? scoreFive(cards.slice(0, 5))
}
