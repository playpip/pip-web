import test from 'ava'
import {
  ROLL_RANGES,
  TREND_MARGIN,
  pointsInRange,
  rangeHasEnough,
  rollTrend,
} from '@/lib/rollRange'
import type { RollPoint } from '@/store/profile'

// The span picker under the Roll graph. Both halves are pure and both are read
// by two screens plus the report's sentence, which is the whole reason they are
// here rather than inside a component: a picker that showed the last week while
// the line above it described a year would be worse than no picker at all.

const DAY = 86_400_000
const NOW = 1_800_000_000_000

const range = (id: string) => {
  const found = ROLL_RANGES.find((r) => r.id === id)
  if (!found) throw new Error(`no range ${id}`)
  return found
}

/** A point `daysAgo` before NOW. */
const at = (daysAgo: number, roll: number): RollPoint => ({ t: NOW - daysAgo * DAY, roll })

test('a span keeps the points inside it and nothing else', (t) => {
  const points = [at(120, 100), at(45, 200), at(20, 300), at(3, 400)]
  t.deepEqual(
    pointsInRange(points, range('7d'), NOW).map((p) => p.roll),
    [400],
  )
  t.deepEqual(
    pointsInRange(points, range('30d'), NOW).map((p) => p.roll),
    [300, 400],
  )
  t.deepEqual(
    pointsInRange(points, range('90d'), NOW).map((p) => p.roll),
    [200, 300, 400],
  )
  t.is(pointsInRange(points, range('all'), NOW).length, 4)
})

test('the boundary is inclusive, and nothing is invented on it', (t) => {
  // A point exactly 7 days old is inside "7 days". A span that began mid-gap
  // starts at the first real result, never at a Roll the player never had.
  const points = [at(9, 100), at(7, 200)]
  const week = pointsInRange(points, range('7d'), NOW)
  t.deepEqual(
    week.map((p) => p.roll),
    [200],
  )
})

test('all time is everything, and it is a copy', (t) => {
  const points = [at(5, 100)]
  const all = pointsInRange(points, range('all'), NOW)
  all.push(at(1, 999))
  t.is(points.length, 1, 'the caller mutated the profile through the range helper')
})

test('a span that cannot draw a line is not offered', (t) => {
  // One point is not a line, and an empty span is not a chart.
  const points = [at(40, 100), at(2, 200)]
  t.false(rangeHasEnough(points, range('7d'), NOW), 'one point was offered as a span')
  t.true(rangeHasEnough(points, range('90d'), NOW))
  t.true(rangeHasEnough(points, range('all'), NOW))
})

// --- which way it went ------------------------------------------------------

test('the trend compares halves, and sits still inside the noise', (t) => {
  const flat = [at(9, 1_000), at(7, 1_010), at(5, 990), at(3, 1_000)]
  t.is(rollTrend(flat), 'level')

  const climbing = [at(9, 1_000), at(7, 1_000), at(5, 2_000), at(3, 2_000)]
  t.is(rollTrend(climbing), 'up')

  const sliding = [at(9, 2_000), at(7, 2_000), at(5, 1_000), at(3, 1_000)]
  t.is(rollTrend(sliding), 'down')
})

test('the margin is what decides it, exactly', (t) => {
  // A second half exactly on the margin is not yet a direction — the rule is
  // "more than", so the boundary reads as level rather than flipping on a
  // rounding error.
  const before = 1_000
  const onTheLine = [at(4, before), at(3, before * (1 + TREND_MARGIN))]
  t.is(rollTrend(onTheLine), 'level')
  const past = [at(4, before), at(3, before * (1 + TREND_MARGIN) + 1)]
  t.is(rollTrend(past), 'up')
})

test('a span too short to have a direction has none', (t) => {
  t.is(rollTrend([]), 'level')
  t.is(rollTrend([at(1, 500)]), 'level')
})
