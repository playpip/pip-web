import test from 'ava'
import { dailyDateKey, dailyNumber, dailySeed, handSeed, dailyShareText } from '@/lib/daily'
import { mulberry32, shuffledDeck, cardToString } from '@/lib/poker/cards'

test('date keys are UTC days', (t) => {
  t.is(dailyDateKey(new Date('2026-07-16T00:00:01Z')), '2026-07-16')
  t.is(dailyDateKey(new Date('2026-07-16T23:59:59Z')), '2026-07-16')
})

test('daily numbers count up from the epoch', (t) => {
  t.is(dailyNumber('2026-07-16'), 1)
  t.is(dailyNumber('2026-07-17'), 2)
  t.is(dailyNumber('2026-08-16'), 32)
})

test('the same day always deals the same deck; different days differ', (t) => {
  const seedA = dailySeed('2026-07-16')
  t.is(seedA, dailySeed('2026-07-16'))
  const deckA = shuffledDeck(mulberry32(handSeed(seedA, 0))).map(cardToString)
  const deckB = shuffledDeck(mulberry32(handSeed(seedA, 0))).map(cardToString)
  t.deepEqual(deckA, deckB)
  const otherDay = shuffledDeck(mulberry32(handSeed(dailySeed('2026-07-17'), 0))).map(cardToString)
  t.notDeepEqual(deckA, otherDay)
})

test('hands within a day get distinct seeds', (t) => {
  const base = dailySeed('2026-07-16')
  const seeds = new Set(Array.from({ length: 50 }, (_, i) => handSeed(base, i)))
  t.is(seeds.size, 50)
})

test('share text reads calmly', (t) => {
  t.is(dailyShareText(142, 2, 6, 34), 'pip daily #142 · 2nd of 6 · 34 hands · playpip.io')
  t.is(dailyShareText(3, 1, 5, 21), 'pip daily #3 · won it · 21 hands · playpip.io')
  t.is(dailyShareText(9, null, 5, 1), 'pip daily #9 · played · 1 hand · playpip.io')
})
