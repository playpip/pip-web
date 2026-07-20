import test from 'ava'
import { cardFromString } from '@/lib/poker/cards'
import { holeKey, nicknameFor } from '@/config/handNames'

const hole = (a: string, b: string) => [cardFromString(a), cardFromString(b)]

test('holeKey canonicalises rank order, pairs and suitedness', (t) => {
  t.is(holeKey(hole('Ah', 'Kh')), 'AKs')
  t.is(holeKey(hole('Kh', 'Ad')), 'AKo') // low card first in, high rank out
  t.is(holeKey(hole('8c', '8d')), '88')
  t.is(holeKey(hole('2s', '7d')), '72o')
  t.is(holeKey([cardFromString('Ah')]), null)
})

test('named hands resolve regardless of order or suits', (t) => {
  t.is(nicknameFor(hole('8h', '8s')), 'Snowmen')
  t.is(nicknameFor(hole('Kd', 'Ac')), 'Big Slick')
  t.is(nicknameFor(hole('Ac', 'Ad')), 'Pocket Rockets')
  t.is(nicknameFor(hole('5c', 'Jh')), 'Motown')
  t.is(nicknameFor(hole('7d', 'Qs')), 'The Computer Hand')
  // non-pair names whose ranks read low-first still resolve (keys are high-first)
  t.is(nicknameFor(hole('5c', '7h')), 'The Heinz')
  t.is(nicknameFor(hole('3d', '9s')), 'Jack Benny')
})

test('suffixed names apply to only that variant', (t) => {
  t.is(nicknameFor(hole('7c', '2d')), 'The Hammer') // offsuit — the classic
  t.is(nicknameFor(hole('7c', '2c')), null) // suited 7-2 has no folk name
})

test('most hands have no name', (t) => {
  t.is(nicknameFor(hole('9c', '4d')), null)
  t.is(nicknameFor(hole('Ac', '3d')), null)
})
