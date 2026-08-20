import test from 'ava'
import {
  PROOF_DAILY_NUMBER,
  PROOF_DATE,
  PROOF_DAY_SEED,
  PROOF_DECK,
  PROOF_HAND_SEED,
  PROOF_PREVIEW_CARDS,
  SNIPPET,
} from '@/config/dailyProof'
import { dailyNumber, dailySeed, handSeed } from '@/lib/daily'
import { cardToString, createDeck, mulberry32, shuffle } from '@/lib/poker/cards'

// /blog/verify-todays-deal invites strangers to regenerate one day's shuffle
// from a published description. That makes two things load-bearing that nothing
// else in the build looks at: the figures the post prints, and the snippet it
// hands out. If the seeding ever changes, the post becomes a set of wrong
// numbers and a program that disagrees with the site, and it would go on saying
// so until somebody happened to run it. This is that somebody.

const engineDeck = (dateKey: string) =>
  shuffle(createDeck(), mulberry32(handSeed(dailySeed(dateKey), 0)))
    .map(cardToString)
    .join(' ')

test('the figures the post prints are the ones the game deals', (t) => {
  t.is(dailyNumber(PROOF_DATE), PROOF_DAILY_NUMBER)
  t.is(dailySeed(PROOF_DATE), PROOF_DAY_SEED)
  t.is(handSeed(dailySeed(PROOF_DATE), 0), PROOF_HAND_SEED)
  t.is(engineDeck(PROOF_DATE), PROOF_DECK)
})

test('the published deck is a whole deck, no card twice', (t) => {
  const cards = PROOF_DECK.split(' ')
  t.is(cards.length, 52)
  t.is(new Set(cards).size, 52)
  t.true(PROOF_PREVIEW_CARDS < cards.length)
})

test('the snippet the post publishes still produces the published deck', (t) => {
  const lines: string[] = []
  // The snippet is written to be pasted into a console, so it ends in a log.
  // Run it as-is with the log captured, rather than a doctored copy of it.
  const run = new Function('console', SNIPPET) as (c: { log: (s: string) => void }) => void
  run({ log: (s: string) => lines.push(s) })
  t.deepEqual(lines, [PROOF_DECK])
})

test('the snippet borrows nothing from this repo', (t) => {
  t.false(SNIPPET.includes('import'))
  t.false(SNIPPET.includes('require'))
  t.false(SNIPPET.includes('@/'))
})

test('the guard can fail: a different day gives a different deck', (t) => {
  // Without this, every assertion above would still pass if dailySeed ignored
  // its argument and returned a constant.
  t.not(engineDeck('2026-08-21'), PROOF_DECK)
  t.not(dailySeed('2026-08-21'), PROOF_DAY_SEED)
})
