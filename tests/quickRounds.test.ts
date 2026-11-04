import test from 'ava'
import {
  freeRoundLeft,
  mergeBests,
  mergeFreeRounds,
  recordBest,
  spendFreeRound,
} from '@/lib/quick/rounds'
import { migrateProfile, PERSIST_VERSION } from '@/store/profile'

// Quick games' free round and personal bests (docs/membership.md → "Quick games").
//
// What has to hold: one free round of each game a UTC day, never two; one
// game's round never spends another's; a spent round stays spent across
// devices; tomorrow it comes back; and a best only ever goes up.

const TODAY = '2026-11-04'

test('a player who has never played has today’s round of every game', (t) => {
  t.true(freeRoundLeft(null, 'solitaire', TODAY))
  t.true(freeRoundLeft(undefined, 'solitaire', TODAY))
  t.true(freeRoundLeft({}, 'ten-hands', TODAY))
})

test('spending it records the day, and only once a day', (t) => {
  const spent = spendFreeRound({}, 'solitaire', TODAY)
  t.deepEqual(spent, { solitaire: TODAY })
  t.false(freeRoundLeft(spent, 'solitaire', TODAY))
  t.is(spendFreeRound(spent, 'solitaire', TODAY), null, 'a second round on the same day')
})

test('each game has its own round', (t) => {
  const spent = spendFreeRound({}, 'solitaire', TODAY)
  t.true(freeRoundLeft(spent, 'ten-hands', TODAY))
  const both = spendFreeRound(spent, 'ten-hands', TODAY)
  t.deepEqual(both, { solitaire: TODAY, 'ten-hands': TODAY })
})

test('it comes back on the next UTC day', (t) => {
  const spent = { solitaire: '2026-11-03' }
  t.true(freeRoundLeft(spent, 'solitaire', TODAY))
  t.deepEqual(spendFreeRound(spent, 'solitaire', TODAY), { solitaire: TODAY })
})

test('sync › a round spent on either device stays spent, per game', (t) => {
  const phone = { solitaire: TODAY, 'ten-hands': '2026-11-01' }
  const laptop = { solitaire: '2026-11-02', 'ten-hands': TODAY }
  const merged = mergeFreeRounds(phone, laptop)
  t.deepEqual(merged, { solitaire: TODAY, 'ten-hands': TODAY })
  t.deepEqual(mergeFreeRounds(laptop, phone), merged, 'the order does not matter')
  t.deepEqual(mergeFreeRounds({ solitaire: TODAY }, {}), { solitaire: TODAY })
  t.deepEqual(mergeFreeRounds(undefined, { solitaire: TODAY }), { solitaire: TODAY })
})

test('sync › a malformed record is read as no record, not trusted', (t) => {
  t.deepEqual(mergeFreeRounds({ solitaire: 'tomorrow' }, null), {})
  t.deepEqual(mergeFreeRounds({ solitaire: 7 }, ['x']), {})
  t.deepEqual(mergeFreeRounds({ 'Not An Id!': TODAY }, 'nonsense'), {})
  t.deepEqual(mergeFreeRounds({ solitaire: '2026-01-01' }, { solitaire: 42 }), {
    solitaire: '2026-01-01',
  })
})

test('a best only goes up, and an equal score is not a new best', (t) => {
  const first = recordBest({}, 'solitaire', 120)
  t.deepEqual(first, { solitaire: 120 })
  t.is(recordBest(first, 'solitaire', 90), first, 'a lower score changes nothing')
  t.is(recordBest(first, 'solitaire', 120), first, 'an equal score changes nothing')
  t.deepEqual(recordBest(first, 'solitaire', 300), { solitaire: 300 })
  t.deepEqual(recordBest(first, 'ten-hands', 0), { solitaire: 120, 'ten-hands': 0 })
})

test('a score that is not a whole, non-negative number is ignored', (t) => {
  const bests = { solitaire: 120 }
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -5, 12.5]) {
    t.is(recordBest(bests, 'solitaire', bad), bests, String(bad))
  }
})

test('sync › the higher best stands, per game, whichever side is chosen', (t) => {
  const phone = { solitaire: 410, 'ten-hands': 900 }
  const laptop = { solitaire: 220, 'ten-hands': 2_400 }
  t.deepEqual(mergeBests(phone, laptop), { solitaire: 410, 'ten-hands': 2_400 })
  t.deepEqual(mergeBests(laptop, phone), { solitaire: 410, 'ten-hands': 2_400 })
  t.deepEqual(mergeBests({ solitaire: 'lots' }, { solitaire: -1 }), {})
  t.deepEqual(mergeBests(null, undefined), {})
})

test('a profile from before quick games has no round spent and no best', (t) => {
  t.true(PERSIST_VERSION >= 30)
  const migrated = migrateProfile({ created: true, roll: 500 }, 29) as unknown as Record<
    string,
    unknown
  >
  t.deepEqual(migrated.quickRounds, {})
  t.deepEqual(migrated.quickBests, {})
})
