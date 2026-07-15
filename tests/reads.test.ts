import test from 'ava'
import { deriveReads, emptySeatStats, READS_MIN_HANDS, type SeatStats } from '@/lib/reads'

const stats = (over: Partial<SeatStats>): SeatStats => ({ ...emptySeatStats(), ...over })

test('no reads until enough hands are observed', (t) => {
  t.is(deriveReads(undefined), null)
  t.is(deriveReads(stats({ handsDealt: READS_MIN_HANDS - 1, vpipHands: 5 })), null)
  t.truthy(deriveReads(stats({ handsDealt: READS_MIN_HANDS })))
})

test('looseness read tiers on VPIP rate', (t) => {
  const loose = deriveReads(stats({ handsDealt: 10, vpipHands: 7 }))!
  t.is(loose[0].label, 'Plays most hands')
  t.is(loose[0].strength, 0.7)

  const medium = deriveReads(stats({ handsDealt: 10, vpipHands: 4 }))!
  t.is(medium[0].label, 'Picks their spots')

  const tight = deriveReads(stats({ handsDealt: 10, vpipHands: 2 }))!
  t.is(tight[0].label, 'Waits for real hands')
})

test('aggression read needs a sample and tiers on raise share', (t) => {
  // Only 3 total actions → no aggression read yet.
  const early = deriveReads(stats({ handsDealt: 10, raises: 2, calls: 1 }))!
  t.is(early.length, 1)

  const raiser = deriveReads(stats({ handsDealt: 10, raises: 6, calls: 2 }))!
  t.is(raiser[1].label, 'Raises more than calls')

  const caller = deriveReads(stats({ handsDealt: 10, raises: 1, calls: 7 }))!
  t.is(caller[1].label, 'Calls more than raises')
})

test('pressure read needs bets faced and tiers on fold rate', (t) => {
  const nofold = deriveReads(stats({ handsDealt: 10, betsFaced: 8, foldsToBet: 1 }))!
  t.is(nofold.at(-1)!.label, 'Hard to push off a hand')

  const folder = deriveReads(stats({ handsDealt: 10, betsFaced: 8, foldsToBet: 6 }))!
  t.is(folder.at(-1)!.label, 'Folds under pressure')

  // Too few bets faced → no pressure read.
  const early = deriveReads(stats({ handsDealt: 10, betsFaced: 3, foldsToBet: 3 }))!
  t.false(early.some((r) => r.label.includes('pressure') || r.label.includes('push')))
})

test('a full sample produces two to three reads', (t) => {
  const reads = deriveReads(
    stats({ handsDealt: 20, vpipHands: 12, raises: 5, calls: 9, betsFaced: 10, foldsToBet: 6 }),
  )!
  t.true(reads.length >= 2 && reads.length <= 3)
  for (const r of reads) {
    t.true(r.strength >= 0 && r.strength <= 1)
  }
})
