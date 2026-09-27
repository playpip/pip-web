// Writes src/lib/drills/shoveChart.ts: the all-in equity of every starting hand
// against every other, and the Nash shoving and calling ranges for every seat
// and stack the shove-or-fold pack asks about.
//
//   pnpm shove-chart            # about three minutes
//
// **Why a chart, and why it is written by a script rather than at runtime.** A
// shove is worth what your hand wins against the hands that call it, and that
// is a preflop all-in: 1,712,304 boards per pair of hands, which nobody is
// going to enumerate between one spot and the next. So it is sampled once,
// here, with a fixed seed, and the sample's band is carried into every grade
// (see CELL_BAND in src/lib/drills/shoveRange.ts). The Nash ranges are then
// solved on the sampled table, by the same `solveNash` the tests use to check
// them, so the chart and the formula cannot disagree about what they are.
//
// Deterministic: the same TRIALS and seed write the same file, byte for byte.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fastScore } from '@/lib/drills/riverRange'
import {
  CLASSES,
  CLASS_COUNT,
  SHOVE_SEATS,
  STACKS,
  decodeMatrix,
  encodeCell,
  encodeRange,
  solveNash,
  spotKey,
} from '@/lib/drills/shoveRange'
import { type Card, RANKS, SUITS, mulberry32 } from '@/lib/poker/cards'

/** Boards per pair of hands. One cell's standard error is at most 0.5 / √TRIALS. */
const TRIALS = Number(process.env.SHOVE_TRIALS ?? 6_000)
const SEED = 20_260_924

const rng = mulberry32(SEED)
const DECK: Card[] = RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })))
const key = (c: Card) => `${c.rank}${c.suit}`

function cell(i: number, j: number): number {
  const hero = CLASSES[i].combos[0]
  const dead = new Set(hero.map(key))
  const villains = CLASSES[j].combos.filter(([a, b]) => !dead.has(key(a)) && !dead.has(key(b)))
  // The deck left for each villain combination, built once. A partial shuffle
  // draws a uniform five from any ordering, so the arrays are reused as they are.
  const rests = villains.map((villain) => {
    const out = new Set([...hero, ...villain].map(key))
    return DECK.filter((c) => !out.has(key(c)))
  })
  let won = 0
  const seven: Card[] = new Array(7)
  const theirs: Card[] = new Array(7)
  for (let t = 0; t < TRIALS; t++) {
    const v = Math.floor(rng() * villains.length)
    const villain = villains[v]
    const rest = rests[v]
    // Five from the rest, by a partial shuffle.
    for (let k = 0; k < 5; k++) {
      const pick = k + Math.floor(rng() * (rest.length - k))
      ;[rest[k], rest[pick]] = [rest[pick], rest[k]]
    }
    seven[0] = hero[0]
    seven[1] = hero[1]
    theirs[0] = villain[0]
    theirs[1] = villain[1]
    for (let k = 0; k < 5; k++) {
      seven[k + 2] = rest[k]
      theirs[k + 2] = rest[k]
    }
    const a = fastScore(seven)
    const b = fastScore(theirs)
    won += a > b ? 1 : a === b ? 0.5 : 0
  }
  return won / TRIALS
}

const started = performance.now()
let matrix = ''
for (let i = 0; i < CLASS_COUNT; i++) {
  for (let j = i + 1; j < CLASS_COUNT; j++) matrix += encodeCell(cell(i, j))
  if (i % 20 === 0)
    console.log(`row ${i} of ${CLASS_COUNT}, ${((performance.now() - started) / 1000).toFixed(0)}s`)
}

const eq = decodeMatrix(matrix)
const nash: Record<string, string> = {}
for (const seat of SHOVE_SEATS) {
  for (const stack of STACKS) {
    const spot = { seat, stack }
    const ranges = solveNash(spot, eq)
    nash[spotKey(spot)] = [ranges.shove, ...ranges.call].map(encodeRange).join('.')
    console.log(`nash ${spotKey(spot)}, ${((performance.now() - started) / 1000).toFixed(0)}s`)
  }
}

const lines = [
  '// Written by `pnpm shove-chart` (scripts/shove-chart.ts). Do not edit by hand.',
  '//',
  '// MATRIX: the upper triangle of a 169 × 169 table, row by row, two base-64',
  '// characters a cell (see decodeMatrix in ./shoveRange). Cell (i, j) is hand',
  '// i’s share of the pot all-in before the flop against hand j, over TRIALS',
  `// random boards from seed ${SEED}.`,
  '//',
  '// NASH: for each seat and stack ("btn-7"), the shoving range and then each',
  '// calling range behind it in turn order, 169 bits each, joined by dots.',
  '',
  `export const TRIALS = ${TRIALS}`,
  '',
  `export const MATRIX =\n  '${matrix}'`,
  '',
  'export const NASH: Record<string, string> = {',
  ...Object.entries(nash).map(([k, v]) => `  '${k}': '${v}',`),
  '}',
  '',
]
writeFileSync(
  fileURLToPath(new URL('../src/lib/drills/shoveChart.ts', import.meta.url)),
  lines.join('\n'),
)
console.log(`done in ${((performance.now() - started) / 1000).toFixed(0)}s`)
