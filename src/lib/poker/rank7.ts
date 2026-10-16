// A Hold'em hand as one comparable number, for the places that only need to
// know who wins: the Monte-Carlo loop in equity.ts runs a showdown per
// opponent per sample, and through pokersolver each of those costs tens of
// microseconds, which is most of the time a bot spends thinking.
//
// Bitmask method, no lookup tables: rank masks per suit find a flush and a
// straight with a few shifts, and rank counts find everything else. The idea is
// the textbook one (PokerHandEvaluator and its JS port phe use tables built on
// the same ordering); the code is written here, so nothing ships but this file.
//
// It only orders hands. The name, description and best five the table shows
// still come from pokersolver through handEval.ts, and `tests/rank7.test.ts`
// holds the ordering to pokersolver's on random showdowns, ties included.

import type { Card, Rank, Suit } from './cards'

const RANK_INDEX: Record<Rank, number> = {
  '2': 0,
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  '8': 6,
  '9': 7,
  T: 8,
  J: 9,
  Q: 10,
  K: 11,
  A: 12,
}
const SUIT_INDEX: Record<Suit, number> = { c: 0, d: 1, h: 2, s: 3 }

/** Category, in the top bits of the score. */
export const CATEGORY = {
  highCard: 0,
  pair: 1,
  twoPair: 2,
  trips: 3,
  straight: 4,
  flush: 5,
  fullHouse: 6,
  quads: 7,
  straightFlush: 8,
} as const

const WHEEL = 0b1_0000_0000_1111 // A, 5, 4, 3, 2

/** Top rank index of the best straight in a 13-bit rank mask, or -1. */
function straightHigh(mask: number): number {
  const run = mask & (mask << 1) & (mask << 2) & (mask << 3) & (mask << 4)
  if (run) return 31 - Math.clz32(run)
  return (mask & WHEEL) === WHEEL ? 3 : -1
}

/** The top `n` ranks of a mask, packed four bits each after `acc`. */
function topRanks(mask: number, n: number, acc: number): number {
  let out = acc
  let left = n
  for (let r = 12; r >= 0 && left > 0; r--) {
    if (mask & (1 << r)) {
      out = (out << 4) | r
      left--
    }
  }
  return out << (4 * left)
}

const score = (category: number, kickers: number) => category * 0x100000 + kickers

// Scratch space, reset on every call. Single-threaded and never re-entered,
// so sharing it is safe and saves an allocation per showdown.
const counts = new Uint8Array(13)
const suitMask = new Int32Array(4)

/**
 * The strength of the best five of `hole` plus `board` (five to seven cards in
 * all), higher is better, equal on a chop. Hold'em only: it is "best five of
 * all", which Omaha's two-from-hand rule is not, and Short Deck's category
 * order is different.
 */
export function rankHoldem(hole: readonly Card[], board: readonly Card[]): number {
  counts.fill(0)
  suitMask.fill(0)
  let all = 0
  for (let i = 0; i < hole.length + board.length; i++) {
    const c = i < hole.length ? hole[i] : board[i - hole.length]
    const r = RANK_INDEX[c.rank]
    counts[r]++
    suitMask[SUIT_INDEX[c.suit]] |= 1 << r
    all |= 1 << r
  }

  // At most one suit can hold five of seven cards, and with five of a suit
  // there are too few cards left for quads or a full house, so a flush can be
  // settled before counting pairs.
  for (let s = 0; s < 4; s++) {
    const m = suitMask[s]
    if (popcount(m) >= 5) {
      const sf = straightHigh(m)
      if (sf >= 0) return score(CATEGORY.straightFlush, sf)
      return score(CATEGORY.flush, topRanks(m, 5, 0))
    }
  }

  let quad = -1
  let trip1 = -1
  let trip2 = -1
  let pair1 = -1
  let pair2 = -1
  for (let r = 12; r >= 0; r--) {
    const n = counts[r]
    if (n === 4) quad = r
    else if (n === 3) {
      if (trip1 < 0) trip1 = r
      else trip2 = r
    } else if (n === 2) {
      if (pair1 < 0) pair1 = r
      else if (pair2 < 0) pair2 = r
    }
  }

  if (quad >= 0) return score(CATEGORY.quads, topRanks(all & ~(1 << quad), 1, quad))
  if (trip1 >= 0 && (trip2 >= 0 || pair1 >= 0)) {
    return score(CATEGORY.fullHouse, (trip1 << 4) | Math.max(trip2, pair1))
  }
  const straight = straightHigh(all)
  if (straight >= 0) return score(CATEGORY.straight, straight)
  if (trip1 >= 0) return score(CATEGORY.trips, topRanks(all & ~(1 << trip1), 2, trip1))
  if (pair2 >= 0) {
    // A third pair can only be the kicker.
    const rest = all & ~(1 << pair1) & ~(1 << pair2)
    return score(CATEGORY.twoPair, topRanks(rest, 1, (pair1 << 4) | pair2))
  }
  if (pair1 >= 0) return score(CATEGORY.pair, topRanks(all & ~(1 << pair1), 3, pair1))
  return score(CATEGORY.highCard, topRanks(all, 5, 0))
}

function popcount(x: number): number {
  let v = x - ((x >> 1) & 0x55555555)
  v = (v & 0x33333333) + ((v >> 2) & 0x33333333)
  return (((v + (v >> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

/** The category of a score from `rankHoldem`. */
export function categoryOf(rank: number): number {
  return Math.floor(rank / 0x100000)
}
