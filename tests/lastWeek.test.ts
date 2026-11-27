import { readFileSync } from 'node:fs'
import test from 'ava'
import { SHOWS_FROM, addHand, lastWeekLine, lastWeekOf, type WeekTally } from '@/lib/lastWeek'

const at = (iso: string) => Date.parse(iso)

/** Play `n` hands at each of the given times. */
function play(times: string[], n = 1, start: WeekTally | null = null): WeekTally | null {
  let t = start
  for (const iso of times) for (let i = 0; i < n; i++) t = addHand(t, at(iso))
  return t
}

test('launches on Monday 7 December 2026, UTC', (t) => {
  t.is(SHOWS_FROM, at('2026-12-07T00:00:00Z'))
})

test('says hands and days from last week', (t) => {
  // Monday, Tuesday, Tuesday again, and Sunday of the week of 30 November.
  const tally = play(
    [
      '2026-11-30T09:00:00Z',
      '2026-12-01T09:00:00Z',
      '2026-12-01T22:00:00Z',
      '2026-12-06T23:59:59Z',
    ],
    78,
  )
  t.is(lastWeekLine(tally, at('2026-12-07T08:00:00Z')), 'Last week: 312 hands over 3 days.')
})

test('stays put once this week starts counting', (t) => {
  const before = play(['2026-12-02T12:00:00Z'], 5)
  const after = play(['2026-12-07T10:00:00Z', '2026-12-08T10:00:00Z'], 3, before)
  t.deepEqual(lastWeekOf(after, at('2026-12-09T10:00:00Z')), { hands: 5, days: 1 << 2 })
  t.is(lastWeekLine(after, at('2026-12-09T10:00:00Z')), 'Last week: 5 hands over 1 day.')
})

test('singular for one hand on one day', (t) => {
  const tally = play(['2026-12-03T12:00:00Z'])
  t.is(lastWeekLine(tally, at('2026-12-08T12:00:00Z')), 'Last week: 1 hand over 1 day.')
})

test('large counts get a thousands separator', (t) => {
  const tally = play(['2026-12-03T12:00:00Z'], 1312)
  t.is(lastWeekLine(tally, at('2026-12-08T12:00:00Z')), 'Last week: 1,312 hands over 1 day.')
})

test('nothing before launch', (t) => {
  const tally = play(['2026-11-24T12:00:00Z'], 10)
  t.is(lastWeekLine(tally, at('2026-12-06T23:59:59Z')), null)
  t.truthy(lastWeekOf(tally, at('2026-12-01T12:00:00Z')))
})

test('nothing for a player who skipped last week', (t) => {
  const tally = play(['2026-11-24T12:00:00Z'], 10)
  t.is(lastWeekLine(tally, at('2026-12-08T12:00:00Z')), null)
  // Playing this week does not bring back a week that was not last week.
  t.is(lastWeekLine(play(['2026-12-08T12:00:00Z'], 1, tally), at('2026-12-08T13:00:00Z')), null)
})

test('nothing with no tally', (t) => {
  t.is(lastWeekLine(null, at('2026-12-08T12:00:00Z')), null)
})

test('gone when the week turns', (t) => {
  const tally = play(['2026-12-03T12:00:00Z'], 4)
  t.truthy(lastWeekLine(tally, at('2026-12-13T23:59:59Z')))
  t.is(lastWeekLine(tally, at('2026-12-14T00:00:00Z')), null)
})

test('a clock set back counts nothing and keeps the later week', (t) => {
  const tally = play(['2026-12-08T12:00:00Z'], 2)
  t.deepEqual(addHand(tally, at('2026-12-01T12:00:00Z')), tally)
})

test('both stores count a hand', (t) => {
  const read = (f: string) => readFileSync(new URL(`../src/store/${f}`, import.meta.url), 'utf-8')
  t.regex(read('room.ts'), /if \(roomHandToCount\(prev, view\)\) noteHandThisWeek\(\)/)
  t.regex(read('game.ts'), /if \(get\(\)\.status !== 'watching'\) noteHandThisWeek\(\)/)
})
