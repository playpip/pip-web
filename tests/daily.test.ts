import { readFileSync, readdirSync } from 'node:fs'
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

test('the share line carries the streak from two days up', (t) => {
  t.is(dailyShareText(142, 2, 5, 34, 1), 'pip daily #142 · 2nd of 5 · 34 hands · playpip.io/daily')
  t.is(
    dailyShareText(142, 2, 5, 34, 2),
    'pip daily #142 · 2nd of 5 · 34 hands · 2-day streak · playpip.io/daily',
  )
  t.is(
    dailyShareText(150, 1, 5, 40, 9),
    'pip daily #150 · won it · 40 hands · 9-day streak · playpip.io/daily',
  )
})

// The landing page showed this line as a picture of itself, typed out by hand.
// When `dailyShareText` started appending `playpip.io/daily` the picture was
// not updated, so for a month the page selling the share loop displayed the
// version of the line that pointed nowhere, and every check was green: it is
// prose to a compiler.
//
// The rule is that one function writes this line. A second copy anywhere, even
// a decorative one, is a copy that can go stale, so the test is a grep rather
// than an assertion about any one file.
test('nothing outside lib/daily.ts writes the share line by hand', (t) => {
  const files = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) files(path, out)
      else if (/\.tsx?$/.test(entry.name)) out.push(path)
    }
    return out
  }

  const walked = files('../src')
  t.true(walked.length > 40, 'the walk found nothing, so it is proving nothing')

  for (const file of walked) {
    if (file === '../src/lib/daily.ts') continue
    const source = readFileSync(new URL(file, import.meta.url), 'utf-8')
    t.false(
      /pip daily #\d/.test(source),
      `${file} writes the share line itself; call dailyShareText instead`,
    )
  }
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

// --- tiers -------------------------------------------------------------------

test('the Daily gets harder and pays more the higher your rank', async (t) => {
  const { dailyFor, THE_DAILY } = await import('@/config/venues')
  const { RANKS } = await import('@/config/ranks')
  const tiers = RANKS.map((r) => dailyFor(r.min))
  t.deepEqual(
    tiers.map((v) => v.dailyTier),
    RANKS.map((r) => r.name),
  )
  for (let i = 1; i < tiers.length; i++) {
    t.true(
      (tiers[i].ai.skill ?? 0) > (tiers[i - 1].ai.skill ?? 0),
      `${tiers[i].dailyTier} plays harder`,
    )
    t.true(tiers[i].prize > tiers[i - 1].prize, `${tiers[i].dailyTier} pays more`)
  }
  for (const v of tiers) {
    t.is(v.id, THE_DAILY.id)
    t.is(v.buyIn, 0)
    t.is(v.startingStack, THE_DAILY.startingStack, 'same stack and blinds at every tier')
    t.is(v.runnerUpPrize, v.prize / 4)
  }
})

test('a new player is at the easiest tier', async (t) => {
  const { dailyFor, STARTING_ROLL } = await import('@/config/venues')
  t.is(dailyFor(STARTING_ROLL).dailyTier, 'Amateur')
})

test('the share line names the tier when there is one', async (t) => {
  const { dailyShareText } = await import('@/lib/daily')
  t.is(
    dailyShareText(142, 2, 5, 34, 0, 'Shark'),
    'pip daily #142 · Shark · 2nd of 5 · 34 hands · playpip.io/daily',
  )
  t.is(dailyShareText(142, 2, 5, 34), 'pip daily #142 · 2nd of 5 · 34 hands · playpip.io/daily')
})
