import test from 'ava'
import {
  barrelledEveryStreet,
  checkRaised,
  lineOf,
  preflopAggressor,
  streetIsUnbet,
} from '@/lib/poker/ai/line'
import { decideAction, type AiProfile } from '@/lib/poker/ai/policy'
import { createTableMemory, foldiness, observeAction } from '@/lib/poker/ai/memory'
import { mulberry32 } from '@/lib/poker/cards'
import { applyAction, type HandState, startHand } from '@/lib/poker/engine'
import { CAST, profileFor } from '@/config/cast'
import { venueById } from '@/config/venues'

const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `p${i}`, stack: 1000 }))

/** Heads-up: p0 is the button and small blind, p1 the big blind. */
function headsUp(seed = 1): HandState {
  return startHand({
    seats: seats(2),
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    rng: mulberry32(seed),
  })
}

test('the engine logs every action, and no blinds', (t) => {
  let s = headsUp()
  t.deepEqual(lineOf(s), [])
  s = applyAction(s, { type: 'raise', amount: 30 })
  s = applyAction(s, { type: 'call' })
  t.deepEqual(
    lineOf(s).map((a) => [a.playerId, a.street, a.type, a.to]),
    [
      ['p0', 'preflop', 'raise', 30],
      ['p1', 'preflop', 'call', 30],
    ],
  )
})

test('a hand saved without a log reads as an empty one', (t) => {
  const s = { ...headsUp(), actions: undefined } as unknown as HandState
  t.deepEqual(lineOf(s), [])
  t.is(preflopAggressor(s), null)
})

test('the line reads the preflop raiser, a check-raise, and a story', (t) => {
  let s = headsUp()
  s = applyAction(s, { type: 'raise', amount: 30 })
  s = applyAction(s, { type: 'call' })
  t.is(preflopAggressor(s), 'p0')
  // Flop: the big blind checks, the raiser bets, the big blind raises.
  t.true(streetIsUnbet(s))
  s = applyAction(s, { type: 'check' })
  s = applyAction(s, { type: 'bet', amount: 40 })
  t.false(streetIsUnbet(s))
  s = applyAction(s, { type: 'raise', amount: 120 })
  t.true(checkRaised(s, 'p1'))
  t.false(checkRaised(s, 'p0'))
  s = applyAction(s, { type: 'call' })
  // Turn: both bet the flop, so both have led every street before this one.
  t.is(s.street, 'turn')
  t.true(barrelledEveryStreet(s, 'p1'))
  s = applyAction(s, { type: 'check' })
  s = applyAction(s, { type: 'check' })
  // River: nobody bet the turn, so nobody has a story to finish.
  t.is(s.street, 'river')
  t.false(barrelledEveryStreet(s, 'p0'))
  t.false(barrelledEveryStreet(s, 'p1'))
})

test('the table reads who folds to bets', (t) => {
  const memory = createTableMemory()
  for (let seed = 0; seed < 30; seed++) {
    let s = headsUp(seed)
    s = applyAction(s, { type: 'raise', amount: 30 })
    observeAction(memory, s, { type: 'fold' })
  }
  t.true(foldiness(memory, 'p1') > 1.2)
  t.is(foldiness(memory, 'nobody'), 1)
})

test('a full-skill seat first in raises or folds, never limps', (t) => {
  const ai: AiProfile = { ...venueById('mainevent')!.ai, iterations: 100 }
  const rng = mulberry32(3)
  let opens = 0
  // Under the gun opens about 8% at The Main Event, so 400 hands expect ~30.
  for (let seed = 0; seed < 400; seed++) {
    let s = startHand({
      seats: seats(6),
      buttonIndex: seed % 6,
      smallBlind: 5,
      bigBlind: 10,
      rng: mulberry32(seed),
    })
    const first = decideAction(s, ai, rng)
    t.not(first.type, 'call', 'a limp from the first seat in')
    if (first.type === 'raise') opens++
    s = applyAction(s, first)
  }
  t.true(opens > 15, `opened ${opens} of 400`)
})

test('the button opens more hands than under the gun', (t) => {
  const ai: AiProfile = { ...venueById('mainevent')!.ai, iterations: 100 }
  const openRate = (seatsFolded: number) => {
    const rng = mulberry32(8)
    let opens = 0
    for (let seed = 0; seed < 400; seed++) {
      let s = startHand({
        seats: seats(6),
        buttonIndex: 0,
        smallBlind: 5,
        bigBlind: 10,
        rng: mulberry32(seed),
      })
      for (let i = 0; i < seatsFolded; i++) s = applyAction(s, { type: 'fold' })
      if (decideAction(s, ai, rng).type === 'raise') opens++
    }
    return opens
  }
  // Under the gun is first to act; three folds puts the action on the button.
  t.true(openRate(3) > openRate(0))
})

test('every character habit is a real one, and characters carry it to the table', (t) => {
  const withHabit = CAST.filter((ch) => ch.habit)
  t.true(withHabit.length >= 4)
  for (const ch of withHabit) {
    t.true(['barreler', 'caller', 'trapper', 'positional'].includes(ch.habit!), ch.id)
    t.is(profileFor(venueById('cardroom')!, ch).habit, ch.habit)
  }
})

test('the caller calls a flop bet more often than the same profile without the habit', (t) => {
  const base: AiProfile = { ...venueById('cardroom')!.ai, iterations: 150 }
  const calls = (profile: AiProfile) => {
    const rng = mulberry32(5)
    let n = 0
    for (let seed = 0; seed < 200; seed++) {
      let s = headsUp(seed)
      s = applyAction(s, { type: 'raise', amount: 30 })
      s = applyAction(s, { type: 'call' })
      s = applyAction(s, { type: 'check' })
      s = applyAction(s, { type: 'bet', amount: 40 })
      if (decideAction(s, profile, rng).type !== 'fold') n++
    }
    return n
  }
  t.true(calls({ ...base, habit: 'caller' }) > calls(base))
})
