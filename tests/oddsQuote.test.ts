import test from 'ava'
import { type Card, cardFromString, mulberry32 } from '@/lib/poker/cards'
import { estimateEquity } from '@/lib/poker/equity'
import {
  EXACT_MAX_SHOWDOWNS,
  MAX_OPPONENTS,
  SAMPLE_TARGET,
  canEnumerate,
  combinations,
  createOddsRunner,
  decimalsFor,
  exhaustiveShowdowns,
  formatBand,
  formatQuoted,
  sampleBand,
} from '@/lib/poker/oddsQuote'

// The claims /poker-odds-calculator makes, pinned to the functions that make
// them. The page's whole argument is that it is the honest one, so the things
// worth checking are not the equities themselves (the engine has its own tests)
// but the promises wrapped round them: that the three numbers mean what their
// labels say, that the stated error bar came from the run that was actually
// done, and that "exact" is only ever printed over an exhaustive count.

const h = (...s: string[]): Card[] => s.map(cardFromString)

/** Drive a runner to the end and hand back the quote. */
function run(
  input: Parameters<typeof createOddsRunner>[0],
  opts: Parameters<typeof createOddsRunner>[1] = {},
  chunk = 4096,
) {
  const runner = createOddsRunner(input, opts)
  while (!runner.finished) {
    if (runner.step(chunk) === 0) break
  }
  const quote = runner.quote
  if (!quote) throw new Error('a finished run has a quote')
  return quote
}

// --- what the three numbers mean -------------------------------------------

// Claim 1. The block reads "65% equity / wins 63%, ties 3%", and those labels
// are only true if win and tie partition the showdowns and equity sits between
// winning outright and winning every tie. Cheap, and it is the whole reason the
// reader can trust the second line.
test('win and tie partition the showdowns, and equity sits between them', (t) => {
  const boards = [
    [],
    h('Qh', '7h', '2d'),
    h('Qh', '7h', '2d', '3c'),
    h('Qh', '7h', '2d', '3c', '9s'),
  ]
  for (const community of boards) {
    for (const opponents of [1, 3, MAX_OPPONENTS]) {
      const q = run(
        { hole: h('Ah', 'Ks'), community, opponents },
        { rng: mulberry32(11), target: 600 },
      )
      const where = `${community.length} board cards vs ${opponents}`
      t.true(q.win >= 0 && q.tie >= 0, where)
      t.true(q.win + q.tie <= 1 + 1e-12, `${where}: win + tie = ${q.win + q.tie}`)
      t.true(q.equity >= q.win - 1e-12, `${where}: equity ${q.equity} < win ${q.win}`)
      t.true(q.equity <= q.win + q.tie + 1e-12, `${where}: equity ${q.equity} > win + tie`)
    }
  }
})

// --- the band -------------------------------------------------------------

// Claim 2. If someone tunes the iteration count for speed later, the band has
// to move with it or the page starts lying quietly. So the band is not allowed
// to be a constant anywhere: it is a function of the run's own showdown count.
test('the band a quote carries is computed from the showdowns that quote ran', (t) => {
  for (const target of [500, 2000, 20_000]) {
    const q = run({ hole: h('Ah', 'Ks'), opponents: 1 }, { rng: mulberry32(4), target })
    t.is(q.showdowns, target)
    t.is(q.band, sampleBand(q.equity, q.showdowns))
  }
})

test('the band tightens as the square root of the run length', (t) => {
  // The three figures the page's own arithmetic was written against.
  t.is(sampleBand(0.5, 1_500).toFixed(1), '2.5')
  t.is(sampleBand(0.5, 20_000).toFixed(1), '0.7')
  t.is(sampleBand(0.5, 100_000).toFixed(1), '0.3')
  // Four times the run, half the band.
  t.true(Math.abs(sampleBand(0.5, 5_000) / sampleBand(0.5, 20_000) - 2) < 1e-9)
})

test('a run that never lost still carries a band', (t) => {
  // Zero variance would print ±0.0 and read as certainty. It is a sample; it
  // is not certain. The rule of three is the floor.
  t.true(sampleBand(1, 20_000) > 0)
  t.is(sampleBand(1, 20_000), 300 / 20_000)
  t.is(sampleBand(0, 20_000), sampleBand(1, 20_000))
})

test('the displayed precision follows the band and never leads it', (t) => {
  // ±0.7 does not earn a tenths digit; an exact answer does.
  t.is(decimalsFor(sampleBand(0.5, SAMPLE_TARGET)), 0)
  t.is(decimalsFor(0), 1)
  t.is(formatQuoted(0.652, sampleBand(0.5, SAMPLE_TARGET)), '65%')
  t.is(formatQuoted(0.652, 0), '65.2%')
  // And the band prints enough of itself to be worth reading: a band under a
  // tenth of a point would round to ±0.0 and read as certainty.
  t.is(formatBand(sampleBand(0.5, SAMPLE_TARGET)), '0.7')
  t.is(formatBand(sampleBand(1, SAMPLE_TARGET)), '0.01')
  t.not(formatBand(sampleBand(1, SAMPLE_TARGET)), '0.0')
})

// --- counting rather than sampling ----------------------------------------

// The four counts the page's exact/sampled split is decided by. They are pure
// arithmetic, and getting one wrong would either promise an exact answer the
// page cannot deliver or hide one it could.
test('the exhaustive count is the number of showdowns actually available', (t) => {
  const hole = h('Ah', 'Ks')
  const river = h('Qh', '7h', '2d', '3c', '9s')
  t.is(exhaustiveShowdowns({ hole, community: river, opponents: 1 }), 990)
  t.is(exhaustiveShowdowns({ hole, community: river.slice(0, 4), opponents: 1 }), 45_540)
  t.is(exhaustiveShowdowns({ hole, community: river.slice(0, 3), opponents: 1 }), 1_070_190)
  t.is(exhaustiveShowdowns({ hole, opponents: 1 }), 2_097_572_400)
  t.is(exhaustiveShowdowns({ hole, community: river, opponents: 2 }), 893_970)
  t.is(combinations(45, 2), 990)
  t.is(combinations(52, 5), 2_598_960)
})

test('only a spot small enough to count is offered as exact', (t) => {
  const hole = h('Ah', 'Ks')
  const river = h('Qh', '7h', '2d', '3c', '9s')
  t.true(canEnumerate({ hole, community: river, opponents: 1 }))
  // Heads-up on the turn is 45,540 showdowns: correct, and too slow to put in
  // front of somebody, so it samples.
  t.false(canEnumerate({ hole, community: river.slice(0, 4), opponents: 1 }))
  t.false(canEnumerate({ hole, opponents: 1 }))
  // Multi-way never enumerates, and the reason is the count rather than a
  // special case: the smallest one is 893,970.
  t.false(canEnumerate({ hole, community: river, opponents: 2 }))
  t.true(exhaustiveShowdowns({ hole, community: river, opponents: 2 }) > EXACT_MAX_SHOWDOWNS)
})

// Claim 4. An exact answer that is off by a tenth is worse than an estimate,
// because it is wearing a label that says it cannot be.
test('the exact path is exact: a made royal flush reads 100%, not 99.9%', (t) => {
  const q = run({ hole: h('Ah', 'Kh'), community: h('Qh', 'Jh', 'Th', '2c', '3d'), opponents: 1 })
  t.true(q.exact)
  t.is(q.showdowns, 990)
  t.is(q.equity, 1)
  t.is(q.win, 1)
  t.is(q.tie, 0)
  t.is(q.band, 0)
  t.is(formatQuoted(q.equity, q.band), '100.0%')
})

test('the exact path counts ties as ties', (t) => {
  // The board plays: both hole cards are dead, so every opponent holding that
  // does not improve chops. A quote whose tie fraction was zero here would be
  // mislabelling most of its own showdowns.
  const q = run({ hole: h('2c', '3d'), community: h('Ah', 'Kh', 'Qh', 'Jh', 'Th'), opponents: 1 })
  t.true(q.exact)
  t.is(q.win, 0)
  t.true(q.tie > 0.5, `expected mostly chops, got ${q.tie}`)
  t.is(q.equity, q.tie / 2)
})

test('an exact run shows nothing until it has counted everything', (t) => {
  // A half-finished enumeration is a biased subset of the run-outs, not a small
  // sample of them, so there is no honest number to put on screen mid-count.
  const runner = createOddsRunner({
    hole: h('Ah', 'Ks'),
    community: h('Qh', '7h', '2d', '3c', '9s'),
    opponents: 1,
  })
  runner.step(100)
  t.is(runner.done, 100)
  t.is(runner.quote, null)
  while (!runner.finished) runner.step(100)
  t.truthy(runner.quote)
})

// Claim 3. One test that checks the sampler, the counter and the band at once:
// if any of the three is wrong, the two answers stop meeting.
test('the exhaustive answer and a sampled one agree, inside the sample’s own band', (t) => {
  const spot = { hole: h('Ah', 'Ks'), community: h('Qh', '7h', '2d', '3c', '9s'), opponents: 1 }
  const exact = run(spot)
  t.true(exact.exact)

  // The sampler is called directly: this spot is small enough to count, so a
  // runner would never sample it, and the whole point is to put the two methods
  // on the same spot.
  //
  // Six fixed seeds. A 95% band is expected to miss about one run in twenty, so
  // these are stated as passing rather than assumed to: they are deterministic,
  // and all six land inside a band that is itself deliberately conservative.
  const iterations = 20_000
  for (const seed of [1, 2, 3, 5, 8, 13]) {
    const sampled = estimateEquity({ ...spot, iterations, rng: mulberry32(seed) })
    const band = sampleBand(sampled.equity, iterations)
    const gap = Math.abs(sampled.equity - exact.equity) * 100
    t.true(gap <= band, `seed ${seed}: ${gap.toFixed(3)} points out, band ±${band.toFixed(3)}`)
  }
})

// --- chopping the work up --------------------------------------------------

test('how the run is chopped into slices does not change the answer', (t) => {
  // The page slices the work to keep the main thread free, sizing each slice
  // from how long the last one took, so the slicing is device-dependent and
  // must not be part of the arithmetic.
  //
  // Slicing does change which hands get dealt: estimateEquity shuffles its deck
  // in place across the iterations of one call and a fresh call starts that
  // over. What has to hold is that both slicings are unbiased samples of the
  // same spot, so they agree inside the band they each state.
  const spot = { hole: h('Jc', 'Jd'), community: h('9c', '4c', '2h'), opponents: 2 }
  const whole = run(spot, { rng: mulberry32(77), target: 8_000 }, 8_000)
  const sliced = run(spot, { rng: mulberry32(77), target: 8_000 }, 137)
  t.is(sliced.showdowns, whole.showdowns)
  t.is(sliced.band, whole.band === 0 ? 0 : sampleBand(sliced.equity, sliced.showdowns))
  const gap = Math.abs(sliced.equity - whole.equity) * 100
  t.true(gap <= whole.band + sliced.band, `${gap.toFixed(3)} points apart`)
})

test('a run stopped early is still a valid quote, with a wider band', (t) => {
  // A slow phone runs out of time before it runs out of target. That is fine
  // and it is why the band exists, but the quote has to describe what was run.
  const runner = createOddsRunner({ hole: h('Ah', 'Ks'), opponents: 3 }, { rng: mulberry32(6) })
  runner.step(1_000)
  const partial = runner.quote
  if (!partial) throw new Error('a sampled run has a quote as soon as it has done anything')
  t.is(partial.showdowns, 1_000)
  t.is(partial.band, sampleBand(partial.equity, 1_000))
  t.true(partial.band > sampleBand(0.5, SAMPLE_TARGET))
})

// --- the sentence in the prose --------------------------------------------

// Claim 5. The page says ace-king against one random hand is "about two
// thirds". That is a claim about a computed number sitting in the half of the
// page no computation touches, which is exactly where /learn/starting-hands and
// /learn/position drifted apart. If the figure and the phrasing ever disagree,
// the phrasing is the one to fix.
test('“about two thirds”, and losing a third, are what ace-king actually does', (t) => {
  const q = run({ hole: h('Ah', 'Ks'), opponents: 1 }, { rng: mulberry32(2), target: 40_000 })
  const twoThirds = 200 / 3
  t.true(
    Math.abs(q.equity * 100 - twoThirds) < 2.5,
    `“about two thirds” vs ${(q.equity * 100).toFixed(2)}%`,
  )
  // "which sounds like a lot until you notice it means you lose a third of the
  // time" is the other half of the same sentence.
  const losing = 1 - q.win - q.tie
  t.true(losing > 0.28 && losing < 0.38, `expected about a third, got ${losing}`)
})
