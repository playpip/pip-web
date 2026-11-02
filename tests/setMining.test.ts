// The set-mining figures `/blog/deep-stack-set-mining` prints.
//
// The numbers come from src/config/setMining.ts. This recounts the flops by
// dealing them, walks each table's blinds hand by hand, and pins the rounded
// figures the prose states, so the words cannot drift from the tables.

import test from 'ava'
import { blindsAt } from '../src/config/blinds'
import {
  MISSES_PER_HIT,
  SET_MINE_RAISE_BB,
  SET_MINE_STACK_BB,
  SET_MINE_TABLES,
} from '../src/config/setMining'
import { createDeck } from '../src/lib/poker/cards'

test('a pocket pair flops its rank 2,304 times in 19,600, counted by dealing', (t) => {
  const deck = createDeck()
  const hole = deck.filter((c) => c.rank === deck[0].rank).slice(0, 2)
  const rest = deck.filter((c) => !hole.includes(c))
  let flops = 0
  let hits = 0
  for (let a = 0; a < rest.length; a++)
    for (let b = a + 1; b < rest.length; b++)
      for (let c = b + 1; c < rest.length; c++) {
        flops++
        if ([rest[a], rest[b], rest[c]].some((card) => card.rank === hole[0].rank)) hits++
      }
  t.is(flops, 19_600)
  t.is(hits, 2_304)
  t.is(MISSES_PER_HIT, (flops - hits) / hits)
})

test('the post rounds the price to seven and a half, and the stack to 26 big blinds', (t) => {
  t.is(MISSES_PER_HIT.toFixed(1), '7.5')
  t.is(SET_MINE_RAISE_BB, 3)
  t.is(Math.ceil(SET_MINE_STACK_BB), 26)
})

test('each count is the last hand the starting stack covers the call', (t) => {
  for (const { deep, ladder } of SET_MINE_TABLES) {
    for (const row of [deep, ladder]) {
      const depth = (hand: number) => row.stack / blindsAt(row.table, hand).bigBlind
      t.true(depth(row.hands - 1) >= SET_MINE_STACK_BB, row.table.id)
      t.true(depth(row.hands) < SET_MINE_STACK_BB, row.table.id)
    }
  }
})

test('the ranges and the ratio the post states', (t) => {
  const deep = SET_MINE_TABLES.map((r) => r.deep.hands)
  const ladder = SET_MINE_TABLES.map((r) => r.ladder.hands)
  t.deepEqual([Math.min(...deep), Math.max(...deep)], [60, 84])
  t.deepEqual([Math.min(...ladder), Math.max(...ladder)], [18, 20])
  for (const { deep, ladder } of SET_MINE_TABLES) {
    t.true(deep.hands >= 3 * ladder.hands, deep.table.id)
    t.is(deep.stack, 3 * ladder.stack, deep.table.id)
    t.is(deep.table.bigBlind, ladder.table.bigBlind, deep.table.id)
    t.is(deep.table.handsPerLevel, 12, deep.table.id)
  }
})
