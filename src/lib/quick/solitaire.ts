// Poker Solitaire (a quick game, config/quickGames): the rules and the score.
//
// A 5×5 grid and a shuffled deck. Cards come one at a time and each goes in an
// empty cell, for good. When all 25 are down, the five rows and five columns
// are each a poker hand, and each hand scores from one table. Pure and seeded:
// the Daily deal is the same 25 cards for everybody on a UTC day.
//
// **The American table**, the classic Poker Squares one, because its order is
// the order of the hands: a better hand always scores more. The English table
// pays a straight over a full house, which is right for its odds and wrong for
// a one-thumb game where nobody should have to learn a second ranking.

import { type Card, mulberry32, type Rng, shuffledDeck } from '@/lib/poker/cards'
import { evaluateHand } from '@/lib/poker/handEval'
import { dailySeed } from '@/lib/daily'

export const GRID_SIZE = 5
export const CELLS = GRID_SIZE * GRID_SIZE

/** A grid, row by row: cell `r * 5 + c`. Null is empty. */
export type Grid = readonly (Card | null)[]

/** What each hand scores, best first. Shown on "How it scores". */
export const SOLITAIRE_POINTS: readonly { hand: string; points: number }[] = [
  { hand: 'Royal Flush', points: 100 },
  { hand: 'Straight Flush', points: 75 },
  { hand: 'Four of a Kind', points: 50 },
  { hand: 'Full House', points: 25 },
  { hand: 'Flush', points: 20 },
  { hand: 'Straight', points: 15 },
  { hand: 'Three of a Kind', points: 10 },
  { hand: 'Two Pair', points: 5 },
  { hand: 'Pair', points: 2 },
]

const POINTS = new Map(SOLITAIRE_POINTS.map((row) => [row.hand, row.points]))

/** One row or column. */
export interface Line {
  kind: 'row' | 'column'
  /** 0 to 4, top to bottom or left to right. */
  index: number
  /** The five cell indices along it. */
  cells: readonly number[]
}

/** The five rows, then the five columns. */
export const LINES: readonly Line[] = [
  ...Array.from({ length: GRID_SIZE }, (_, r) => ({
    kind: 'row' as const,
    index: r,
    cells: Array.from({ length: GRID_SIZE }, (_, c) => r * GRID_SIZE + c),
  })),
  ...Array.from({ length: GRID_SIZE }, (_, c) => ({
    kind: 'column' as const,
    index: c,
    cells: Array.from({ length: GRID_SIZE }, (_, r) => r * GRID_SIZE + c),
  })),
]

/** A full line, scored. `hand` is null for a high card, which scores nothing. */
export interface LineScore {
  line: Line
  hand: string | null
  points: number
}

/** Five cards, as a hand and its points. A high card is no hand. */
export function scoreHand(cards: readonly Card[]): { hand: string | null; points: number } {
  if (cards.length !== GRID_SIZE) throw new Error(`a line is five cards, not ${cards.length}`)
  const evaluated = evaluateHand([], cards)
  // The solver calls a royal a straight flush, and says which in the description.
  const hand = evaluated.description === 'Royal Flush' ? 'Royal Flush' : evaluated.name
  const points = POINTS.get(hand) ?? 0
  return { hand: points > 0 ? hand : null, points }
}

/** A line's score once all five of its cells are filled, else null. */
export function scoreLine(grid: Grid, line: Line): LineScore | null {
  const cards = line.cells.map((i) => grid[i])
  if (cards.some((c) => !c)) return null
  return { line, ...scoreHand(cards as Card[]) }
}

/** The whole grid: every full line's score, and the total. */
export function scoreGrid(grid: Grid): { lines: LineScore[]; total: number } {
  const lines = LINES.map((line) => scoreLine(grid, line)).filter((s): s is LineScore => !!s)
  return { lines, total: lines.reduce((sum, s) => sum + s.points, 0) }
}

/** The lines that placing at `cell` just filled. */
export function linesThrough(cell: number): Line[] {
  return LINES.filter((line) => line.cells.includes(cell))
}

/** An empty grid. */
export function emptyGrid(): (Card | null)[] {
  return Array.from({ length: CELLS }, () => null)
}

/**
 * Place the next card. Returns the new grid, or null if the cell is taken or
 * not on the grid: once down, a card never moves.
 */
export function place(grid: Grid, cell: number, card: Card): (Card | null)[] | null {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS || grid[cell]) return null
  const next = grid.slice()
  next[cell] = card
  return next
}

/** The 25 cards of a round, in the order they come. */
export function dealSolitaire(rng: Rng): Card[] {
  return shuffledDeck(rng).slice(0, CELLS)
}

/** Today's deal: the same 25 for everybody on a UTC day, not the Daily tournament's shuffle. */
export function dailySolitaire(dateKey: string): Card[] {
  return dealSolitaire(mulberry32(dailySeed(dateKey) ^ 0x5017a1e))
}
