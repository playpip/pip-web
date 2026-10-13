import test from 'ava'
import { cryptoInt, cryptoRng } from '@/lib/cryptoRng'
import { cardToString, shuffledDeck } from '@/lib/poker/cards'
import { startHand } from '@/lib/poker/engine'

test('cryptoRng stays in [0, 1)', (t) => {
  for (let i = 0; i < 10_000; i++) {
    const x = cryptoRng()
    t.true(x >= 0 && x < 1)
  }
})

test('cryptoInt stays in [0, n) and reaches both ends', (t) => {
  const seen = new Set<number>()
  for (let i = 0; i < 2_000; i++) {
    const k = cryptoInt(6)
    t.true(Number.isInteger(k) && k >= 0 && k < 6)
    seen.add(k)
  }
  t.deepEqual([...seen].sort(), [0, 1, 2, 3, 4, 5])
})

test('a cryptoRng shuffle is a full deck, and two of them differ', (t) => {
  const a = shuffledDeck(cryptoRng).map(cardToString)
  const b = shuffledDeck(cryptoRng).map(cardToString)
  t.is(new Set(a).size, 52)
  t.notDeepEqual(a, b)
})

test('startHand deals from the rng it is handed', (t) => {
  const seats = [
    { id: 'a', name: 'A', stack: 1000 },
    { id: 'b', name: 'B', stack: 1000 },
  ]
  let calls = 0
  const counted = () => {
    calls++
    return cryptoRng()
  }
  startHand({ seats, buttonIndex: 0, smallBlind: 5, bigBlind: 10, rng: counted })
  t.true(calls > 0)
})
