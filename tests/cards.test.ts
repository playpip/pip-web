import test from 'ava'
import {
  createDeck,
  shuffle,
  shuffledDeck,
  mulberry32,
  cardToString,
  cardFromString,
} from '@/lib/poker/cards'

test('fresh deck has 52 unique cards', (t) => {
  const deck = createDeck()
  t.is(deck.length, 52)
  const unique = new Set(deck.map(cardToString))
  t.is(unique.size, 52)
})

test('shuffle is deterministic for a given seed', (t) => {
  const a = shuffle(createDeck(), mulberry32(123)).map(cardToString)
  const b = shuffle(createDeck(), mulberry32(123)).map(cardToString)
  t.deepEqual(a, b)
})

test('different seeds produce different orderings', (t) => {
  const a = shuffledDeck(mulberry32(1)).map(cardToString)
  const b = shuffledDeck(mulberry32(2)).map(cardToString)
  t.notDeepEqual(a, b)
})

test('shuffle preserves the full 52-card set', (t) => {
  const shuffled = shuffledDeck(mulberry32(42))
  t.is(new Set(shuffled.map(cardToString)).size, 52)
})

test('card string round-trips', (t) => {
  t.deepEqual(cardFromString('Ah'), { rank: 'A', suit: 'h' })
  t.is(cardToString({ rank: 'T', suit: 'd' }), 'Td')
})
