// How hard a year of Daily puzzles is, and how close Pip's own grid gets.
//
// Every Poker Solitaire puzzle asks for 90% of a grid Pip found with these
// same 25 cards (lib/quick/solitairePuzzle), so every one can be solved. This
// deals a year of Daily puzzles and reports, for each:
//
//   - what the 25 cards score as they first lie on the grid (no thought),
//   - what Pip's grid scores, and the target it sets,
//   - what a search with more than five times the swaps finds, from a seed
//     of its own: how often it beats Pip's grid, and by how much.
//
//   pnpm solitaire-targets              # every day of 2027
//   pnpm solitaire-targets 30           # the first 30 days
//
// The longer search is the same method as Pip's (simulated annealing), so it
// is a check on Pip's search, not proof of the best grid there is.

import { mulberry32 } from '../src/lib/poker/cards'
import { LINES, scoreGrid } from '../src/lib/quick/solitaire'
import { dailyPuzzle, encodeCards, linePoints } from '../src/lib/quick/solitairePuzzle'

const DAYS = Number(process.argv[2] ?? 365)
const RESTARTS = 5
const SWAPS = 100_000
const START_HEAT = 6

const LINE_CELLS = LINES.map((l) => l.cells)
const CELL_LINES = Array.from({ length: 25 }, (_, cell) =>
  LINE_CELLS.flatMap((cells, i) => (cells.includes(cell) ? [i] : [])),
)

function longSearch(start: number[], seed: number): number {
  const rng = mulberry32(seed)
  const grid = start.slice()
  const lineScore = (line: number) => {
    const [a, b, c, d, e] = LINE_CELLS[line]
    return linePoints(grid[a], grid[b], grid[c], grid[d], grid[e])
  }
  const scores = LINE_CELLS.map((_, i) => lineScore(i))
  let score = scores.reduce((s, n) => s + n, 0)
  let best = score
  for (let run = 0; run < RESTARTS; run++) {
    for (let k = 0; k < SWAPS; k++) {
      const heat = START_HEAT * (1 - k / SWAPS) + 0.01
      const x = Math.floor(rng() * 25)
      const y = Math.floor(rng() * 25)
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
        if (score > best) best = score
      } else {
        ;[grid[x], grid[y]] = [grid[y], grid[x]]
      }
    }
  }
  return best
}

const range = (xs: number[]) => `${Math.min(...xs)} to ${Math.max(...xs)}`
const median = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]

const dealt: number[] = []
const pips: number[] = []
const targets: number[] = []
const gains: number[] = []

for (let d = 0; d < DAYS; d++) {
  const key = new Date(Date.UTC(2027, 0, 1 + d)).toISOString().slice(0, 10)
  const puzzle = dailyPuzzle(key)
  dealt.push(scoreGrid(puzzle.cards).total)
  pips.push(puzzle.pip)
  targets.push(puzzle.target)
  gains.push(longSearch(encodeCards(puzzle.cards), 0x5eed ^ d) - puzzle.pip)
}

const beaten = gains.filter((g) => g > 0)
console.log(`${DAYS} Daily puzzles from 2027-01-01`)
console.log(`As first dealt: ${range(dealt)}, median ${median(dealt)}`)
console.log(`Pip's grid:     ${range(pips)}, median ${median(pips)}`)
console.log(`Target:         ${range(targets)}, median ${median(targets)}`)
console.log(
  `Longer search beat Pip's grid on ${beaten.length} of ${DAYS} days` +
    (beaten.length ? `, by ${range(beaten)} points` : ''),
)
console.log(`Longer search fell short of Pip's grid on ${gains.filter((g) => g < 0).length} days`)
