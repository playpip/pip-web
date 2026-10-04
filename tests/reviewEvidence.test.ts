import test from 'ava'
import { cardFromString } from '@/lib/poker/cards'
import type { GradedDecision } from '@/lib/review/grade'
import type { ReviewHand } from '@/lib/review/session'
import { emptyReviewStats, evidenceFor, foldHand } from '@/lib/review/stats'
import type { HandRecord } from '@/store/game'

// The report's "See the hands" is its answer to "says who?". A hand shown under
// "You enter too many pots" or "You pay off too often at the end" has to be a
// call, or the proof argues against the finding it sits under.

const cards = (...s: string[]) => s.map(cardFromString)

const record: HandRecord = {
  handNo: 1,
  smallBlind: 10,
  bigBlind: 20,
  events: [],
  community: cards('Ah', 'Kd', '7c', '2s', '9h'),
  reveals: [],
  seats: [
    { id: 'hero', name: 'Will', avatar: { seed: 'w', backgroundColor: 'b6e3f4' } },
    { id: 'ai1', name: 'Doris', avatar: { seed: 'd', backgroundColor: 'c0aede' } },
  ],
  hole: [
    { playerId: 'hero', cards: cards('Qc', 'Jd') },
    { playerId: 'ai1', cards: cards('As', 'Kc') },
  ],
  buttonId: 'hero',
  summary: '',
}

function mistake(street: GradedDecision['street'], folded: boolean): ReviewHand {
  const decision: GradedDecision = {
    eventIndex: 0,
    street,
    folded,
    required: 0.25,
    equity: folded ? 0.4 : 0.1,
    toCall: 60,
    pot: 180,
    margin: 0.15,
    bb: -6,
    grade: 'costly',
    verdict: 'wrong',
  }
  return { record, decisions: [decision] }
}

for (const street of ['preflop', 'river'] as const) {
  const key = street === 'river' ? 'river-call' : 'preflop-call'

  test(`a ${street} fold is a tight fold, never ${key} evidence`, (t) => {
    const stats = foldHand(emptyReviewStats(), mistake(street, true))
    t.is(stats.evidence['tight-fold']?.length, 1)
    t.is(stats.evidence[key], undefined)
  })

  test(`a ${street} call is ${key} evidence`, (t) => {
    const stats = foldHand(emptyReviewStats(), mistake(street, false))
    t.is(stats.evidence[key]?.length, 1)
    t.is(stats.evidence['loose-call']?.length, 1)
  })

  test(`a ${street} fold already stored under ${key} is not shown there`, (t) => {
    // What a profile from before the fix holds: the fold filed under both. The
    // lines come from foldHand, so this tracks the format it really writes.
    const [fold] = foldHand(emptyReviewStats(), mistake(street, true)).evidence['tight-fold'] ?? []
    const [call] = foldHand(emptyReviewStats(), mistake(street, false)).evidence[key] ?? []
    const stats = { evidence: { [key]: [fold, call], 'tight-fold': [fold] } }
    t.deepEqual(evidenceFor(stats, key), [call])
    t.deepEqual(evidenceFor(stats, 'tight-fold'), [fold], 'the fold still proves a tight fold')
  })
}
