// Does the odds calculator's error bar mean what it says?
//
// The calculator prints a 95% band on every sampled answer (`sampleBand` in
// lib/poker/oddsQuote.ts). "95%" is a promise: across many runs of the same
// spot, the band should contain the true answer about 95 times in 100. This
// measures whether it does, and it is where the published figure comes from.
//
//   pnpm odds-band-coverage
//
// **Why this is a script and not a test.** Guarding a published measurement by
// re-measuring it in CI costs minutes and does not guard much: 100 runs puts a
// +/-4.3 point binomial band on a 95% coverage rate, so an assertion loose
// enough not to flake is loose enough to pass with a badly broken band. What CI
// holds instead is the arithmetic the promise rests on, in
// tests/oddsQuote.test.ts, which deals no showdowns at all.
//
// **The spot has to be enumerable, and the estimator has to be made to sample
// on it.** Ground truth here is a count, not a bigger sample: heads-up with the
// board complete is 990 opponent holdings, which `createOddsRunner` counts
// exactly. But that is the same condition under which it refuses to sample, so
// asking the runner for a sampled answer on this spot gets the exact one back.
// So the sampled side calls `estimateEquity` and `sampleBand` directly. That is
// not an approximation of the calculator's sampling path, it is that path:
// `createOddsRunner`'s non-exact branch calls the same two functions with the
// same arguments.

import { cardFromString, mulberry32 } from '../src/lib/poker/cards'
import { estimateEquity } from '../src/lib/poker/equity'
import { createOddsRunner, sampleBand } from '../src/lib/poker/oddsQuote'

/**
 * Pocket eights on a complete A-K-9-4-2 board: 58.6% equity, so the spot sits
 * near the middle where a proportion's variance is worst and the band has the
 * most work to do. Picked by enumerating ten candidate spots, not by taste.
 */
const HOLE = ['8h', '8d'].map(cardFromString)
const COMMUNITY = ['Ac', 'Kd', '2s', '9h', '4c'].map(cardFromString)

const RUNS = 100
const SAMPLE_SIZES = [1_500, 5_000, 20_000]

const runner = createOddsRunner({ hole: HOLE, community: COMMUNITY, opponents: 1 }, {})
while (!runner.finished) runner.step(5_000)
const truth = runner.quote
if (!truth?.exact) throw new Error('the ground-truth spot did not enumerate')

console.log(
  `truth: ${(truth.equity * 100).toFixed(4)}% over ${truth.showdowns} enumerated showdowns\n`,
)

for (const iterations of SAMPLE_SIZES) {
  const started = Date.now()
  let contained = 0
  let worstMiss = 0

  for (let run = 0; run < RUNS; run++) {
    // A fresh seed per run, and the same seeds at every sample size, so the
    // rows differ only by how many showdowns each run was given.
    const { equity } = estimateEquity({
      hole: HOLE,
      community: COMMUNITY,
      opponents: 1,
      iterations,
      rng: mulberry32(20_260_914 + run),
    })
    const band = sampleBand(equity, iterations)

    // How far outside its own band this run landed, in points. Zero or less is
    // a hit.
    const missBy = Math.abs(equity - truth.equity) * 100 - band
    if (missBy <= 0) contained++
    else worstMiss = Math.max(worstMiss, missBy)
  }

  const seconds = (Date.now() - started) / 1000
  console.log(
    `${String(iterations).padStart(6)} iterations  ${contained}/${RUNS} contained  ` +
      `worst miss ${worstMiss.toFixed(2)}pts  ${seconds.toFixed(1)}s  ` +
      `(${(RUNS * iterations).toLocaleString()} showdowns)`,
  )
}
