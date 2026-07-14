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

test('SB all-in on his blind for less than the BB: no action, straight to showdown', (t) => {
  // Heads-up: P0 (button/SB) has less than the small blind — posting it puts
  // him all-in, and the BB has already committed more than P0's total, so no
  // betting is possible. Real rooms deal the board out with no action at all
  // (previously the engine pointed toActIndex at the all-in player).
  const deck = makeDeck(['As', 'Kd', 'Ah', 'Kc', '2c', '7d', '9h', '3s', '5c'])
  const stacks: SeatConfig[] = [
    { id: 'P0', name: 'Zero', stack: 1 },
    { id: 'P1', name: 'One', stack: 100 },
  ]
  const s = startHand({ seats: stacks, buttonIndex: 0, smallBlind: 2, bigBlind: 4, deck })

  t.true(isHandComplete(s))
  t.true(s.result!.showdown)
  t.is(s.community.length, 5)
  // P0's aces win the 2-chip main pot; P1's uncalled 3 chips come back.
  t.is(byId(s, 'P0').stack, 2)
  t.is(byId(s, 'P1').stack, 99)
})

test('both players all-in on the blinds runs straight out to showdown', (t) => {
  const deck = makeDeck(['As', 'Kd', 'Ah', 'Kc', '2c', '7d', '9h', '3s', '5c'])
  const stacks: SeatConfig[] = [
    { id: 'P0', name: 'Zero', stack: 1 },
    { id: 'P1', name: 'One', stack: 3 },
  ]
  const s = startHand({ seats: stacks, buttonIndex: 0, smallBlind: 5, bigBlind: 10, deck })

  // Nobody can act — the hand must resolve immediately from the deal.
  t.true(isHandComplete(s))
  t.true(s.result!.showdown)
  t.is(s.community.length, 5)
  // P0's aces win the 2-chip main pot; P1 keeps his 2-chip side pot.
  t.is(byId(s, 'P0').stack, 2)
  t.is(byId(s, 'P1').stack, 2)
})

test('BB all-in short: SB still acts, and his uncalled excess is returned', (t) => {
  // Heads-up: P1 (BB) posts all-in for 3 under the 10 blind. The betting level
  // stays the full BB (standard short-blind rule), P0 may call or fold, and
  // whatever P1 cannot match comes back to P0 as an uncalled side pot.
  const deck = makeDeck(['As', 'Kd', 'Ah', 'Kc', '2c', '7d', '9h', '3s', '5c'])
  const stacks: SeatConfig[] = [
    { id: 'P0', name: 'Zero', stack: 100 },
    { id: 'P1', name: 'One', stack: 3 },
  ]
  let s = startHand({ seats: stacks, buttonIndex: 0, smallBlind: 5, bigBlind: 10, deck })

  t.false(isHandComplete(s))
  t.is(s.toActIndex, 0)
  t.truthy(legalActions(s))

  s = applyAction(s, { type: 'call' }) // board runs out; only 3 is matched

  t.true(isHandComplete(s))
  t.true(s.result!.showdown)
  // P0's aces win the 6-chip main pot; his unmatched 7 chips come back: 100 + 3.
  t.is(byId(s, 'P0').stack, 103)
  t.is(byId(s, 'P1').stack, 0)
})
