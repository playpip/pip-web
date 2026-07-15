import test from 'ava'
import {
  startHand,
  applyAction,
  legalActions,
  isHandComplete,
  type HandState,
  type SeatConfig,
} from '@/lib/poker/engine'
import { decideAction, type AiProfile } from '@/lib/poker/ai/policy'
import { mulberry32, type Rng } from '@/lib/poker/cards'

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
