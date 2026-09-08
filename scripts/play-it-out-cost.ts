// What does one hand of the play-it-out mode cost, and what does the player
// get for it?
//
// The mode's grade comes off a sampled equity, so `ITERATIONS` buys precision
// and `MARGIN` spends it: a street is only asked when the measured gap between
// the hero's equity and the price clears MARGIN, and the guarantee that a
// correct answer cannot be marked wrong is `MARGIN - BAND >= FAIR_QUESTION`.
// Both are constants in `src/lib/drills/playItOut.ts` and this walks a grid of
// them, because the runner mode has to deal a hand while somebody watches and
// 20,000 iterations was chosen without anybody timing it.
//
//   pnpm exec tsx scripts/play-it-out-cost.ts
//
// Three columns matter. `ms/hand` is what the screen waits. `decisions/hand` is
// what the player gets, and it is the thing MARGIN spends: a wider margin asks
// fewer, clearer questions. `true gap` is the floor the guarantee holds at, and
// it must stay at or above FAIR_QUESTION or the setting is not shippable at
// all, whatever it costs.

import { BET_SIZES } from '@/config/potOdds'
import { type Card, mulberry32, shuffledDeck } from '@/lib/poker/cards'
import { estimateEquity } from '@/lib/poker/equity'

const FAIR_QUESTION = 4
const SELECTIVITY = [0.5] as const
const STARTING_POTS = [120, 180, 240, 360, 480, 600] as const
const FRACTIONS = [1 / 6, 1 / 5, 2 / 5, ...BET_SIZES.map((s) => s.fraction)].sort((a, b) => a - b)
const STREETS = [3, 4, 5] as const
const MAX_GAP = 20

const bandOf = (iterations: number) => 1.96 * (50 / Math.sqrt(iterations))

/** A copy of the generator's accept/reject, parameterised, and counting only. */
function playOut(seed: number, iterations: number, margin: number) {
  const deck = shuffledDeck(mulberry32(seed))
  const hole = deck.slice(0, 2)
  const full: Card[] = deck.slice(4, 9)
  const rng = mulberry32((seed ^ 0x5f37_59df) >>> 0)
  let pot: number = STARTING_POTS[Math.floor(rng() * STARTING_POTS.length)]
  let asked = 0

  for (const [index, cards] of STREETS.entries()) {
    const board = full.slice(0, cards)
    const { equity } = estimateEquity({
      hole,
      community: board,
      opponents: 1,
      opponentSelectivity: SELECTIVITY,
      iterations,
      rng: mulberry32((seed + 0x9e37_79b9 * (index + 1)) >>> 0),
    })
    const prices = FRACTIONS.map((fraction) => {
      const toCall = Math.max(1, Math.round(pot * fraction))
      return { toCall, required: toCall / (pot + 2 * toCall) }
    })
    const gapOf = (p: { required: number }) => Math.abs(equity - p.required) * 100
    const askable = prices.filter((p) => gapOf(p) >= margin && gapOf(p) <= MAX_GAP)
    const calls = askable.filter((p) => equity > p.required)
    const folds = askable.filter((p) => p.required > equity)
    if (calls.length === 0 || folds.length === 0) continue
    const side = rng() < 0.5 ? calls : folds
    const price = side[Math.floor(rng() * side.length)]
    pot += 2 * price.toCall
    asked++
  }
  return asked
}

const SEEDS = Number(process.argv[2] ?? 60)
const GRID: Array<{ iterations: number; margin: number }> = [
  { iterations: 20_000, margin: 6 },
  { iterations: 10_000, margin: 6 },
  { iterations: 5_000, margin: 6 },
  { iterations: 2_500, margin: 6 },
  { iterations: 5_000, margin: 6.5 },
  { iterations: 5_000, margin: 7 },
  { iterations: 10_000, margin: 6.5 },
]

console.log(`n=${SEEDS} seeds per row, 2 cores\n`)
console.log('iterations  margin   band  true gap  accept%  decisions/hand  ms/seed  ms/hand')
for (const { iterations, margin } of GRID) {
  const band = bandOf(iterations)
  let hands = 0
  let decisions = 0
  const t0 = performance.now()
  for (let seed = 1; seed <= SEEDS; seed++) {
    const asked = playOut(seed, iterations, margin)
    if (asked > 0) {
      hands++
      decisions += asked
    }
  }
  const ms = performance.now() - t0
  const safe = margin - band >= FAIR_QUESTION ? ' ' : '!'
  console.log(
    [
      String(iterations).padStart(10),
      margin.toFixed(2).padStart(7),
      band.toFixed(2).padStart(6),
      `${(margin - band).toFixed(2)}${safe}`.padStart(9),
      `${((hands / SEEDS) * 100).toFixed(0)}%`.padStart(8),
      (decisions / hands).toFixed(2).padStart(15),
      (ms / SEEDS).toFixed(0).padStart(8),
      (ms / hands).toFixed(0).padStart(8),
    ].join(''),
  )
}
