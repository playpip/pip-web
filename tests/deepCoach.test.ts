import { readFileSync } from 'node:fs'
import test from 'ava'
import {
  BANDS,
  DEEP_MIN_HANDS,
  DEEP_MIN_SHOWDOWNS,
  type DeepCoachInput,
  deepRead,
} from '@/lib/deepCoach'
import { emptySeatStats } from '@/lib/reads'
import { emptyReviewStats } from '@/lib/review/stats'

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

// --- where the money goes ---------------------------------------------------

test('the street that is costing you is named, with the decisions behind it', (t) => {
  const stats = emptyReviewStats()
  stats.hands = 600
  // 18 big blinds given up on the river over 600 hands — 3bb/100, and a real
  // sample under it. The flop is quiet.
  stats.byStreet.river = { priced: 70, right: 30, bbLost: 18 }
  stats.byStreet.flop = { priced: 90, right: 80, bbLost: 1 }
  stats.calls = { priced: 120, right: 70, bbLost: 17 }
  stats.folds = { priced: 40, right: 32, bbLost: 2 }

  const read = deepRead(input({ tendencies: played(600), reviewStats: stats }))
  const leak = read.leaks.find((l) => l.id === 'leaky-river')
  t.truthy(leak, 'the worst street was not named')
  t.regex(leak?.finding ?? '', /3\.0 big blinds per hundred hands/)
  t.regex(leak?.finding ?? '', /70 priced decisions/, 'a finding arrived without its sample')
  t.is(read.streets[0]?.settled, 70)
  t.is(leak?.evidence, 'river-call', 'the river finding cannot show a river hand')

  // The chart reads the same numbers, worst first.
  t.is(read.streets[0]?.street, 'river')
  t.is(read.cost?.right, 102)
  t.is(read.cost?.wrong, 58)
})

test('a street with almost no decisions behind it is never named', (t) => {
  // Four big blinds off nine calls is 0.7bb/100 and means nothing. The rule is
  // the same one the whole file runs on: no claim below its own sample.
  const stats = emptyReviewStats()
  stats.hands = 600
  stats.byStreet.turn = { priced: 9, right: 4, bbLost: 4 }
  const read = deepRead(input({ tendencies: played(600), reviewStats: stats }))
  t.falsy(read.leaks.find((l) => l.id.startsWith('leaky-')))
  t.deepEqual(read.streets, [])
})

test('which way the mistakes go is a finding of its own', (t) => {
  const loose = emptyReviewStats()
  loose.hands = 700
  loose.calls = { priced: 120, right: 60, bbLost: 40 }
  loose.folds = { priced: 60, right: 55, bbLost: 3 }
  const callsRead = deepRead(input({ tendencies: played(700), reviewStats: loose }))
  t.truthy(callsRead.leaks.find((l) => l.id === 'costly-calls'))
  t.falsy(callsRead.leaks.find((l) => l.id === 'costly-folds'))

  const tight = emptyReviewStats()
  tight.hands = 700
  tight.calls = { priced: 60, right: 55, bbLost: 3 }
  tight.folds = { priced: 120, right: 60, bbLost: 40 }
  const foldsRead = deepRead(input({ tendencies: played(700), reviewStats: tight }))
  t.truthy(foldsRead.leaks.find((l) => l.id === 'costly-folds'))
})

test('a profile with no priced decisions still gets a report', (t) => {
  // Everything about the table of decisions is optional: a row synced from a
  // device that predates it, or a player whose hands were all at tables the
  // review does not cover. The rate-based findings still work.
  const read = deepRead(input({ tendencies: played(400, { vpipHands: 300 }) }))
  t.is(read.cost, null)
  t.deepEqual(read.streets, [])
  t.truthy(read.leaks.find((l) => l.id === 'too-loose'))
})

test('every meter is drawn from the same band the verdict was reached on', (t) => {
  // The failure this prevents: a component with its own idea of "healthy",
  // drawing a marker inside a green band under a sentence calling it a leak.
  const read = deepRead(input({ tendencies: played(400, { vpipHands: 300 }) }))
  const loose = read.leaks.find((l) => l.id === 'too-loose')
  t.truthy(loose?.metric)
  t.deepEqual(loose?.metric?.band, BANDS.vpip.band)
  t.true((loose?.metric?.value ?? 0) > BANDS.vpip.band[1], 'the marker sits inside the band')
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

// technology#56's standing constraint, stated as the property it protects
// rather than as the import graph that used to stand in for it.
//
// The old version of this test said the paid module must not import the free
// one at all. It does now — for `PricedStreet`, because there is one set of
// four streets and two spellings of it would be worse — so the test says the
// thing that actually matters instead: **the free read cannot know who is
// paying, and cannot be given behaviour by the paid one.** A type is erased at
// build time and can carry neither.
test('the free per-hand read cannot tell a member from anybody else', (t) => {
  // Imports only — the prose in there is allowed to name the paid surfaces, and
  // does, because a rule is easier to keep when the file says what it is for.
  const free = readFileSync(new URL('../src/lib/coach.ts', import.meta.url), 'utf-8')
  for (const line of free.split('\n')) {
    if (!/^import /.test(line)) continue
    t.notRegex(line, /deepCoach|lib\/review/, 'the free coach reached into a paid module')
    t.notRegex(line, /membership|entitlement/i, 'the free per-hand read can see who is paying')
  }
  t.notRegex(
    free.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' '),
    /membersOnly|useEntitlement/,
    'the free per-hand read grew a paid branch',
  )

  const deep = readFileSync(new URL('../src/lib/deepCoach.ts', import.meta.url), 'utf-8')
  for (const line of deep.split('\n')) {
    if (!line.includes("from '@/lib/coach'")) continue
    t.regex(
      line,
      /^import type /,
      'the paid coach imports behaviour from the free read, not just a type',
    )
  }
})
