import test from 'ava'
import { buildPots, totalPot } from '@/lib/poker/pots'

test('single pot when everyone commits equally', (t) => {
  const pots = buildPots([
    { id: 'a', committed: 100, folded: false },
    { id: 'b', committed: 100, folded: false },
    { id: 'c', committed: 100, folded: false },
  ])
  t.is(pots.length, 1)
  t.is(pots[0].amount, 300)
  t.deepEqual(pots[0].eligible.sort(), ['a', 'b', 'c'])
})

test('short all-in creates a side pot', (t) => {
  // a is all-in for 50; b and c contest a 100-each pot.
  const pots = buildPots([
    { id: 'a', committed: 50, folded: false },
    { id: 'b', committed: 100, folded: false },
    { id: 'c', committed: 100, folded: false },
  ])
  t.is(pots.length, 2)
  // Main pot: 50 * 3 = 150, all eligible.
  t.is(pots[0].amount, 150)
  t.deepEqual(pots[0].eligible.sort(), ['a', 'b', 'c'])
  // Side pot: 50 * 2 = 100, only b and c.
  t.is(pots[1].amount, 100)
  t.deepEqual(pots[1].eligible.sort(), ['b', 'c'])
  t.is(totalPot(pots), 250)
})

test("folded player's chips stay in the pot but they cannot win", (t) => {
  const pots = buildPots([
    { id: 'a', committed: 100, folded: false },
    { id: 'b', committed: 100, folded: false },
    { id: 'folder', committed: 40, folded: true },
  ])
  t.is(totalPot(pots), 240)
  for (const pot of pots) {
    t.false(pot.eligible.includes('folder'))
  }
})

test('multiple all-ins stack into layered side pots', (t) => {
  const pots = buildPots([
    { id: 'a', committed: 20, folded: false },
    { id: 'b', committed: 50, folded: false },
    { id: 'c', committed: 100, folded: false },
  ])
  t.is(totalPot(pots), 170)
  // 20*3=60 (all), 30*2=60 (b,c), 50*1=50 (c only).
  t.is(pots[0].amount, 60)
  t.is(pots[1].amount, 60)
  t.is(pots[2].amount, 50)
  t.deepEqual(pots[2].eligible, ['c'])
})
