import test from 'ava'
import { pushFoldAction } from '@/lib/poker/ai/pushFold'
import { decideAction, type AiProfile } from '@/lib/poker/ai/policy'
import { mulberry32 } from '@/lib/poker/cards'
import { applyAction, type HandState, startHand } from '@/lib/poker/engine'
import { makeDeck } from './helpers'

/**
 * Six-handed, button on seat 0, so seat 3 is first to act (UTG) and the order
 * runs 3, 4, 5, 0, 1, 2. `hole` is given to `who`; everyone else gets junk.
 */
function deal(stacks: number[], who: number, hole: [string, string]): HandState {
  const n = stacks.length
  // The engine deals seat 0 first, one card a seat, twice round.
  const order = Array.from({ length: n }, (_, i) => i)
  const junk = ['3c', '8d', '3h', '8h', '4c', '9d', '4d', '9h', '5c', 'Td', '5d', 'Th']
  let j = 0
  const first: string[] = []
  const second: string[] = []
  for (const seat of order) {
    first.push(seat === who ? hole[0] : junk[j++])
    second.push(seat === who ? hole[1] : junk[j++])
  }
  return startHand({
    seats: stacks.map((stack, i) => ({ id: `p${i}`, name: `p${i}`, stack })),
    buttonIndex: 0,
    smallBlind: 50,
    bigBlind: 100,
    deck: makeDeck([...first, ...second]),
  })
}

const foldTo = (s: HandState, id: string) => {
  while (s.players[s.toActIndex].id !== id) s = applyAction(s, { type: 'fold' })
  return s
}

test('a short stack shoves aces when it is folded to', (t) => {
  const s = foldTo(deal([1000, 1000, 1000, 1000, 1000, 1000], 0, ['As', 'Ad']), 'p0')
  const action = pushFoldAction(s, mulberry32(1))
  t.is(action?.type, 'raise')
  t.is(action?.amount, 1000)
})

test('a short stack folds seven-deuce under the gun', (t) => {
  const s = deal([1000, 1000, 1000, 1000, 1000, 1000], 3, ['7s', '2d'])
  t.is(pushFoldAction(s, mulberry32(1))?.type, 'fold')
})

test('a deep stack is left to the normal policy', (t) => {
  const s = deal([5000, 5000, 5000, 5000, 5000, 5000], 3, ['As', 'Ad'])
  t.is(pushFoldAction(s, mulberry32(1)), null)
})

test('a limp in front takes the spot off the chart', (t) => {
  let s = deal([1000, 1000, 1000, 1000, 1000, 1000], 0, ['As', 'Ad'])
  s = applyAction(s, { type: 'call' }) // UTG limps
  s = foldTo(s, 'p0')
  t.is(pushFoldAction(s, mulberry32(1)), null)
})

test('the big blind calls a short button shove with a big hand and folds junk', (t) => {
  const shoveFromButton = (hole: [string, string]) => {
    let s = foldTo(deal([800, 1000, 1000, 1000, 1000, 1000], 2, hole), 'p0')
    s = applyAction(s, { type: 'raise', amount: 800 })
    return foldTo(s, 'p2')
  }
  t.is(pushFoldAction(shoveFromButton(['Ks', 'Kd']), mulberry32(1))?.type, 'call')
  t.is(pushFoldAction(shoveFromButton(['7s', '2d']), mulberry32(1))?.type, 'fold')
})

test('a full-skill seat plays off the chart, and only ever legally', (t) => {
  const ai: AiProfile = { tightness: 0.6, aggression: 0.75, bluff: 0.2, iterations: 100, skill: 1 }
  const rng = mulberry32(5)
  let shoves = 0
  for (let seed = 0; seed < 60; seed++) {
    let s = startHand({
      seats: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: 'x', stack: 800 })),
      buttonIndex: seed % 6,
      smallBlind: 50,
      bigBlind: 100,
      rng: mulberry32(seed),
    })
    while (s.street === 'preflop') {
      const action = decideAction(s, ai, rng)
      const me = s.players[s.toActIndex]
      const allIn = me.stack + me.committedThisStreet
      const firstIn = s.players.every((p) => p === me || p.status === 'folded' || !p.hasActed)
      // A raise that is not all-in has no place at eight big blinds first in.
      if (action.type === 'raise' && firstIn) t.is(action.amount, allIn)
      if (action.type === 'raise' && action.amount === allIn) shoves++
      s = applyAction(s, action)
    }
  }
  t.true(shoves > 5)
})

test('an all-in for exactly the big blind leaves the big blind its free check', (t) => {
  // The button has exactly one big blind and shoves it; the big blind owes nothing.
  let s = foldTo(deal([100, 1000, 1000, 1000, 1000, 1000], 2, ['Ks', 'Kd']), 'p0')
  s = applyAction(s, { type: 'call' })
  s = foldTo(s, 'p2')
  t.is(pushFoldAction(s, mulberry32(1)), null)
})

test('short-stacked AI-vs-AI hands only ever take legal actions', (t) => {
  const ai: AiProfile = { tightness: 0.6, aggression: 0.75, bluff: 0.2, iterations: 60, skill: 1 }
  const rng = mulberry32(11)
  for (let hand = 0; hand < 300; hand++) {
    const n = 2 + (hand % 5)
    let s = startHand({
      // Anywhere from under a big blind to twenty, so blinds go all-in too.
      seats: Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        name: 'x',
        stack: 20 + Math.floor(rng() * 2000),
      })),
      buttonIndex: hand % n,
      smallBlind: 50,
      bigBlind: 100,
      rng,
    })
    let guard = 0
    while (s.street !== 'complete') {
      if (++guard > 200) throw new Error('hand never finished')
      s = applyAction(s, decideAction(s, ai, rng))
    }
  }
  t.pass()
})
