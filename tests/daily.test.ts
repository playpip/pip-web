import test from 'ava'
import {
  dailyAiRng,
  dailyDateKey,
  dailyNumber,
  dailySeed,
  dailyShareText,
  handSeed,
} from '@/lib/daily'
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
  t.is(dailyShareText(142, 2, 6, 34), 'pip daily #142 · 2nd of 6 · 34 hands · playpip.io/daily')
  t.is(dailyShareText(3, 1, 5, 21), 'pip daily #3 · won it · 21 hands · playpip.io/daily')
  t.is(dailyShareText(9, null, 5, 1), 'pip daily #9 · played · 1 hand · playpip.io/daily')
})

// --- the AI stream ----------------------------------------------------------
// The Daily promises the same hand to everyone. That covers the opponents as
// well as the cards, so the AI draws from a seeded per-hand stream. A page load
// rebuilds that stream from the seed, which is only honest if it can be put
// back exactly where it was (#25).

test('the AI stream is the same for everyone playing the same hand', (t) => {
  const base = dailySeed('2026-07-16')
  const mine = dailyAiRng(base, 7)
  const yours = dailyAiRng(base, 7)
  t.deepEqual(
    Array.from({ length: 20 }, () => mine()),
    Array.from({ length: 20 }, () => yours()),
  )
})

test('each hand gets its own stream, and a different day gets different ones', (t) => {
  const base = dailySeed('2026-07-16')
  const first = dailyAiRng(base, 0)()
  const second = dailyAiRng(base, 1)()
  const otherDay = dailyAiRng(dailySeed('2026-07-17'), 0)()
  t.not(first, second)
  t.not(first, otherDay)
})

test('resuming a stream mid-hand continues it rather than restarting it', (t) => {
  const base = dailySeed('2026-07-16')

  const uninterrupted = dailyAiRng(base, 3)
  const before = Array.from({ length: 500 }, () => uninterrupted())
  const after = Array.from({ length: 50 }, () => uninterrupted())

  // What a refresh does: rebuild from the seed, positioned where we left off.
  const resumed = dailyAiRng(base, 3, before.length)
  t.deepEqual(
    Array.from({ length: 50 }, () => resumed()),
    after,
  )

  // And the bug this replaced: rebuilding at zero replays the hand's opening
  // draws, so the opponents diverge from the run that was never interrupted.
  const restarted = dailyAiRng(base, 3)
  t.notDeepEqual(
    Array.from({ length: 50 }, () => restarted()),
    after,
  )
})

test('drawn() counts every value, including the ones skipped on resume', (t) => {
  const base = dailySeed('2026-07-16')
  const rng = dailyAiRng(base, 2)
  t.is(rng.drawn(), 0)
  for (let i = 0; i < 12; i++) rng()
  t.is(rng.drawn(), 12)

  // A resume starts at the count it was handed, so saving drawn() and passing
  // it back is a round trip.
  const resumed = dailyAiRng(base, 2, rng.drawn())
  t.is(resumed.drawn(), 12)
  resumed()
  t.is(resumed.drawn(), 13)
})

test('the AI stream is not the deck stream, so opponents do not mirror the cards', (t) => {
  const base = dailySeed('2026-07-16')
  const deckRng = mulberry32(handSeed(base, 5))
  const aiRng = dailyAiRng(base, 5)
  t.not(deckRng(), aiRng())
})
