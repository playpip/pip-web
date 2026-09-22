// The session log (technology#56).
//
// Two things are being defended here and they are different sizes.
//
// **The merge, which can lose a player's history.** `mergeSessions` is the one
// field in the profile where the merge policy's fallback would have deleted
// data rather than picked a defensible side: a session row is a finished run,
// and the other device has no opinion about an evening it was not there for.
// Two devices played offline is the case, and it is the case that has to be
// exercised rather than argued about.
//
// **The clock, which can turn a mirror into a nag.** This is the first module
// in the product that carries a timestamp. The drills layer is forbidden a
// clock by a test (tests/drills) and the recap holds the same line in prose;
// this is the mechanical version for sessions. `t` may order and group. The
// moment something in here compares it with now, the product can tell somebody
// they have not played since Tuesday.

import { readFileSync } from 'node:fs'
import test from 'ava'
import { appendSession, mergeSessions, SESSION_CAP, type SessionRow } from '@/lib/sessions'
import { mergeProfiles, type ProfileData, isPristine } from '@/lib/sync/merge'
import { migrateProfile, PERSIST_VERSION } from '@/store/profile'
import { emptySeatStats } from '@/lib/reads'
import { STARTING_ROLL } from '@/config/venues'

const row = (t: number, venueId = 'garage'): SessionRow => ({
  t,
  venueId,
  place: 2,
  seats: 3,
  hands: 40,
  rollDelta: -100,
  stats: { ...emptySeatStats(), handsDealt: 40, vpipHands: 18 },
})

// --- the log itself ----------------------------------------------------------

test('a finished run lands at the end of the log', (t) => {
  const log = appendSession(appendSession([], row(1)), row(2))
  t.deepEqual(
    log.map((r) => r.t),
    [1, 2],
  )
})

test('appending to a profile that has never had a log works', (t) => {
  t.is(appendSession(undefined, row(1)).length, 1)
})

test('the log is capped, and it is the oldest rows that go', (t) => {
  let log: SessionRow[] = []
  for (let i = 0; i < SESSION_CAP + 25; i++) log = appendSession(log, row(i))
  t.is(log.length, SESSION_CAP)
  t.is(log[0].t, 25, 'the cap took from the wrong end')
  t.is(log[log.length - 1].t, SESSION_CAP + 24)
})

test('a row that arrives out of order is put back in order', (t) => {
  const log = appendSession(appendSession([], row(10)), row(5))
  t.deepEqual(
    log.map((r) => r.t),
    [5, 10],
  )
})

// --- the merge ---------------------------------------------------------------

test('two devices that both played keep both evenings', (t) => {
  const phone = [row(1), row(3), row(5)]
  const laptop = [row(2), row(4)]
  t.deepEqual(
    mergeSessions(phone, laptop).map((r) => r.t),
    [1, 2, 3, 4, 5],
  )
})

test('the merge is the same whichever device asks', (t) => {
  const phone = [row(1), row(3)]
  const laptop = [row(2), row(4)]
  t.deepEqual(mergeSessions(phone, laptop), mergeSessions(laptop, phone))
})

test('a device with no log at all takes the other side whole', (t) => {
  const laptop = [row(1), row(2)]
  t.deepEqual(mergeSessions(undefined, laptop), laptop)
  t.deepEqual(mergeSessions([], laptop), laptop)
  t.deepEqual(mergeSessions(laptop, undefined), laptop)
})

test('merging is idempotent, so a repeated sync does not double the history', (t) => {
  const phone = [row(1), row(3)]
  const laptop = [row(2)]
  const once = mergeSessions(phone, laptop)
  t.deepEqual(mergeSessions(once, laptop), once)
  t.deepEqual(mergeSessions(once, once), once)
})

test('a collision on the millisecond keeps one row rather than inventing one', (t) => {
  const mine = row(7, 'garage')
  const theirs = row(7, 'pub')
  const merged = mergeSessions([mine], [theirs])
  t.is(merged.length, 1)
  t.is(merged[0].venueId, 'garage', 'local should win a tie, not a blend of the two')
})

test('the merged log is capped too', (t) => {
  const a = Array.from({ length: SESSION_CAP }, (_, i) => row(i * 2))
  const b = Array.from({ length: SESSION_CAP }, (_, i) => row(i * 2 + 1))
  t.is(mergeSessions(a, b).length, SESSION_CAP)
})

// --- the policy it sits inside ----------------------------------------------

/** Onboarding and nothing else, matching the fixture in tests/syncMerge. */
const profile = (over: Partial<ProfileData> = {}): ProfileData =>
  ({
    created: true,
    name: 'Player',
    roll: STARTING_ROLL,
    peakRoll: STARTING_ROLL,
    stats: {
      handsPlayed: 0,
      handsWon: 0,
      biggestPot: 0,
      showdownsWon: 0,
      tournamentsEntered: 0,
      tournamentsWon: 0,
    },
    rollHistory: [{ t: 9_999, roll: STARTING_ROLL }],
    venueRecords: {},
    tendencies: emptySeatStats(),
    awards: {},
    castRecords: {},
    daily: null,
    owned: [],
    challengeWins: [],
    challengesPlayed: 0,
    drills: {},
    sessions: [],
    ...over,
  }) as ProfileData

test('mergeProfiles unions the log rather than following the winning side', (t) => {
  const local = profile({ sessions: [row(1), row(3)] })
  const remote = profile({ sessions: [row(2)] })
  for (const side of ['local', 'remote'] as const) {
    t.deepEqual(
      mergeProfiles(local, remote, side).sessions.map((r) => r.t),
      [1, 2, 3],
      `side=${side} lost a session`,
    )
  }
})

test('a profile with a session in it is not pristine', (t) => {
  const p = profile()
  t.true(isPristine(p))
  t.false(isPristine({ ...p, sessions: [row(1)] }))
})

// --- the migration -----------------------------------------------------------

test('an old profile arrives with an empty log rather than undefined', (t) => {
  for (const from of [11, 15, 16, 17]) {
    const migrated = migrateProfile({ rollHistory: [{ t: 1, roll: 5_000 }] }, from)
    t.deepEqual(migrated.sessions, [], `v${from} did not get a session log`)
  }
})

test('the log is part of version 18', (t) => {
  t.true(PERSIST_VERSION >= 18)
})

// --- the clock ---------------------------------------------------------------

test('lib/sessions cannot read the clock', (t) => {
  const source = readFileSync(new URL('../src/lib/sessions.ts', import.meta.url), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
  t.notRegex(source, /\bDate\b|\bperformance\.now\b/, 'lib/sessions reads the clock')
  // The vocabulary a nag would need. `t` orders rows; it does not measure a gap.
  t.notRegex(
    source,
    /\b(streak|daysSince|lastPlayed|sinceLast|today|yesterday|overdue)\b/i,
    'lib/sessions has grown the vocabulary of a thing you can be behind on',
  )
})
