import { readFileSync } from 'node:fs'
import test from 'ava'
import {
  COVERAGE,
  COVERAGE_RUNS,
  GROUND_TRUTH,
  MEASURED_ON,
  RATIO_TOLERANCE,
  WIDTH,
  WIDTH_SEEDS,
  WORST_BIAS,
  trueEquity,
  widthRatio,
} from '@/config/equitySampling'
import { cardFromString } from '@/lib/poker/cards'
import { SAMPLE_TARGET, createOddsRunner, formatBand, sampleBand } from '@/lib/poker/oddsQuote'

// The guard on /blog/how-accurate-is-a-poker-equity-calculator.
//
// The post's figures come from 2.65M dealt showdowns, and re-dealing those on
// every push would add 331s to a 450s suite for a rate that 100 runs can only
// pin to +/-4.3 points anyway. So this file does not re-measure. It checks the
// two things a wrong figure would have to get past:
//
//   1. The ground truth, which is a count rather than a sample. 990 showdowns,
//      instant, and every published number is a comparison against it. If this
//      moves, every row in the post is wrong and nothing else would say so.
//   2. The arithmetic each printed band claims. `claimedSe` is the band over
//      1.96, so it is derivable from `sampleBand` with no dealing at all, and a
//      row whose standard error does not match its sample size is a typo the
//      sweep would never have produced.
//
// What it deliberately does not check is the measured spread and coverage
// counts. Those are a dated measurement. `pnpm odds-band-coverage` re-runs them.

const SPOT = {
  hole: GROUND_TRUTH.hole.map(cardFromString),
  community: GROUND_TRUTH.community.map(cardFromString),
  opponents: 1,
}

test('the ground truth is still an enumeration, and still this enumeration', (t) => {
  const runner = createOddsRunner(SPOT, {})
  while (!runner.finished) runner.step(5_000)
  const quote = runner.quote

  t.true(quote?.exact, 'the post calls this answer counted, not sampled')
  t.is(quote?.showdowns, GROUND_TRUTH.showdowns)
  t.is(Math.round((quote?.win ?? 0) * GROUND_TRUTH.showdowns), GROUND_TRUTH.wins)
  t.is(Math.round((quote?.tie ?? 0) * GROUND_TRUTH.showdowns), GROUND_TRUTH.ties)
  t.is(
    GROUND_TRUTH.wins + GROUND_TRUTH.ties + GROUND_TRUTH.losses,
    GROUND_TRUTH.showdowns,
    'the three outcomes have to account for every showdown',
  )
  t.true(Math.abs((quote?.equity ?? 0) - trueEquity()) < 1e-12)
  t.is(quote?.band, 0, 'a counted answer carries no band')
})

test('every published standard error is the band that sample size earns', (t) => {
  for (const row of WIDTH) {
    // The recorded figure is the band around the mean of the runs; this is the
    // band around the counted truth. They differ by the bias, which is tiny, so
    // a row more than half a percent apart is a typo rather than a measurement.
    const derived = sampleBand(trueEquity(), row.iterations) / 1.96
    t.true(
      Math.abs(row.claimedSe - derived) / derived < 0.005,
      `${row.iterations} iterations: the post prints a ${row.claimedSe}pt standard error and the band arithmetic gives ${derived.toFixed(3)}`,
    )
    t.true(
      Math.abs(row.bias) <= WORST_BIAS,
      `${row.iterations} iterations: bias ${row.bias} is past the ${WORST_BIAS}pt the post claims as the worst`,
    )
    // The post's sentence is that every row is inside what 60 seeds can
    // resolve, so that bound is the assertion. The relative standard error of a
    // sample SD is 1/sqrt(2(n-1)), which is 9.2% at 60 seeds; the interval the
    // post prints is 1.96 of those. Note that 9.2% is *one* standard error, not
    // the interval: 1.11 at 1,500 iterations sits outside +/-9% and well inside
    // +/-18%, which is why the post gives the figure both ways rather than
    // calling every row "inside 9%".
    const ratio = widthRatio(row)
    t.true(
      Math.abs(ratio - 1) <= RATIO_TOLERANCE,
      `${row.iterations} iterations: measured spread is ${ratio.toFixed(2)}x the band's claim, outside the ${RATIO_TOLERANCE.toFixed(2)} that ${WIDTH_SEEDS} seeds can resolve. The band is the wrong width and the post says it is not.`,
    )
  }
})

// The post's central sentence is that 92, 94 and 99 all mean the same thing.
// That is arithmetic, not a judgement: 100 runs put a +/-4.3 point band on a 95%
// rate, so a row far enough from 95 to read as a trend would make the sentence
// false. This is the check on the sentence rather than on the numbers.
test('no coverage row is far enough from 95 to be a trend', (t) => {
  const halfWidth = 1.96 * Math.sqrt((0.95 * 0.05) / COVERAGE_RUNS) * 100
  for (const row of COVERAGE) {
    t.true(
      Math.abs(row.contained - 95) <= halfWidth,
      `${row.iterations} iterations: ${row.contained}/${COVERAGE_RUNS} is more than ${halfWidth.toFixed(1)} points from 95, so the post cannot call all three rows the same number`,
    )
    t.is(
      row.worstMiss > 0,
      row.contained < COVERAGE_RUNS,
      `${row.iterations} iterations: a worst miss and a perfect row cannot both be true`,
    )
  }
})

// The calculator itself prints "+/-0.7 points, from 20,000 hands dealt". The post
// is about that sentence, so if the product's sample size or band moves, the
// post is about a claim the product no longer makes.
test('the post is still describing the band the calculator prints', (t) => {
  t.is(SAMPLE_TARGET, 20_000)
  t.true(
    COVERAGE.some((row) => row.iterations === SAMPLE_TARGET),
    'the calculator’s own sample size has no row in the published table',
  )
  t.is(formatBand(sampleBand(trueEquity(), SAMPLE_TARGET)), '0.7')
})

test('the post prints its figures from this file, not from typed literals', (t) => {
  const source = readFileSync(
    new URL('../src/app/blog/how-accurate-is-a-poker-equity-calculator/page.tsx', import.meta.url),
    'utf-8',
  )
  t.true(source.includes("from '@/config/equitySampling'"), 'the post has stopped importing them')
  for (const symbol of ['COVERAGE.map', 'WIDTH.map']) {
    t.true(source.includes(symbol), `the post no longer renders its table from ${symbol}`)
  }
  t.regex(source, /MEASURED_ON/, 'the post no longer dates its measurement')
  t.regex(MEASURED_ON, /^\d{4}-\d{2}-\d{2}$/)
})
