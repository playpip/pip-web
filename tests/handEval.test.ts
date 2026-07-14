import test from 'ava'
import { evaluateHand, determineWinners } from '@/lib/poker/handEval'
import { cardFromString, type Card } from '@/lib/poker/cards'

const h = (...s: string[]): Card[] => s.map(cardFromString)

test('recognises a flush', (t) => {
  const ev = evaluateHand(h('Ah', 'Kh'), h('2h', '7h', 'Th', '3c', '4d'))
  t.is(ev.name, 'Flush')
})

test('recognises a full house', (t) => {
  const ev = evaluateHand(h('Ah', 'Ad'), h('As', 'Kh', 'Kd', '3c', '4d'))
  t.is(ev.name, 'Full House')
})

test('higher hand wins between two players', (t) => {
  const board = h('2c', '7s', 'Ts', 'Jc', '3d')
  const { winners } = determineWinners(
    [
      { id: 'aces', hole: h('Ah', 'Ad') },
      { id: 'kings', hole: h('Kh', 'Kd') },
    ],
    board,
  )
  t.deepEqual(winners, ['aces'])
})

test('identical hands split (both winners)', (t) => {
  // Board plays a broadway straight; both players just play the board.
  const board = h('Ts', 'Js', 'Qh', 'Kd', 'Ac')
  const { winners } = determineWinners(
    [
      { id: 'p1', hole: h('2c', '3d') },
      { id: 'p2', hole: h('4c', '5d') },
    ],
    board,
  )
  t.is(winners.length, 2)
  t.true(winners.includes('p1') && winners.includes('p2'))
})

test('kicker decides when top pair ties', (t) => {
  const board = h('As', '7d', '2c', 'Th', '4s')
  const { winners } = determineWinners(
    [
      { id: 'bigKicker', hole: h('Ah', 'Kd') },
      { id: 'smallKicker', hole: h('Ac', 'Qd') },
    ],
    board,
  )
  t.deepEqual(winners, ['bigKicker'])
})
