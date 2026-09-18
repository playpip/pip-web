// The cash harness, and the arithmetic it uses to decide what it is allowed to
// say (technology#81).
//
// Two halves, tested separately on purpose.
//
// **The poker half** has exact properties and they are asserted exactly: chips
// are conserved, a hand is a closed system with nothing carried between hands,
// and the button advances one seat a hand. Those are what make a session
// shardable by hand index and position-balanced, and all three are cheap to
// check.
//
// **The statistics half** is where a harness lies. `cashStats` decides whether a
// rate has established a direction, and `handsForPrecision` decides how long a
// run has to be. Both are fed known inputs here rather than poker, because a
// statistical assertion against a Monte-Carlo sample is a coin flip dressed as a
// test: at the spread this harness measures, a few dozen hands cannot
// distinguish a big edge from none, so a test built on one would pass whatever
// the code did. That is the defect this file exists to avoid, not commit.

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'ava'
import {
  buttonForHand,
  cashStats,
  handsForPrecision,
  HEROES,
  HERO_ID,
  hash,
  orbitHands,
  playCashHand,
  runCashSession,
} from '../scripts/cash-sim'
import { mulberry32 } from '@/lib/poker/cards'
import { RING_TABLES, venueById, type Venue } from '@/config/venues'

const micro = venueById('ring-micro') as Venue
const hero = HEROES.competent
const rngFor = (venue: Venue, handIndex: number, seed = 1) =>
  mulberry32((hash(venue.id) + seed * 1_000_003 + handIndex) >>> 0)

// --- the poker half ----------------------------------------------------------

test('chips are conserved: every seat delta sums to exactly zero', (t) => {
  for (const h of [0, 1, 2, 3, 4]) {
    const deltas = playCashHand(micro, hero, rngFor(micro, h), h)
    const total = Object.values(deltas).reduce((a, b) => a + b, 0)
    t.is(total, 0, `hand ${h} created or destroyed chips`)
  }
})

test('every seat is dealt into the hand, including the hero', (t) => {
  const deltas = playCashHand(micro, hero, rngFor(micro, 0), 0)
  t.is(Object.keys(deltas).length, micro.seats)
  t.true(HERO_ID in deltas)
})

test('nobody can lose more than the table stack in one hand', (t) => {
  const stack = micro.startingStack ?? micro.buyIn
  for (let h = 0; h < 8; h++) {
    for (const [id, delta] of Object.entries(playCashHand(micro, hero, rngFor(micro, h), h))) {
      t.true(delta >= -stack, `${id} lost more than a full stack on hand ${h}`)
      t.true(delta <= stack * (micro.seats - 1), `${id} won more than the table held on hand ${h}`)
    }
  }
})

test('a hand is a closed system: the same index gives the same result, alone or in a range', (t) => {
  // This is the property that makes slicing across workers safe. If a hand ever
  // depended on the one before it, the union of two shards would stop matching a
  // serial run and every parallel measurement would be quietly wrong.
  const alone = runCashSession(micro, hero, 1, 3, 4)
  const inRange = runCashSession(micro, hero, 1, 0, 4)
  const before = runCashSession(micro, hero, 1, 0, 3)
  t.is(inRange.hands, 4)
  t.is(inRange.chips - before.chips, alone.chips)
  t.is(inRange.chipsSq - before.chipsSq, alone.chipsSq)
})

test('a session is deterministic in its seed', (t) => {
  t.deepEqual(runCashSession(micro, hero, 1, 0, 3), runCashSession(micro, hero, 1, 0, 3))
  t.notDeepEqual(runCashSession(micro, hero, 1, 0, 3), runCashSession(micro, hero, 2, 0, 3))
})

test('the button advances one seat a hand and covers every position once an orbit', (t) => {
  for (const venue of RING_TABLES) {
    const seen = new Set<number>()
    for (let h = 0; h < venue.seats; h++) seen.add(buttonForHand(h, venue.seats))
    t.is(seen.size, venue.seats, `${venue.id} does not cover every position in one orbit`)
    t.is(buttonForHand(venue.seats, venue.seats), buttonForHand(0, venue.seats))
  }
})

test('the button index wraps rather than running off the end of the table', (t) => {
  const a = playCashHand(micro, hero, rngFor(micro, 0), 1)
  const b = playCashHand(micro, hero, rngFor(micro, 0), 1 + micro.seats)
  t.deepEqual(a, b)
  // And position is worth something, so a different button is a different hand.
  const c = playCashHand(micro, hero, rngFor(micro, 0), 2)
  t.notDeepEqual(a, c)
})

test('a requested hand count is rounded up to a whole orbit, never down to nothing', (t) => {
  for (const venue of RING_TABLES) {
    const s = venue.seats
    t.is(orbitHands(10_000, s) % s, 0)
    t.true(orbitHands(10_000, s) >= 10_000)
    t.is(orbitHands(0, s), s, 'a run must be at least one orbit')
    t.is(orbitHands(1, s), s)
    t.is(orbitHands(Number.NaN, s), s)
  }
})

// --- the statistics half -----------------------------------------------------

test('bb/100 is the mean per-hand delta in big blinds, scaled by a hundred', (t) => {
  // 100 hands, +2 chips each, at a big blind of 2: one big blind a hand, so
  // +100 bb/100. No spread, so the band is zero wide.
  const s = cashStats({ hands: 100, chips: 200, chipsSq: 400 }, 2)
  t.is(s.bb100, 100)
  t.is(s.ci95, 0)
  t.is(s.sdBb, 0)
  t.false(s.straddlesZero)
})

test('the band is the measured spread, not an assumed one', (t) => {
  // Half the hands +10 chips, half -10, at a big blind of 1: mean 0, sd 10.
  const s = cashStats({ hands: 400, chips: 0, chipsSq: 400 * 100 }, 1)
  t.is(s.sdBb, 10)
  t.is(Math.round(s.ci95), Math.round((1.96 * 10 * 100) / Math.sqrt(400)))
  t.true(s.straddlesZero, 'a mean of zero has not established a direction')
})

test('a band containing zero is flagged, and one clear of it is not', (t) => {
  // Same spread, same sample, shifted far enough that the interval clears zero.
  const spread = { hands: 400, chipsSq: 400 * 100 }
  t.true(cashStats({ ...spread, chips: 400 * 0.5 }, 1).straddlesZero)
  t.false(cashStats({ ...spread, chips: 400 * 5 }, 1).straddlesZero)
})

test('a sample too small to have a spread gets an infinite band, not a confident one', (t) => {
  // The failure mode worth guarding: one hand has zero measured variance, so a
  // naive standard error is 0 and a single lucky hand reads as a certainty.
  const one = cashStats({ hands: 1, chips: 500, chipsSq: 250_000 }, 2)
  t.is(one.ci95, Number.POSITIVE_INFINITY)
  t.true(one.straddlesZero)
  const none = cashStats({ hands: 0, chips: 0, chipsSq: 0 }, 2)
  t.is(none.ci95, Number.POSITIVE_INFINITY)
  t.true(none.straddlesZero)
})

test('variance is never negative, however the sums round', (t) => {
  const s = cashStats({ hands: 10, chips: 100, chipsSq: 999.9999 }, 1)
  t.true(Number.isFinite(s.sdBb))
  t.true(s.sdBb >= 0)
})

test('the hand budget is quadratic in the precision asked for', (t) => {
  // This is the arithmetic technology#81 got wrong. At a per-hand spread of 10bb
  // (which is a 100bb/100 spread, the figure the issue assumed), resolving to
  // +/- 10 bb/100 needs about 38,000 hands, not the 10,000 it budgeted for.
  t.is(handsForPrecision(10, 10), Math.ceil(((1.96 * 10 * 100) / 10) ** 2))
  t.true(handsForPrecision(10, 10) > 38_000)
  // Halving the target quadruples the run, to within the ceiling's rounding.
  t.true(Math.abs(handsForPrecision(10, 5) - handsForPrecision(10, 10) * 4) <= 4)
  t.is(handsForPrecision(0, 10), 0)
  t.is(handsForPrecision(10, 0), Number.POSITIVE_INFINITY)
})

test('importing the harness does not run it', async (t) => {
  // The first draft guarded its CLI on an env var alone, so importing the module
  // started a full eight-room measurement inside the test worker. Nothing about
  // that failure is visible in a diff: the suite just never finishes.
  const file = fileURLToPath(new URL('../scripts/cash-sim.ts', import.meta.url))
  const { stdout, code } = await new Promise<{ stdout: string; code: number | null }>(
    (resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', '-e', `import(${JSON.stringify(file)})`],
        {
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 60_000,
        },
      )
      let out = ''
      child.stdout.on('data', (d) => {
        out += d
      })
      child.on('error', reject)
      child.on('close', (c) => resolve({ stdout: out, code: c }))
    },
  )
  t.is(code, 0)
  t.is(stdout.trim(), '', 'importing the harness printed a table, so it ran the CLI')
})

test('the freezeout harness points a cash table at this one, and does not say it is unbuilt', (t) => {
  // `scripts/sim.ts` blanks its outcome columns for a ring table and prints why.
  // That note said the right measure was "not built" for as long as it was true;
  // this fails the build if it drifts back, or if the file it names goes away.
  const sim = readFileSync(new URL('../scripts/sim.ts', import.meta.url), 'utf-8')
  t.true(sim.includes('cash-sim'), 'sim.ts no longer tells a cash table where to go')
  t.false(/not built/.test(sim), 'sim.ts still says the cash measure is unbuilt')
  t.true(existsSync(new URL('../scripts/cash-sim.ts', import.meta.url)))
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
  t.is(pkg.scripts['cash-sim'], 'tsx scripts/cash-sim.ts')
})

test('10,000 hands at the measured spread does not buy +/- 10 bb/100', (t) => {
  // Stated as the claim rather than the formula, because the claim is what a
  // future run would otherwise re-derive from the issue and get wrong again.
  const s = cashStats({ hands: 10_000, chips: 0, chipsSq: 10_000 * 400 }, 2)
  t.is(s.sdBb, 10)
  t.true(s.ci95 > 15, `10,000 hands buys +/- ${s.ci95.toFixed(1)} bb/100, not +/- 10`)
})
