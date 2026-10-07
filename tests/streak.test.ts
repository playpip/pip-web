// The streak: consecutive UTC days on which the player played poker.
// Pure over day keys, so every midnight here is one we chose.

import test from 'ava'
import { dailyDateKey } from '@/lib/daily'
import {
  daysBetween,
  emptyStreak,
  liveStreak,
  mergeStreaks,
  recordPlay,
  streakAtRisk,
  streakFromDaily,
  type PlayStreak,
} from '@/lib/streak'

const play = (...days: string[]): PlayStreak => days.reduce(recordPlay, emptyStreak())

test('the first play starts a run of one', (t) => {
  t.deepEqual(play('2026-10-01'), { current: 1, best: 1, lastDate: '2026-10-01' })
})

test('consecutive days extend the run', (t) => {
  const s = play('2026-10-01', '2026-10-02', '2026-10-03')
  t.is(s.current, 3)
  t.is(s.best, 3)
  t.is(s.lastDate, '2026-10-03')
})

test('a gap starts over at one and keeps the best', (t) => {
  const s = play('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05')
  t.is(s.current, 1)
  t.is(s.best, 3)
  t.is(s.lastDate, '2026-10-05')
})

test('playing the same day again changes nothing', (t) => {
  const once = play('2026-10-01', '2026-10-02')
  t.is(recordPlay(once, '2026-10-02'), once)
})

test('a date earlier than the last play changes nothing', (t) => {
  const s = play('2026-10-01', '2026-10-02')
  t.is(recordPlay(s, '2026-09-30'), s)
})

test('the run crosses month and year ends', (t) => {
  t.is(play('2026-10-31', '2026-11-01').current, 2)
  t.is(play('2026-12-31', '2027-01-01').current, 2)
  t.is(play('2028-02-28', '2028-02-29', '2028-03-01').current, 3)
})

test('days are UTC days: a minute either side of midnight is two days', (t) => {
  const late = dailyDateKey(new Date('2026-10-01T23:59:00Z'))
  const early = dailyDateKey(new Date('2026-10-02T00:01:00Z'))
  t.is(daysBetween(late, early), 1)
  t.is(play(late, early).current, 2)
  // Both ends of one UTC day are the same day.
  const morning = dailyDateKey(new Date('2026-10-02T00:00:00Z'))
  const night = dailyDateKey(new Date('2026-10-02T23:59:59Z'))
  t.is(play(morning, night).current, 1)
})

test('the live streak survives yesterday and dies the day after', (t) => {
  const s = play('2026-10-01', '2026-10-02')
  t.is(liveStreak(s, '2026-10-02'), 2)
  t.is(liveStreak(s, '2026-10-03'), 2)
  t.is(liveStreak(s, '2026-10-04'), 0)
  t.is(liveStreak(emptyStreak(), '2026-10-04'), 0)
})

test('at risk means yesterday played and today not yet', (t) => {
  const s = play('2026-10-01', '2026-10-02')
  t.false(streakAtRisk(s, '2026-10-02'))
  t.true(streakAtRisk(s, '2026-10-03'))
  t.false(streakAtRisk(s, '2026-10-04'))
  t.false(streakAtRisk(emptyStreak(), '2026-10-03'))
})

test('an old profile with a Daily record starts on a run of one', (t) => {
  t.deepEqual(streakFromDaily({ date: '2026-10-06' }), {
    current: 1,
    best: 1,
    lastDate: '2026-10-06',
  })
  t.deepEqual(streakFromDaily(null), emptyStreak())
  t.deepEqual(streakFromDaily(undefined), emptyStreak())
  // Played yesterday on the old build, plays today: two.
  t.is(recordPlay(streakFromDaily({ date: '2026-10-06' }), '2026-10-07').current, 2)
})

// --- two devices -----------------------------------------------------------

test('merge › an empty side takes the other', (t) => {
  const s = play('2026-10-01', '2026-10-02')
  t.deepEqual(mergeStreaks(emptyStreak(), s), s)
  t.deepEqual(mergeStreaks(s, emptyStreak()), s)
})

test('merge › the same run on both sides is unchanged', (t) => {
  const s = play('2026-10-01', '2026-10-02', '2026-10-03')
  t.deepEqual(mergeStreaks(s, s), s)
})

test('merge › one device ahead of the other keeps the longer run', (t) => {
  const behind = play('2026-10-01', '2026-10-02')
  const ahead = recordPlay(behind, '2026-10-03')
  t.deepEqual(mergeStreaks(behind, ahead), ahead)
  t.deepEqual(mergeStreaks(ahead, behind), ahead)
})

test('merge › runs that touch across devices join up', (t) => {
  // Laptop played 1st-3rd; a phone that never synced played the 4th.
  const laptop = play('2026-10-01', '2026-10-02', '2026-10-03')
  const phone = play('2026-10-04')
  const merged = mergeStreaks(laptop, phone)
  t.is(merged.current, 4)
  t.is(merged.best, 4)
  t.is(merged.lastDate, '2026-10-04')
  t.deepEqual(mergeStreaks(phone, laptop), merged)
})

test('merge › runs with a gap between them keep the later as current', (t) => {
  const old = play('2026-10-01', '2026-10-02', '2026-10-03')
  const fresh = play('2026-10-06')
  const merged = mergeStreaks(old, fresh)
  t.is(merged.current, 1)
  t.is(merged.best, 3)
  t.is(merged.lastDate, '2026-10-06')
})

test('merge › the best of either side is never lost', (t) => {
  const a: PlayStreak = { current: 1, best: 12, lastDate: '2026-10-05' }
  const b: PlayStreak = { current: 2, best: 2, lastDate: '2026-10-06' }
  const merged = mergeStreaks(a, b)
  t.is(merged.best, 12)
  t.is(merged.current, 2)
})
