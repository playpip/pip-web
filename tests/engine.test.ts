import test from 'ava'
import {
  startHand,
  applyAction,
  legalActions,
  isHandComplete,
  type HandState,
  type SeatConfig,
} from '@/lib/poker/engine'
import { makeDeck } from './helpers'

const seats = (): SeatConfig[] => [
  { id: 'P0', name: 'Zero', stack: 200 },
  { id: 'P1', name: 'One', stack: 200 },
]

const byId = (s: HandState, id: string) => s.players.find((p) => p.id === id)!

test('heads-up: button posts small blind, other posts big blind', (t) => {
  const s = startHand({ seats: seats(), buttonIndex: 0, smallBlind: 5, bigBlind: 10 })
  t.is(byId(s, 'P0').committedThisStreet, 5) // button = SB
  t.is(byId(s, 'P1').committedThisStreet, 10) // BB
  t.is(s.currentBet, 10)
  t.is(s.toActIndex, 0) // heads-up SB acts first preflop
})

test('3-handed: blinds and first-to-act are left of the button', (t) => {
  const three: SeatConfig[] = [
    { id: 'A', name: 'A', stack: 200 },
    { id: 'B', name: 'B', stack: 200 },
    { id: 'C', name: 'C', stack: 200 },
  ]
  const s = startHand({ seats: three, buttonIndex: 0, smallBlind: 5, bigBlind: 10 })
  t.is(byId(s, 'B').committedThisStreet, 5) // SB left of button
  t.is(byId(s, 'C').committedThisStreet, 10) // BB
  t.is(s.players[s.toActIndex].id, 'A') // UTG = left of BB (button seat here)
})

test('folding preflop hands the pot to the other player', (t) => {
  const s0 = startHand({ seats: seats(), buttonIndex: 0, smallBlind: 5, bigBlind: 10 })
  const s = applyAction(s0, { type: 'fold' })
  t.true(isHandComplete(s))
  t.truthy(s.result)
  t.false(s.result!.showdown)
  t.deepEqual(s.result!.potsAwarded[0].winners, ['P1'])
  t.is(byId(s, 'P1').stack, 205) // 200 - 10 blind + 15 pot
  t.is(byId(s, 'P0').stack, 195) // 200 - 5 blind
})

test('min-raise below the legal minimum is rejected', (t) => {
  const s = startHand({ seats: seats(), buttonIndex: 0, smallBlind: 5, bigBlind: 10 })
  const legal = legalActions(s)!
  t.is(legal.minRaiseTo, 20) // currentBet 10 + lastRaise 10
  t.throws(() => applyAction(s, { type: 'raise', amount: 15 }))
  t.notThrows(() => applyAction(s, { type: 'raise', amount: 20 }))
})

test('checking down to showdown pays the best hand', (t) => {
  // P0 = AhAd, P1 = KhKd, board bricks → P0 wins.
  const deck = makeDeck(['Ah', 'Kh', 'Ad', 'Kd', '2c', '7s', 'Ts', 'Jc', '3d'])
  let s = startHand({ seats: seats(), buttonIndex: 0, smallBlind: 5, bigBlind: 10, deck })

  s = applyAction(s, { type: 'call' }) // P0 SB completes
  s = applyAction(s, { type: 'check' }) // P1 BB checks -> flop
  s = applyAction(s, { type: 'check' }) // P1 first postflop
  s = applyAction(s, { type: 'check' }) // P0 -> turn
  s = applyAction(s, { type: 'check' })
  s = applyAction(s, { type: 'check' }) // -> river
  s = applyAction(s, { type: 'check' })
  s = applyAction(s, { type: 'check' }) // -> showdown

  t.true(isHandComplete(s))
  t.true(s.result!.showdown)
  t.deepEqual(s.result!.potsAwarded[0].winners, ['P0'])
  t.is(byId(s, 'P0').stack, 210)
  t.is(byId(s, 'P1').stack, 190)
  t.is(s.community.length, 5)
})

test('all-in confrontation runs the board out and pays the winner', (t) => {
  const deck = makeDeck(['Ah', 'Kh', 'Ad', 'Kd', '2c', '7s', 'Ts', 'Jc', '3d'])
  const stacks: SeatConfig[] = [
    { id: 'P0', name: 'Zero', stack: 100 },
    { id: 'P1', name: 'One', stack: 100 },
  ]
  let s = startHand({ seats: stacks, buttonIndex: 0, smallBlind: 5, bigBlind: 10, deck })

  s = applyAction(s, { type: 'raise', amount: 100 }) // P0 shoves all-in
  s = applyAction(s, { type: 'call' }) // P1 calls all-in

  t.true(isHandComplete(s))
  t.true(s.result!.showdown)
  t.is(s.community.length, 5)
  t.is(byId(s, 'P0').stack, 200)
  t.is(byId(s, 'P1').stack, 0)
})

test('a completed hand exposes no player to act', (t) => {
  const s0 = startHand({ seats: seats(), buttonIndex: 0, smallBlind: 5, bigBlind: 10 })
  const s = applyAction(s0, { type: 'fold' })
  t.is(s.toActIndex, -1)
  t.is(legalActions(s), null)
})
