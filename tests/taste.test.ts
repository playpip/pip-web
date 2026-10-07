import test from 'ava'
import {
  isTasteRecord,
  mergeTaste,
  spendTaste,
  tasteLeft,
  type TasteRecord,
} from '@/lib/membership/taste'
import { migrateProfile, PERSIST_VERSION } from '@/store/profile'

// The daily free member game (docs/membership.md → "One free member game a day").
//
// What has to hold: one a UTC day, never two; a refresh is not a second one;
// a spent game stays spent across devices; and tomorrow it comes back.

const TODAY = '2026-10-07'
const omaha = { kind: 'table', id: 'omaha-low' } as const
const shortdeck = { kind: 'table', id: 'shortdeck-low' } as const

test('a player who has never spent one has today’s', (t) => {
  t.true(tasteLeft(null, TODAY))
  t.true(tasteLeft(undefined, TODAY))
})

test('spending it records the day and the thing, and only once', (t) => {
  const spent = spendTaste(null, TODAY, omaha)
  t.deepEqual(spent, { date: TODAY, kind: 'table', id: 'omaha-low' })
  t.false(tasteLeft(spent, TODAY))
  t.is(spendTaste(spent, TODAY, shortdeck), null, 'a second table on the same day')
})

test('a table is never re-opened by the allowance, even the same table', (t) => {
  // Coming back in after a refresh is the table snapshot's job (PlayClient
  // resumes before it gates). A second sit-down at the same room is a second game.
  const spent = spendTaste(null, TODAY, omaha)
  t.false(tasteLeft(spent, TODAY))
  t.is(spendTaste(spent, TODAY, omaha), null)
})

test('it comes back on the next UTC day', (t) => {
  const yesterday: TasteRecord = { date: '2026-10-06', kind: 'table', id: 'omaha-low' }
  t.true(tasteLeft(yesterday, TODAY))
  t.deepEqual(spendTaste(yesterday, TODAY, shortdeck), {
    date: TODAY,
    kind: 'table',
    id: 'shortdeck-low',
  })
})

test('sync: a spent game stays spent, whichever side it is on', (t) => {
  const spent: TasteRecord = { date: TODAY, kind: 'table', id: 'omaha-low' }
  t.deepEqual(mergeTaste(spent, null), spent)
  t.deepEqual(mergeTaste(null, spent), spent)
  t.deepEqual(mergeTaste(undefined, spent), spent)
})

test('sync: the later day wins, and on the same day the local record stands', (t) => {
  const old: TasteRecord = { date: '2026-10-01', kind: 'table', id: 'shortdeck-low' }
  const now: TasteRecord = { date: TODAY, kind: 'table', id: 'omaha-low' }
  t.deepEqual(mergeTaste(old, now), now)
  t.deepEqual(mergeTaste(now, old), now)
  const other: TasteRecord = { date: TODAY, kind: 'table', id: 'shortdeck-low' }
  t.deepEqual(mergeTaste(now, other), now)
  t.false(tasteLeft(mergeTaste(now, other), TODAY))
})

test('sync: a malformed record from another client is no record', (t) => {
  t.is(mergeTaste({ date: 'tomorrow', kind: 'table', id: 'x' }, null), null)
  t.is(mergeTaste({ date: TODAY, kind: 'drill', id: 'x' }, null), null)
  t.is(mergeTaste('2026-10-07', 7), null)
  t.false(isTasteRecord(null))
  t.false(isTasteRecord({ date: TODAY, kind: 'lesson', id: 'ranges' }), 'lessons are not in it')
})

test('migration: v22 profiles arrive with nothing spent', (t) => {
  const p = migrateProfile({ roll: 1_000, drills: {} }, 22)
  t.is(p.taste, null)
})

test('migration: a current profile keeps what it spent today', (t) => {
  const spent: TasteRecord = { date: TODAY, kind: 'table', id: 'omaha-low' }
  const p = migrateProfile({ roll: 1_000, drills: {}, taste: spent }, PERSIST_VERSION)
  t.deepEqual(p.taste, spent, 'the chain reset the allowance on a current profile')
})
