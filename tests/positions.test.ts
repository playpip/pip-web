import test from 'ava'
import {
  PREMIUM_BEHIND,
  SEATS,
  SEATS_AT_A_TABLE,
  type Seat,
  playersBehind,
  postflopPlace,
  preflopPlace,
  premiumShare,
} from '@/config/positions'
import { type SeatConfig, applyAction, legalActions, startHand } from '@/lib/poker/engine'

// /learn/position claims a betting order. The order is not a convention we get
// to state, it is what src/lib/poker/engine.ts does, so this file plays a real
// six-handed hand and reads the order back out. Everyone calls preflop and
// checks after it, which keeps all six live to the river and gives a full
// rotation on every street.

/** Seats ordered so that index 0 is the button, matching Seat.offset. */
const seatOrder = [...SEATS].sort((a, b) => a.offset - b.offset)
const config: SeatConfig[] = seatOrder.map((seat) => ({ id: seat.id, name: seat.name, stack: 500 }))

/** The ids in the order the engine gave them the action, one street at a time. */
function actingOrder(): { preflop: string[]; flop: string[] } {
  let state = startHand({ seats: config, buttonIndex: 0, smallBlind: 5, bigBlind: 10 })
  const preflop: string[] = []
  const flop: string[] = []
  while (state.street === 'preflop' || state.street === 'flop') {
    const seen = state.street === 'preflop' ? preflop : flop
    seen.push(state.players[state.toActIndex].id)
    const legal = legalActions(state)!
    state = applyAction(state, legal.canCheck ? { type: 'check' } : { type: 'call' })
  }
  return { preflop, flop }
}

test('the seat list is a full table, with every offset used once', (t) => {
  t.is(SEATS.length, SEATS_AT_A_TABLE)
  t.is(new Set(SEATS.map((s) => s.offset)).size, SEATS_AT_A_TABLE)
  t.is(new Set(SEATS.map((s) => s.id)).size, SEATS_AT_A_TABLE)
})

test('the preflop order on the page is the order the engine acts', (t) => {
  const { preflop } = actingOrder()
  t.is(preflop.length, SEATS_AT_A_TABLE)
  const claimed = [...SEATS].sort((a, b) => preflopPlace(a) - preflopPlace(b)).map((s) => s.id)
  t.deepEqual(preflop, claimed)
  // The bit people get wrong, stated on its own so a failure says why.
  t.is(preflop.indexOf('btn') + 1, 4)
  t.is(preflop[preflop.length - 1], 'bb')
})

test('the postflop order on the page is the order the engine acts', (t) => {
  const { flop } = actingOrder()
  t.is(flop.length, SEATS_AT_A_TABLE)
  const claimed = [...SEATS].sort((a, b) => postflopPlace(a) - postflopPlace(b)).map((s) => s.id)
  t.deepEqual(flop, claimed)
  t.is(flop[0], 'sb')
  t.is(flop[flop.length - 1], 'btn')
})

test('the button moves from fourth to last, and the blinds from last to first', (t) => {
  const seat = (id: string): Seat => SEATS.find((s) => s.id === id)!
  t.is(preflopPlace(seat('btn')), 4)
  t.is(postflopPlace(seat('btn')), SEATS_AT_A_TABLE)
  t.is(preflopPlace(seat('bb')), SEATS_AT_A_TABLE)
  t.is(postflopPlace(seat('sb')), 1)
})

test('players still to act is what is left of the table after you', (t) => {
  for (const seat of SEATS) {
    t.is(playersBehind(seat), SEATS_AT_A_TABLE - preflopPlace(seat), seat.id)
  }
  t.is(Math.max(...SEATS.map(playersBehind)), 5)
  t.is(Math.min(...SEATS.map(playersBehind)), 0)
})

// 24 pair combinations (JJ, QQ, KK, AA) plus 16 of ace-king is 40 of 1,326.
// The page rounds it to 3.0%, and it is the only exact row in that table.
test('a single opponent holds a premium 3.0% of the time', (t) => {
  t.is(Math.round(premiumShare() * 100) / 100, 3.02)
  const single = PREMIUM_BEHIND.find((row) => row.behind === 1)!
  t.is(single.chance.toFixed(1), '3.0')
})

test('the more players behind you, the likelier one of them has a hand', (t) => {
  const chances = [...PREMIUM_BEHIND].sort((a, b) => a.behind - b.behind).map((r) => r.chance)
  for (let i = 1; i < chances.length; i++) t.true(chances[i] > chances[i - 1])
})
