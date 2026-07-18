// A fast, pure "how strong is this holding?" heuristic, used to bias Monte-Carlo
// opponents toward realistic ranges (see equity.ts). It only needs to *rank*
// candidate holdings against a shared board, so it trades the precision of a
// full 5-from-7 solve for speed — good enough to tell a flush from bottom pair.

import type { Card, Rank, Suit } from './cards'

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
