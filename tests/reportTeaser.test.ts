import { readFileSync } from 'node:fs'
import test from 'ava'
import { DEEP_MIN_HANDS, type DeepCoachInput, deepRead } from '@/lib/deepCoach'
import { emptySeatStats } from '@/lib/reads'
import { TEASABLE_LEAKS, reportTeaser } from '@/lib/review/teaser'

// The report teaser on the end-of-run card: one real line of the paid report.
//
// The rule is "never fabricate". It is the report's own top finding or nothing,
// it carries the report's own sample, and the unit it names is the thing that
// sample actually counted.

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

test('nothing below the report’s own minimum', (t) => {
  const tendencies = { ...emptySeatStats(), handsDealt: DEEP_MIN_HANDS - 1, vpipHands: 110 }
  t.is(reportTeaser(deepRead(input({ tendencies }))), null)
})

test('nothing when the report has no finding, even with the hands', (t) => {
  // A sound player: entering 30%, nothing else counted far enough to say.
  const tendencies = { ...emptySeatStats(), handsDealt: 400, vpipHands: 120 }
  const read = deepRead(input({ tendencies }))
  t.deepEqual(read.leaks, [])
  t.is(reportTeaser(read), null)
})

test('it is the report’s top finding, with the report’s sample', (t) => {
  const tendencies = { ...emptySeatStats(), handsDealt: 340, vpipHands: 260 }
  const read = deepRead(input({ tendencies }))
  const teaser = reportTeaser(read)
  t.truthy(teaser)
  t.is(teaser?.title, read.leaks[0].title)
  t.is(teaser?.sample, read.leaks[0].sample)
  t.is(teaser?.sample, 340)
  t.is(teaser?.unit, 'hands')
})

test('a finding drawn from showdowns is not described as hands', (t) => {
  const tendencies = {
    ...emptySeatStats(),
    handsDealt: 400,
    vpipHands: 120,
    showdowns: 60,
  }
  const stats = { ...input().stats, showdownsWon: 10 }
  const read = deepRead(input({ tendencies, stats }))
  const top = read.leaks[0]
  t.is(top?.id, 'paying-off')
  t.is(reportTeaser(read)?.unit, 'showdowns')
  t.is(reportTeaser(read)?.sample, 60)
})

test('every leak the report can produce has a unit, or the teaser could not name it', (t) => {
  const source = readFileSync(new URL('../src/lib/deepCoach.ts', import.meta.url), 'utf-8')
  const ids = [...source.matchAll(/leaks\.push\(\{\s*id: '([^']+)'/g)].map((m) => m[1])
  t.true(ids.length > 8, `found ${ids.length} leak ids, which is too few to mean anything`)
  for (const id of ids)
    t.true(TEASABLE_LEAKS.includes(id), `${id} has no unit in lib/review/teaser`)
  for (const street of ['preflop', 'flop', 'turn', 'river']) {
    t.true(TEASABLE_LEAKS.includes(`leaky-${street}`))
  }
})
