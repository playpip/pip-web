import test from 'ava'
import { DEEP_MIN_HANDS, type DeepCoachInput, deepRead } from '@/lib/deepCoach'
import {
  FREE_REPORT_COPY,
  freeReportState,
  isFreeReportRecord,
  mergeFreeReport,
  openFreeReport,
  reportHasSomethingToSay,
} from '@/lib/membership/freeReport'
import { emptySeatStats } from '@/lib/reads'
import { migrateProfile, PERSIST_VERSION } from '@/store/profile'

// One full report, free, once (docs/membership.md → "One free report").
//
// What has to hold: it is never offered before the report has something to
// say; it is opened by a tap, once; it stays open for the day it was opened
// and locks after; and a second device can neither hand it back nor stretch it.

const TODAY = '2026-11-02'
const TOMORROW = '2026-11-03'

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

/** A loose player with enough hands: the report has a finding. */
const full = deepRead(
  input({ tendencies: { ...emptySeatStats(), handsDealt: 340, vpipHands: 260 } }),
)

test('not offered before the report opens', (t) => {
  const read = deepRead(
    input({ tendencies: { ...emptySeatStats(), handsDealt: DEEP_MIN_HANDS - 1, vpipHands: 110 } }),
  )
  t.false(reportHasSomethingToSay(read))
  t.is(freeReportState(null, TODAY, read), 'waiting')
  t.is(openFreeReport(null, TODAY, read), null)
})

test('not offered on a report with nothing in it, even with the hands', (t) => {
  // A sound player: entering 30%, nothing else counted far enough to say.
  const read = deepRead(
    input({ tendencies: { ...emptySeatStats(), handsDealt: 400, vpipHands: 120 } }),
  )
  t.deepEqual(read.leaks, [])
  t.is(read.cost, null)
  t.is(freeReportState(null, TODAY, read), 'waiting')
})

test('ready once the report has a finding, and opened by the tap', (t) => {
  t.true(full.leaks.length > 0)
  t.is(freeReportState(null, TODAY, full), 'ready')
  const opened = openFreeReport(null, TODAY, full)
  t.deepEqual(opened, { date: TODAY })
  t.is(freeReportState(opened, TODAY, full), 'open')
})

test('opening it again the same day is the same report, not a second one', (t) => {
  const opened = { date: TODAY }
  t.is(openFreeReport(opened, TODAY, full), opened)
})

test('it locks the next day, for good', (t) => {
  const opened = { date: TODAY }
  t.is(freeReportState(opened, TOMORROW, full), 'used')
  t.is(openFreeReport(opened, TOMORROW, full), null)
  t.is(freeReportState(opened, '2027-06-01', full), 'used')
})

test('a second device cannot hand it back or stretch it', (t) => {
  const early = { date: TODAY }
  const late = { date: TOMORROW }
  t.is(mergeFreeReport(early, null), early)
  t.is(mergeFreeReport(null, early), early)
  t.is(mergeFreeReport(early, late), early)
  t.is(mergeFreeReport(late, early), early)
  t.is(mergeFreeReport(null, null), null)
  t.is(mergeFreeReport({ date: 'yesterday' }, null), null, 'a malformed record is no record')
})

test('only a well-formed record counts', (t) => {
  t.true(isFreeReportRecord({ date: TODAY }))
  t.false(isFreeReportRecord({ date: 20261102 }))
  t.false(isFreeReportRecord(null))
  t.false(isFreeReportRecord('2026-11-02'))
})

test('a profile from before it existed has never opened one', (t) => {
  t.true(PERSIST_VERSION >= 29)
  const old = migrateProfile({ freeReport: undefined } as never, 28) as { freeReport: unknown }
  t.is(old.freeReport, null)
})

test('the copy names the report’s own minimum and no em-dash', (t) => {
  t.true(FREE_REPORT_COPY.offer.includes(String(DEEP_MIN_HANDS)))
  for (const line of Object.values(FREE_REPORT_COPY)) t.false(line.includes('—'), line)
})
