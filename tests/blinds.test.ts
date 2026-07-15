import test from 'ava'
import { blindLevel, blindsAt, HANDS_PER_LEVEL, LEVEL_MULTIPLIERS } from '@/config/blinds'

test('level 0 for the first HANDS_PER_LEVEL hands', (t) => {
  t.is(blindLevel(0), 0)
  t.is(blindLevel(HANDS_PER_LEVEL - 1), 0)
})

test('level rises by one every HANDS_PER_LEVEL hands', (t) => {
  t.is(blindLevel(HANDS_PER_LEVEL), 1)
  t.is(blindLevel(2 * HANDS_PER_LEVEL), 2)
  t.is(blindLevel(3 * HANDS_PER_LEVEL - 1), 2)
})

test('level caps at the last multiplier', (t) => {
  const last = LEVEL_MULTIPLIERS.length - 1
  t.is(blindLevel(1_000 * HANDS_PER_LEVEL), last)
})

test('negative hand indexes clamp to level 0', (t) => {
  t.is(blindLevel(-5), 0)
})

test('blindsAt scales the venue base blinds by the level multiplier', (t) => {
  const base = { smallBlind: 5, bigBlind: 10 }
  t.deepEqual(blindsAt(base, 0), { smallBlind: 5, bigBlind: 10, level: 0 })
  const l1 = blindsAt(base, HANDS_PER_LEVEL)
  t.deepEqual(l1, {
    smallBlind: 5 * LEVEL_MULTIPLIERS[1],
    bigBlind: 10 * LEVEL_MULTIPLIERS[1],
    level: 1,
  })
})

test('blinds stay integers for every venue-style base', (t) => {
  const bases = [1, 3, 5, 15, 25, 75, 200, 500, 1_500, 5_000]
  for (const sb of bases) {
    for (let hand = 0; hand < 100; hand++) {
      const b = blindsAt({ smallBlind: sb, bigBlind: sb * 2 }, hand)
      t.true(Number.isInteger(b.smallBlind))
      t.true(Number.isInteger(b.bigBlind))
      t.is(b.bigBlind, b.smallBlind * 2)
    }
  }
})

test('per-venue handsPerLevel overrides the escalation pace', (t) => {
  t.is(blindLevel(3, 3), 1) // turbo: level up every 3 hands
  t.is(blindLevel(8, 3), 2)
  t.is(blindLevel(8, 9), 0) // deep: still level 0 on hand 9's eve
  const turbo = blindsAt({ smallBlind: 5, bigBlind: 10, handsPerLevel: 3 }, 3)
  t.deepEqual(turbo, {
    smallBlind: 5 * LEVEL_MULTIPLIERS[1],
    bigBlind: 10 * LEVEL_MULTIPLIERS[1],
    level: 1,
  })
})
