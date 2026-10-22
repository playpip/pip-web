// A fast, pure "how strong is this holding?" heuristic, used to bias Monte-Carlo
// opponents toward realistic ranges (see equity.ts). It only needs to *rank*
// candidate holdings against a shared board, so it trades the precision of a
// full 5-from-7 solve for speed — good enough to tell a flush from bottom pair.

import type { Card, Rank, Suit } from './cards'
import { CATEGORY, categoryOf, rankHoldem } from './rank7'

const RANK_VALUE: Record<Rank, number> = {
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

/** Preflop: quick quality score for two hole cards, ~[0,1]. */
function preflopStrength(a: Card, b: Card): number {
  const va = RANK_VALUE[a.rank]
  const vb = RANK_VALUE[b.rank]
  const hi = Math.max(va, vb)
  const lo = Math.min(va, vb)

  let s = (hi / 14) * 0.5 + (lo / 14) * 0.18
  if (a.rank === b.rank) {
    s += 0.28 + (hi / 14) * 0.12 // a pair is worth a lot
  } else {
    if (a.suit === b.suit) s += 0.06
    const gap = hi - lo
    if (gap === 1) s += 0.06
    else if (gap === 2) s += 0.03
    else if (gap === 3) s += 0.015
  }
  return Math.min(1, s)
}

/** Postflop: made-hand category (+ draw bonuses) for hole+community, ~[0,1]. */
function madeStrength(cards: readonly Card[]): number {
  const rankCounts = new Map<number, number>()
  const suitCounts = new Map<Suit, number>()
  for (const c of cards) {
    const v = RANK_VALUE[c.rank]
    rankCounts.set(v, (rankCounts.get(v) ?? 0) + 1)
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1)
  }

  const counts = [...rankCounts.values()].sort((x, y) => y - x)
  const maxSuit = Math.max(...suitCounts.values())

  // Longest run of consecutive distinct ranks (ace plays low for the wheel).
  const distinct = [...rankCounts.keys()].sort((x, y) => x - y)
  const ordered = distinct.includes(14) ? [1, ...distinct] : distinct
  let bestRun = 1
  let run = 1
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i] === ordered[i - 1] + 1) {
      run++
      bestRun = Math.max(bestRun, run)
    } else if (ordered[i] !== ordered[i - 1]) {
      run = 1
    }
  }

  const hasFlush = maxSuit >= 5
  const hasStraight = bestRun >= 5
  const quads = counts[0] === 4
  const trips = counts[0] === 3
  const numPairs = counts.filter((c) => c === 2).length
  const fullHouse = trips && (counts[1] ?? 0) >= 2

  let cat: number
  if (hasFlush && hasStraight) cat = 8
  else if (quads) cat = 7
  else if (fullHouse) cat = 6
  else if (hasFlush) cat = 5
  else if (hasStraight) cat = 4
  else if (trips) cat = 3
  else if (numPairs >= 2) cat = 2
  else if (numPairs === 1) cat = 1
  else cat = 0

  let s = (cat / 8) * 0.9
  const topRank = distinct.length ? distinct[distinct.length - 1] : 2
  s += (topRank / 14) * 0.05 // nudge for kicker/top card within a category

  // Reward live draws when there's no big made hand yet.
  if (cat < 4) {
    if (maxSuit === 4) s += 0.1 // four to a flush
    if (bestRun === 4) s += 0.08 // four to a straight
  }
  return Math.min(1, s)
}

/**
 * Relative strength of a two-card holding given the current board, in [0,1].
 * Preflop uses a hand-quality heuristic; postflop uses made-hand strength plus
 * draw potential. Only meaningful for comparing holdings on the *same* board.
 */
export function holeStrength(hole: readonly Card[], community: readonly Card[]): number {
  if (hole.length < 2) return 0
  if (community.length === 0) return preflopStrength(hole[0], hole[1])
  return madeStrength([...hole, ...community])
}

/**
 * Relative strength of a four-card Omaha holding given the board, in [0, 1],
 * for the same job as `holeStrength`: ranking candidate holdings on one board.
 *
 * After the flop it is the best of the six two-card pairings, because Omaha
 * plays exactly two from the hand. (`madeStrength` reads the whole board, so a
 * board flush counts for every holding alike; it only has to order them.)
 * Before it, the shape of the four: the best two pairings averaged, since a
 * hand that is good two ways (double-suited, connected, paired) is what makes
 * an Omaha starting hand, plus a little for every pairing being live.
 */
export function omahaStrength(hole: readonly Card[], community: readonly Card[]): number {
  if (hole.length < 4) return holeStrength(hole, community)
  const pairs: number[] = []
  for (let i = 0; i < hole.length; i++) {
    for (let j = i + 1; j < hole.length; j++) {
      const two = [hole[i], hole[j]]
      pairs.push(
        community.length === 0
          ? preflopStrength(two[0], two[1])
          : madeStrength([...two, ...community]),
      )
    }
  }
  pairs.sort((a, b) => b - a)
  if (community.length > 0) return pairs[0]
  const mean = pairs.reduce((a, b) => a + b, 0) / pairs.length
  return Math.min(1, ((pairs[0] + pairs[1]) / 2) * 0.8 + mean * 0.2)
}

let preflopTable: Float64Array | null = null

/**
 * Where a two-card holding ranks among all 1,326 starting hands by
 * `holeStrength`, in [0, 1]: 0.85 means it beats 85% of them. Ties count half.
 * Built once, on first use.
 */
export function preflopPercentile(hole: readonly Card[]): number {
  if (!preflopTable) {
    const deck: Card[] = []
    for (const rank of Object.keys(RANK_VALUE) as Rank[]) {
      for (const suit of ['c', 'd', 'h', 's'] as Suit[]) deck.push({ rank, suit })
    }
    const all: number[] = []
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) all.push(preflopStrength(deck[i], deck[j]))
    }
    preflopTable = Float64Array.from(all.sort((a, b) => a - b))
  }
  const table = preflopTable
  const mine = preflopStrength(hole[0], hole[1])
  let lo = 0
  let hi = table.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (table[mid] < mine) lo = mid + 1
    else hi = mid
  }
  let ties = 0
  while (lo + ties < table.length && table[lo + ties] === mine) ties++
  return (lo + ties / 2) / table.length
}

/**
 * `holeStrength` with the made hand read exactly, for ranking an opponent's
 * candidate holdings on one board (`estimateEquity`'s `exactRange`).
 *
 * `madeStrength` reads the category and nudges by the highest card among all
 * seven, which on most boards is a board card everybody shares. So inside a
 * category it cannot tell top pair from bottom pair, or a good kicker from a
 * bad one, and on a paired board every holding is "a pair": an opponent who
 * bets is then drawn as any pair at all, which flatters every hand facing
 * them. Here the made hand is `rankHoldem`'s exact order, pair rank and
 * kickers included, and a draw only counts when one of the two hole cards is
 * in it, because a draw on the board belongs to everybody. Preflop is the same
 * as `holeStrength`.
 */
export function exactStrength(hole: readonly Card[], community: readonly Card[]): number {
  if (hole.length < 2) return 0
  if (community.length === 0) return preflopStrength(hole[0], hole[1])
  const rank = rankHoldem(hole, community)
  const cat = categoryOf(rank)
  const within = (rank % 0x100000) / 0x100000
  let s = (cat / 8) * 0.9 + within * 0.1
  if (cat < CATEGORY.straight && community.length < 5) {
    if (privateFlushDraw(hole, community)) s += 0.1
    if (privateStraightDraw(hole, community)) s += 0.08
  }
  return Math.min(1, s)
}

/** Four to a flush, with at least one of them in the hand. */
function privateFlushDraw(hole: readonly Card[], community: readonly Card[]): boolean {
  for (const suit of new Set(hole.map((c) => c.suit))) {
    const n =
      hole.filter((c) => c.suit === suit).length + community.filter((c) => c.suit === suit).length
    if (n === 4) return true
  }
  return false
}

/** Four ranks in a row that the board alone does not hold. */
function privateStraightDraw(hole: readonly Card[], community: readonly Card[]): boolean {
  const mask = (cards: readonly Card[]) => {
    let m = 0
    for (const c of cards) {
      const v = RANK_VALUE[c.rank]
      m |= 1 << v
      if (v === 14) m |= 1 << 1
    }
    return m
  }
  const fours = (m: number) => m & (m << 1) & (m << 2) & (m << 3)
  const all = fours(mask([...hole, ...community]))
  return all !== 0 && all !== fours(mask(community))
}

let preflopOrder: { hole: readonly [Card, Card]; s: number }[] | null = null

/**
 * The top `share` of all 1,326 starting hands by `holeStrength`, strongest
 * first, for drawing an opponent from a percentile range (`estimateEquity`'s
 * `opponentTopShare`). Never fewer than one hand, and a cut that lands inside
 * hands of equal strength takes all of them: cutting by deck order would keep
 * some suits of a pair and drop the rest, and invent blockers that are not
 * there. Built once, on first use.
 */
export function preflopTop(share: number): readonly (readonly [Card, Card])[] {
  if (!preflopOrder) {
    const deck: Card[] = []
    for (const rank of Object.keys(RANK_VALUE) as Rank[]) {
      for (const suit of ['c', 'd', 'h', 's'] as Suit[]) deck.push({ rank, suit })
    }
    const all: { hole: readonly [Card, Card]; s: number }[] = []
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        all.push({ hole: [deck[i], deck[j]], s: preflopStrength(deck[i], deck[j]) })
      }
    }
    // Stable on ties, so the list is the same on every engine.
    preflopOrder = all.sort((a, b) => b.s - a.s)
  }
  const order = preflopOrder
  let n = Math.max(1, Math.min(order.length, Math.round(share * order.length)))
  while (n < order.length && order[n].s === order[n - 1].s) n++
  return order.slice(0, n).map((h) => h.hole)
}
