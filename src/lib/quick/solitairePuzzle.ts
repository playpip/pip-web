// Poker Solitaire's Puzzle (rules and score in lib/quick/solitaire).
//
// The luck out of it: all 25 cards are on the grid from the start, face up,
// and you swap any two until the ten lines make the target. Pip has already
// made more than the target with these same 25 cards, so every puzzle can be
// solved, like ordinary solitaire, where you know you can complete it (Will,
// 2026-11-08). The Daily puzzle is the same cards and target for everybody.
//
// **The target is 90% of Pip's score**, rounded down to a five. Pip's search
// gets close to the best grid there is, and matching it exactly is a chore,
// not a puzzle; 90% takes thought and gets finished. (Pip's scores run about
// 155 to 240, so a target is about 140 to 215.)
//
// Pip finds its grid by simulated annealing: swap two cards, keep the swap if
// the score went up, and sometimes keep one that went down, less often as it
// cools, so it climbs out of the grids that only look finished. It is not
// proof of the best grid there is. Seeded, so the same deal always has the
// same target.

import { type Card, mulberry32, RANKS, type Rng, SUITS } from '@/lib/poker/cards'
import { dailySeed } from '@/lib/daily'
import { CELLS, dealSolitaire, LINES, linesThrough, SOLITAIRE_POINTS } from './solitaire'

/** A puzzle: the cards in the order they first lie on the grid, and a grid that makes the target. */
export interface Puzzle {
  cards: Card[]
  target: number
  /** Pip's grid, row by row: proof the target can be made. */
  solution: Card[]
  /** What Pip's grid scores. */
  pip: number
}

/** The share of Pip's score a puzzle asks for. */
const TARGET_SHARE = 0.9

/** The stars a score earns: one at 60% of the target, two at 80%, three at the target. */
export function puzzleStars(score: number, target: number): 0 | 1 | 2 | 3 {
  if (score >= target) return 3
  if (score >= starAt(2, target)) return 2
  if (score >= starAt(1, target)) return 1
  return 0
}

/** The score that earns a star. */
export function starAt(stars: 1 | 2 | 3, target: number): number {
  return stars === 3 ? target : Math.ceil(target * (stars === 1 ? 0.6 : 0.8))
}

/** A puzzle from a shuffle. */
export function dealPuzzle(rng: Rng): Puzzle {
  const cards = dealSolitaire(rng)
  const { pip, solution } = solve(cards, rng)
  return { cards, target: Math.floor((pip * TARGET_SHARE) / 5) * 5, solution, pip }
}

/** Today's puzzle: the same 25 cards and the same target for everybody on a UTC day. */
export function dailyPuzzle(dateKey: string): Puzzle {
  return dealPuzzle(mulberry32(dailySeed(dateKey) ^ 0x9022e1))
}

// The search scores lines millions of times, so it works on numbers, not on
// the hand evaluator. linePoints agrees with scoreHand on every hand (tested).

const RANK_INDEX = new Map(RANKS.map((r, i) => [r, i]))
const SUIT_INDEX = new Map(SUITS.map((s, i) => [s, i]))
const ACE_LOW = 0b1_0000_0000_1111
const POINTS = Object.fromEntries(SOLITAIRE_POINTS.map((row) => [row.hand, row.points]))

/** A card as one number: rank * 4 + suit. */
const encode = (card: Card) =>
  (RANK_INDEX.get(card.rank) ?? 0) * 4 + (SUIT_INDEX.get(card.suit) ?? 0)

const counts = new Int8Array(13)

/** What five encoded cards score, by the Solitaire table. */
export function linePoints(a: number, b: number, c: number, d: number, e: number): number {
  counts.fill(0)
  let mask = 0
  for (const x of [a, b, c, d, e]) {
    counts[x >> 2]++
    mask |= 1 << (x >> 2)
  }
  const flush =
    (a & 3) === (b & 3) && (a & 3) === (c & 3) && (a & 3) === (d & 3) && (a & 3) === (e & 3)
  let top = 0
  let second = 0
  for (const n of counts) {
    if (n > top) {
      second = top
      top = n
    } else if (n > second) second = n
  }
  let straight = false
  let royal = false
  if (top === 1) {
    const low = 31 - Math.clz32(mask) - 4
    straight = mask === 31 << low || mask === ACE_LOW
    royal = mask === 31 << 8
  }
  if (straight && flush) return royal ? POINTS['Royal Flush'] : POINTS['Straight Flush']
  if (top === 4) return POINTS['Four of a Kind']
  if (top === 3 && second === 2) return POINTS['Full House']
  if (flush) return POINTS.Flush
  if (straight) return POINTS.Straight
  if (top === 3) return POINTS['Three of a Kind']
  if (top === 2) return second === 2 ? POINTS['Two Pair'] : POINTS.Pair
  return 0
}

/** Encoded cards for linePoints, for the tests. */
export function encodeCards(cards: readonly Card[]): number[] {
  return cards.map(encode)
}

const LINE_CELLS = LINES.map((l) => l.cells)
const CELL_LINES = Array.from({ length: CELLS }, (_, cell) =>
  linesThrough(cell).map((l) => LINES.indexOf(l)),
)

/** Restarts, and swaps tried in each: about a fifth of a second on a phone. */
const RESTARTS = 3
const SWAPS = 30_000
const START_HEAT = 6

function solve(cards: readonly Card[], rng: Rng): { pip: number; solution: Card[] } {
  const grid = cards.map(encode)
  const lineScore = (line: number) => {
    const [a, b, c, d, e] = LINE_CELLS[line]
    return linePoints(grid[a], grid[b], grid[c], grid[d], grid[e])
  }
  const scores = LINE_CELLS.map((_, i) => lineScore(i))
  let score = scores.reduce((s, n) => s + n, 0)
  let best = score
  let bestGrid = grid.slice()

  for (let run = 0; run < RESTARTS; run++) {
    for (let k = 0; k < SWAPS; k++) {
      const heat = START_HEAT * (1 - k / SWAPS) + 0.01
      const x = Math.floor(rng() * CELLS)
      const y = Math.floor(rng() * CELLS)
      if (x === y) continue
      const touched = new Set([...CELL_LINES[x], ...CELL_LINES[y]])
      ;[grid[x], grid[y]] = [grid[y], grid[x]]
      let change = 0
      const after: [number, number][] = []
      for (const line of touched) {
        const s = lineScore(line)
        change += s - scores[line]
        after.push([line, s])
      }
      if (change >= 0 || rng() < Math.exp(change / heat)) {
        for (const [line, s] of after) scores[line] = s
        score += change
        if (score > best) {
          best = score
          bestGrid = grid.slice()
        }
      } else {
        ;[grid[x], grid[y]] = [grid[y], grid[x]]
      }
    }
  }

  const byCode = new Map(cards.map((card) => [encode(card), card]))
  return { pip: best, solution: bestGrid.map((code) => byCode.get(code) as Card) }
}
