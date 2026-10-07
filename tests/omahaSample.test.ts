import { readFileSync } from 'node:fs'
import test from 'ava'
import { rosterFor } from '@/config/cast'
import { BIG_POT } from '@/config/venues'
import { omahaSample } from '@/lib/membership/omahaSample'
import { type Card, cardToString } from '@/lib/poker/cards'

// The Omaha showdown on `/membership?for=omaha` (playpip/cmo#180). The cards
// are typed, so this holds what the page says about them to the evaluator: the
// lesson is "a flush in Hold'em, nothing in Omaha", and if the rules or the
// evaluator ever disagreed, the page would be teaching the wrong game.
//
// What this cannot cover: how four cards a side sit on a phone's felt, and
// whether the rings read. That needs somebody to open the page.

const keys = (cards: readonly Card[]) => new Set(cards.map(cardToString))

test('the hand teaches exactly two: a flush in Hold’em, ace high in Omaha', (t) => {
  const s = omahaSample()
  t.is(s.holdemPhrase, 'a flush')
  t.is(s.hero.phrase, 'ace high')
  t.is(s.them.phrase, 'a pair of kings')
  t.is(s.winner, 'them')
})

test('the five that play are two from the hand and three from the board, on both sides', (t) => {
  const s = omahaSample()
  const board = keys(s.board)
  for (const side of [s.hero, s.them]) {
    t.is(side.plays.length, 5)
    const hole = keys(side.cards)
    t.is(side.plays.filter((c) => hole.has(cardToString(c))).length, 2)
    t.is(side.plays.filter((c) => board.has(cardToString(c))).length, 3)
  }
})

test('no card is dealt twice', (t) => {
  const s = omahaSample()
  const all = [...s.board, ...s.hero.cards, ...s.them.cards].map(cardToString)
  t.is(new Set(all).size, 13)
})

test('the opponent is a regular at The Big Pot', (t) => {
  t.truthy(rosterFor(BIG_POT)[0]?.name)
})

test('only a tap on Omaha loads the showdown, and only on the client', (t) => {
  const source = readFileSync(
    new URL('../src/components/membership/TappedFor.tsx', import.meta.url),
    'utf-8',
  )
  t.regex(source, /feature\.id === 'omaha' && <TappedOmaha \/>/)
  t.regex(source, /import\('\.\/TappedOmaha'\)[\s\S]*?ssr: false/)
})
