import { readFileSync } from 'node:fs'
import test from 'ava'
import { DEEP_MIN_HANDS, DEEP_MIN_SHOWDOWNS, type DeepCoachInput, deepRead } from '@/lib/deepCoach'
import { emptySeatStats } from '@/lib/reads'

// Coaching across hands (technology#56).
//
// The two things worth testing here are not the thresholds — those are
// judgement calls and moving one is a decision, not a bug. They are:
//
// 1. **It says nothing until it can say something true.** A confident sentence
//    drawn from eleven hands is worse than a blank screen, and it is the exact
//    failure the odds calculator prints an error bar to avoid.
// 2. **It never turns into a lever.** No streak, no goal, no "come back
//    tomorrow", and no finding whose remedy is "play more". That is the rule
//    lib/drills/rating.ts sets for progress, and this is the surface most
//    likely to erode it.

const input = (over: Partial<DeepCoachInput> = {}): DeepCoachInput => ({
  tendencies: emptySeatStats(),
  stats: {
    handsPlayed: 0,
    handsWon: 0,
    biggestPot: 0,
    showdownsWon: 0,
    tournamentsEntered: 0,
    tournamentsWon: 0,
  },
  venueRecords: {},
  rollHistory: [],
  ...over,
})

/** A player with `hands` hands and whatever tendencies are being tested. */
const played = (hands: number, over: Partial<ReturnType<typeof emptySeatStats>> = {}) => ({
  ...emptySeatStats(),
  handsDealt: hands,
  vpipHands: Math.round(hands * 0.3),
  ...over,
})

test('it says nothing at all until there is enough to say it from', (t) => {
  const quiet = deepRead(input({ tendencies: played(DEEP_MIN_HANDS - 1) }))
  t.deepEqual(quiet.leaks, [])
  t.deepEqual(quiet.strengths, [])
  t.is(quiet.hands, null)
  t.truthy(quiet.waitingFor, 'a paid screen rendered nothing and did not say why')
  t.regex(quiet.waitingFor ?? '', /\d/, 'it does not say how many hands are needed')
})

test('it opens exactly at the minimum, not around it', (t) => {
  t.is(deepRead(input({ tendencies: played(DEEP_MIN_HANDS - 1) })).hands, null)
  t.is(deepRead(input({ tendencies: played(DEEP_MIN_HANDS) })).hands, DEEP_MIN_HANDS)
  t.is(deepRead(input({ tendencies: played(DEEP_MIN_HANDS) })).waitingFor, null)
})

// Each finding carries the count it was drawn from, and it has to be a real
// count rather than a decoration: a sample smaller than its own gate would mean
// the gate is not doing anything.
test('every finding carries the sample it came from', (t) => {
  const read = deepRead(
    input({
      tendencies: played(400, {
        vpipHands: 300,
        raises: 20,
        calls: 200,
        betsFaced: 200,
        foldsToBet: 150,
        showdowns: 60,
      }),
      stats: {
        handsPlayed: 400,
        handsWon: 60,
        biggestPot: 0,
        showdownsWon: 18,
        tournamentsEntered: 20,
        tournamentsWon: 0,
      },
    }),
  )
  t.true(read.leaks.length >= 3, `expected several findings, got ${read.leaks.length}`)
  for (const leak of [...read.leaks, ...read.strengths]) {
    t.true(leak.sample > 0, `${leak.id} reports no sample`)
    t.true(leak.finding.length > 0, `${leak.id} states no number`)
    t.true(leak.advice.length > 0, `${leak.id} says what is wrong and not what to do`)
    t.regex(leak.finding, /\d/, `${leak.id} has no number in its finding`)
  }
})

// The showdown findings have their own gate, because showdowns accrue far more
// slowly than hands and a rate over nine of them is noise.
test('the showdown findings wait for showdowns, not for hands', (t) => {
  const few = deepRead(
    input({
      tendencies: played(400, { showdowns: DEEP_MIN_SHOWDOWNS - 1 }),
      stats: {
        handsPlayed: 400,
        handsWon: 40,
        biggestPot: 0,
        showdownsWon: 0,
        tournamentsEntered: 10,
        tournamentsWon: 0,
      },
    }),
  )
  t.false(
    [...few.leaks, ...few.strengths].some((l) => l.id === 'paying-off'),
    'a showdown finding fired below its own minimum',
  )
})

// Sorting is the whole of the UI's priority, so it is worth pinning: costly
// before watch, and bigger samples first within a severity.
test('the worst finding, best evidenced, comes first', (t) => {
  const read = deepRead(
    input({
      tendencies: played(500, {
        vpipHands: 400,
        raises: 10,
        calls: 300,
        betsFaced: 300,
        foldsToBet: 240,
        showdowns: 60,
      }),
      stats: {
        handsPlayed: 500,
        handsWon: 50,
        biggestPot: 0,
        showdownsWon: 15,
        tournamentsEntered: 30,
        tournamentsWon: 0,
      },
    }),
  )
  const severities = read.leaks.map((l) => l.severity)
  t.is(severities.indexOf('costly'), 0, 'a costly finding is not first')
  const lastCostly = severities.lastIndexOf('costly')
  t.false(severities.slice(0, lastCostly).includes('watch'), 'a watch finding is among the costly')
})

// A table you have entered ten times and never won is arithmetic. Three times
// is not, and must not fire.
test('the table finding needs a real sample before it accuses a table', (t) => {
  const thin = deepRead(
    input({
      tendencies: played(400),
      venueRecords: { garage: { entered: 3, won: 0, bestFinish: 2, fastestWinHands: null } },
    }),
  )
  t.false(
    thin.leaks.some((l) => l.id === 'wrong-table'),
    'three entries was called a pattern',
  )

  const real = deepRead(
    input({
      tendencies: played(400),
      venueRecords: { casino: { entered: 14, won: 0, bestFinish: 3, fastestWinHands: null } },
    }),
  )
  t.true(
    real.leaks.some((l) => l.id === 'wrong-table'),
    'fourteen entries and no win said nothing',
  )
})

// A player doing well gets told so. A report that is only ever a list of faults
// is one nobody opens twice, and it would also be untrue.
test('a sound player is told what is going right', (t) => {
  const read = deepRead(
    input({
      tendencies: played(400, {
        vpipHands: 120,
        raises: 90,
        calls: 110,
        betsFaced: 150,
        foldsToBet: 70,
        showdowns: 50,
      }),
      stats: {
        handsPlayed: 400,
        handsWon: 90,
        biggestPot: 0,
        showdownsWon: 27,
        tournamentsEntered: 20,
        tournamentsWon: 4,
      },
    }),
  )
  t.true(read.strengths.length >= 2, `a sound player got ${read.strengths.length} strengths`)
})

// The rule that matters most, enforced mechanically rather than agreed. Every
// piece of advice has to be something you can do *at a table*, not a reason to
// go and sit at another one.
test('nothing here can be fixed by playing more', (t) => {
  const source = readFileSync(new URL('../src/lib/deepCoach.ts', import.meta.url), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
  for (const pattern of [
    /\bstreak\b/i,
    /\bdaily goal\b/i,
    /come back/i,
    /\bkeep playing\b/i,
    /\bplay more\b/i,
    /\btoday\b/i,
  ]) {
    t.notRegex(source, pattern, `the deep read reads like a lever: ${pattern}`)
  }
})

// The free per-hand read does not grow a paid branch inside it, and this module
// does not reach into it. Both halves of technology#56's standing constraint.
test('the free coach and the paid coach do not touch', (t) => {
  const deep = readFileSync(new URL('../src/lib/deepCoach.ts', import.meta.url), 'utf-8')
  t.notRegex(deep, /from '@\/lib\/coach'/, 'the paid coach imports the free one')

  const free = readFileSync(new URL('../src/lib/coach.ts', import.meta.url), 'utf-8')
  t.notRegex(free, /deepCoach/, 'the free coach knows about the paid one')
  t.notRegex(free, /membersOnly|useEntitlement/, 'the free per-hand read grew a paid branch')
})
