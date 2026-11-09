import test from 'ava'
import { weekIndex, weekVisit } from '@/lib/returning'

const at = (iso: string) => Date.parse(iso)

test('weeks run Monday to Sunday, UTC', (t) => {
  // Monday 2 November 2026 to Sunday 8 November 2026 is one week.
  const monday = weekIndex(at('2026-11-02T00:00:00Z'))
  t.is(weekIndex(at('2026-11-08T23:59:59Z')), monday)
  t.is(weekIndex(at('2026-11-01T23:59:59Z')), monday - 1)
  t.is(weekIndex(at('2026-11-09T00:00:00Z')), monday + 1)
  // The epoch was a Thursday, in the same week as Monday 29 December 1969.
  t.is(weekIndex(at('1969-12-29T00:00:00Z')), 0)
  t.is(weekIndex(0), 0)
  t.is(weekIndex(at('1970-01-05T00:00:00Z')), 1)
})

test('a first ever hand counts the week and nothing else', (t) => {
  t.deepEqual(weekVisit(null, 100), { firstThisWeek: true, again: false, keep: 100 })
})

test('a second hand in the same week counts nothing', (t) => {
  t.deepEqual(weekVisit(100, 100), { firstThisWeek: false, again: false, keep: 100 })
})

test('playing the week after counts a return', (t) => {
  t.deepEqual(weekVisit(99, 100), { firstThisWeek: true, again: true, keep: 100 })
})

test('a gap of a week or more is a new week, not a return', (t) => {
  t.deepEqual(weekVisit(98, 100), { firstThisWeek: true, again: false, keep: 100 })
  t.deepEqual(weekVisit(3, 100), { firstThisWeek: true, again: false, keep: 100 })
})

test('a clock set back sends nothing and keeps the later week', (t) => {
  t.deepEqual(weekVisit(101, 100), { firstThisWeek: false, again: false, keep: 101 })
})
