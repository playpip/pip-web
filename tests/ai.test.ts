import test from 'ava'
import {
  startHand,
  applyAction,
  legalActions,
  isHandComplete,
  type HandState,
  type SeatConfig,
} from '@/lib/poker/engine'
import { decideAction, opponentSelectivity, type AiProfile } from '@/lib/poker/ai/policy'
import { mulberry32, type Rng } from '@/lib/poker/cards'
import { makeDeck } from './helpers'

type Player = HandState['players'][number]

/** Minimal opponent stub for the pure selectivity read (only reads commitments). */
function opp(committedThisHand: number, committedThisStreet = 0): Player {
  return { committedThisHand, committedThisStreet, status: 'active' } as Player
}

const PROFILE: AiProfile = { tightness: 0.4, aggression: 0.5, bluff: 0.12, iterations: 200 }

function makeSeats(n: number, stack = 1000): SeatConfig[] {
  return Array.from({ length: n }, (_, i) => ({ id: `P${i}`, name: `P${i}`, stack }))
}

/** Drive a full hand with the AI acting for everyone. Returns the final state. */
function playOut(seats: SeatConfig[], rng: Rng, onStep?: (s: HandState) => void): HandState {
  let s = startHand({ seats, buttonIndex: 0, smallBlind: 5, bigBlind: 10, rng })
  let guard = 0
  while (!isHandComplete(s)) {
    if (guard++ > 1000) throw new Error('hand did not terminate')
    onStep?.(s)
    s = applyAction(s, decideAction(s, PROFILE, rng))
  }
  return s
}

test('AI-vs-AI hands always terminate and conserve chips', (t) => {
  for (let seed = 0; seed < 40; seed++) {
    const seats = makeSeats(6)
    const before = seats.reduce((sum, s) => sum + s.stack, 0)
    const final = playOut(seats, mulberry32(seed))
    t.true(isHandComplete(final))
    t.is(
      final.players.reduce((sum, p) => sum + p.stack, 0),
      before,
    )
  }
})

test('AI never folds when it can check for free', (t) => {
  for (let seed = 0; seed < 25; seed++) {
    const rng = mulberry32(seed * 31 + 1)
    playOut(makeSeats(4), rng, (s) => {
      const legal = legalActions(s)
      if (legal?.canCheck) {
        const action = decideAction(s, PROFILE, rng)
        t.not(action.type, 'fold')
      }
    })
  }
})

test('AI only ever returns legal actions (no engine throws)', (t) => {
  // If any AI action were illegal, applyAction inside playOut would throw.
  t.notThrows(() => {
    for (let seed = 0; seed < 20; seed++) playOut(makeSeats(3), mulberry32(seed + 500))
  })
})

test('tighter AI folds more than a looser one facing the same spots', (t) => {
  const nit: AiProfile = { tightness: 0.9, aggression: 0.3, bluff: 0.0, iterations: 200 }
  const maniac: AiProfile = { tightness: 0.05, aggression: 0.3, bluff: 0.0, iterations: 200 }

  const countFolds = (profile: AiProfile): number => {
    let folds = 0
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed + 9)
      let s = startHand({ seats: makeSeats(4), buttonIndex: 0, smallBlind: 5, bigBlind: 10, rng })
      let guard = 0
      while (!isHandComplete(s) && guard++ < 1000) {
        const action = decideAction(s, profile, rng)
        if (action.type === 'fold') folds++
        s = applyAction(s, action)
      }
    }
    return folds
  }

  t.true(countFolds(nit) > countFolds(maniac))
})

test('opponentSelectivity rises with chips committed and stays bounded', (t) => {
  const preflop = { bigBlind: 10, street: 'preflop', currentBet: 0 } as HandState

  const little = opponentSelectivity(preflop, opp(10)) // 1bb in
  const some = opponentSelectivity(preflop, opp(50)) // 5bb in
  const lots = opponentSelectivity(preflop, opp(300)) // 30bb in

  t.true(some > little)
  t.true(lots > some)
  t.true(little >= 0 && lots <= 0.8) // bounded [0, 0.8]
})

test('opponentSelectivity adds a bump for backing it postflop', (t) => {
  // Same chips committed, but one opponent has matched the bet on a later
  // street — a stronger signal of a real hand than dead preflop money.
  const flop = { bigBlind: 10, street: 'flop', currentBet: 40 } as HandState
  const passive = opponentSelectivity({ ...flop, street: 'preflop' } as HandState, opp(60, 0))
  const aggressive = opponentSelectivity(flop, opp(60, 40))
  t.true(aggressive > passive)
})

test('low-skill AI folds to pressure more than its full-skill self', (t) => {
  const base: AiProfile = { tightness: 0.4, aggression: 0.3, bluff: 0, iterations: 100 }
  const blundery: AiProfile = { ...base, skill: 0.2 }

  const countFolds = (profile: AiProfile): number => {
    let folds = 0
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed + 77)
      let s = startHand({ seats: makeSeats(4), buttonIndex: 0, smallBlind: 5, bigBlind: 10, rng })
      let guard = 0
      while (!isHandComplete(s) && guard++ < 1000) {
        const action = decideAction(s, profile, rng)
        if (action.type === 'fold') folds++
        s = applyAction(s, action)
      }
    }
    return folds
  }

  t.true(countFolds(blundery) > countFolds(base))
})

// Heads-up, P0 is SB/button and acts first preflop, owing the rest of the big
// blind. Deal order is one card per player per round, so popOrder positions
// 0 and 2 are P0's hole cards, 1 and 3 are P1's.
function dealHeadsUp(p0: [string, string], p1: [string, string]) {
  const deck = makeDeck([p0[0], p1[0], p0[1], p1[1], '7c', '8d', 'Jh', 'Qs', '2h'])
  return startHand({ seats: makeSeats(2), buttonIndex: 0, smallBlind: 5, bigBlind: 10, deck })
}

test('AI mucks preflop junk (2-3o) to a bet instead of peeling cheap', (t) => {
  const profile: AiProfile = { tightness: 0.4, aggression: 0.5, bluff: 0.12, iterations: 200 }
  // P0 holds 2-3 offsuit — the worst kind of hand a real player never enters.
  const s = dealHeadsUp(['2c', '3d'], ['Ah', 'Kh'])
  for (let seed = 0; seed < 20; seed++) {
    const action = decideAction(s, profile, mulberry32(seed + 1))
    t.is(action.type, 'fold')
  }
})

test('AI still plays a premium (AA) preflop rather than folding it', (t) => {
  const profile: AiProfile = { tightness: 0.4, aggression: 0.5, bluff: 0.12, iterations: 200 }
  const s = dealHeadsUp(['As', 'Ad'], ['7h', '2c'])
  for (let seed = 0; seed < 20; seed++) {
    const action = decideAction(s, profile, mulberry32(seed + 1))
    t.not(action.type, 'fold')
  }
})

// Fraction of preflop seats that voluntarily put chips in (limp/call/raise),
// i.e. VPIP — the standard measure of how wide a table plays.
function measureVpip(profile: AiProfile): number {
  let seats = 0
  let voluntary = 0
  for (let h = 0; h < 60; h++) {
    const rng = mulberry32(h * 7 + 13)
    let s = startHand({ seats: makeSeats(6), buttonIndex: h % 6, smallBlind: 5, bigBlind: 10, rng })
    const put = new Set<string>()
    const seen = new Set<string>()
    let guard = 0
    while (!isHandComplete(s) && guard++ < 1000) {
      if (s.street === 'preflop') {
        const p = s.players[s.toActIndex]
        seen.add(p.id)
        const a = decideAction(s, profile, rng)
        if (a.type === 'bet' || a.type === 'raise' || a.type === 'call') put.add(p.id)
        s = applyAction(s, a)
      } else {
        s = applyAction(s, decideAction(s, profile, rng))
      }
    }
    seats += seen.size
    voluntary += put.size
  }
  return voluntary / seats
}

test('looseness scales preflop range: a loose table plays far more hands than a nit', (t) => {
  // Same skill/aggression — only tightness differs, mirroring the venue ladder.
  const loose: AiProfile = { tightness: 0.15, aggression: 0.4, bluff: 0.08, iterations: 120 }
  const nit: AiProfile = { tightness: 0.6, aggression: 0.4, bluff: 0.08, iterations: 120 }

  const looseVpip = measureVpip(loose)
  const nitVpip = measureVpip(nit)

  // The loose field should play a visibly wider range — not a hair's difference.
  t.true(looseVpip > nitVpip + 0.08, `loose ${looseVpip.toFixed(2)} vs nit ${nitVpip.toFixed(2)}`)
  // And nobody plays a cartoonishly wide "any two cards" range.
  t.true(looseVpip < 0.45, `loose VPIP ${looseVpip.toFixed(2)} unrealistically high`)
})
