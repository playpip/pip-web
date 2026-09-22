// The session-volume harness (technology#56).
//
// This harness exists to answer one question: how many tournaments does a
// player have to play before a rate drawn from their profile means anything.
// Its answer is only worth quoting if its tally is the same tally
// `store/game.ts` keeps, so that is what this file checks.
//
// **It cannot check that by running the store.** There is no browser here and
// the store is not testable without one, which is exactly why the harness
// re-implements the arithmetic rather than calling it. So the check is the next
// best thing and it is stated honestly: the *shape* is pinned against
// `SeatStats` so a counter added to the product cannot be silently missing
// here, and the *relationships* between counters, which are what the
// re-implementation could get wrong, are asserted against real hands.
//
// No assertion here is statistical. A rate off a handful of tournaments cannot
// distinguish a correct harness from a broken one, so asserting on one would be
// a test that passes whatever the code does (see tests/cashSim.test.ts for the
// same argument at more length).

import test from 'ava'
import {
  HERO_ID,
  HEROES,
  OBS_FOR_5_POINTS,
  runsFor5,
  runTournament,
} from '../scripts/session-volume'
import { mulberry32 } from '@/lib/poker/cards'
import { emptySeatStats, type SeatStats } from '@/lib/reads'
import { type Venue, venueById } from '@/config/venues'

const garage = venueById('garage') as Venue
const hero = HEROES.casual
const rngFor = (seed: number) => mulberry32((seed * 1_000_003 + 7) >>> 0)

/** A handful of real runs, reused by every assertion below. */
const runs: SeatStats[] = [0, 1, 2, 3].map((s) => runTournament(garage, hero, rngFor(s)))

test('the tally has exactly the counters SeatStats has, no more and no fewer', (t) => {
  const expected = Object.keys(emptySeatStats()).sort()
  for (const run of runs) t.deepEqual(Object.keys(run).sort(), expected)
})

test('VPIP is counted once per hand, so it can never exceed hands dealt', (t) => {
  for (const run of runs) {
    t.true(
      run.vpipHands <= run.handsDealt,
      `vpipHands ${run.vpipHands} > handsDealt ${run.handsDealt}: the once-per-hand guard is gone`,
    )
  }
})

test('a fold to a bet is a subset of the bets faced', (t) => {
  for (const run of runs) t.true(run.foldsToBet <= run.betsFaced)
})

test('showdowns cannot outnumber the hands they happened in', (t) => {
  for (const run of runs) t.true(run.showdowns <= run.handsDealt)
})

test('every run deals the hero in, and ends', (t) => {
  for (const run of runs) {
    t.true(run.handsDealt > 0, 'a run dealt the hero no hands at all')
    t.true(run.handsDealt < 2000, 'a run hit the hand cap, so it never resolved')
  }
})

test('the hero is the seat being tallied, not the table', (t) => {
  // Three seats play every hand, so a tally that had drifted onto the whole
  // table would show roughly three times the actions. `betsFaced` is the
  // loosest of the counters and still cannot exceed a few per hand per seat.
  for (const run of runs) {
    t.true(
      run.raises + run.calls <= run.handsDealt * 8,
      'the action count is table-sized, so the harness is tallying more than the hero',
    )
  }
  t.is(HERO_ID, 'hero')
})

test('the same seed gives the same run', (t) => {
  t.deepEqual(runTournament(garage, hero, rngFor(0)), runs[0])
})

test('different seeds give different runs', (t) => {
  t.notDeepEqual(runs[0], runs[1])
})

test('runsFor5 divides the observation budget by what a run deposits', (t) => {
  t.is(runsFor5(OBS_FOR_5_POINTS), 1)
  t.is(runsFor5(OBS_FOR_5_POINTS / 2), 2)
  // Rounds up: a part run is not a run.
  t.is(runsFor5(OBS_FOR_5_POINTS / 2 + 1), 2)
  t.is(runsFor5(OBS_FOR_5_POINTS - 1), 2)
  t.is(runsFor5(0), Number.POSITIVE_INFINITY)
})

test('the observation budget is the one the 95% interval actually implies', (t) => {
  // 1.96 * sqrt(0.25 / n) = 0.05  ->  n = 384.16, and a budget rounds up, so
  // 385. The obvious 384 fails this by four ten-thousandths of a point, which
  // is why the check is arithmetic here rather than a comment on the constant.
  const halfWidth = 1.96 * Math.sqrt(0.25 / OBS_FOR_5_POINTS)
  t.true(
    halfWidth <= 0.05,
    `OBS_FOR_5_POINTS buys +/-${(halfWidth * 100).toFixed(2)} points, which is wider than the five it claims`,
  )
})
