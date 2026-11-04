// Mystery Card: Hold'em where one of your two hole cards stays face down, to
// you as well, until the river is dealt.
//
// The rule is only worth anything if nobody can peek, the AI included, so most
// of this file is about that: the card is not in `hole` before the river, and
// swapping it for any other card changes nothing an AI or the win % decides.
// Then the flip, and the showdown that reads both cards.

import test from 'ava'
import { type Card, cardFromString, cardToString, mulberry32 } from '@/lib/poker/cards'
import { decideAction } from '@/lib/poker/ai/policy'
import { applyAction, type HandState, isHandComplete, startHand } from '@/lib/poker/engine'
import { heroEquity } from '@/lib/poker/heroEquity'
import { ALL_VENUES, cashOutValue, houseStack, MYSTERY_TABLE, venueById } from '@/config/venues'
import { makeDeck } from './helpers'

const seats = (n: number, stack = 1_000) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `p${i}`, stack }))

const key = (c: Card) => cardToString(c)

/** Check or call until the hand reaches `street` (or ends). */
function callDownTo(state: HandState, street: HandState['street']): HandState {
  let s = state
  const order = ['preflop', 'flop', 'turn', 'river', 'showdown', 'complete']
  while (!isHandComplete(s) && order.indexOf(s.street) < order.indexOf(street)) {
    const p = s.players[s.toActIndex]
    s = applyAction(s, { type: s.currentBet > p.committedThisStreet ? 'call' : 'check' })
  }
  return s
}

test('each player holds one card they can see and one set aside face down', (t) => {
  const s = startHand({
    seats: seats(6),
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    rng: mulberry32(1),
    mystery: true,
  })
  t.true(s.mystery)
  const all: string[] = []
  for (const p of s.players) {
    t.is(p.hole.length, 1, `${p.id} can see more than one card`)
    t.truthy(p.mystery, `${p.id} has no face-down card`)
    all.push(key(p.hole[0]), key(p.mystery as Card))
  }
  t.is(new Set(all).size, 12, 'a card was dealt twice')
  t.is(s.deck.length, 52 - 12)
})

test('an ordinary table never sets a card aside', (t) => {
  const s = startHand({ seats: seats(4), buttonIndex: 0, smallBlind: 5, bigBlind: 10 })
  t.falsy(s.mystery)
  for (const p of s.players) {
    t.is(p.hole.length, 2)
    t.is(p.mystery, undefined)
  }
})

test('the face-down card is not in any hole before the river', (t) => {
  // Two players, deck in deal order: p0 Ah, p1 Kh, then the face-down 2c, 3d.
  const deck = makeDeck(['Ah', 'Kh', '2c', '3d', '7s', '8s', '9d', 'Tc', 'Jd'])
  let s = startHand({
    seats: seats(2),
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    deck,
    mystery: true,
  })
  for (const street of ['flop', 'turn'] as const) {
    s = callDownTo(s, street)
    t.is(s.street, street)
    t.deepEqual(s.players[0].hole.map(key), ['Ah'])
    t.deepEqual(s.players[1].hole.map(key), ['Kh'])
    t.false(JSON.stringify(s.players.map((p) => p.hole)).includes('"2"'), 'the 2c leaked')
  }
})

test('the face-down cards turn over as the river lands', (t) => {
  const deck = makeDeck(['Ah', 'Kh', '2c', '3d', '7s', '8s', '9d', 'Tc', 'Jd'])
  let s = startHand({
    seats: seats(2),
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    deck,
    mystery: true,
  })
  s = callDownTo(s, 'river')
  t.is(s.street, 'river')
  t.deepEqual(s.players[0].hole.map(key), ['Ah', '2c'])
  t.deepEqual(s.players[1].hole.map(key), ['Kh', '3d'])
  t.is(s.players[0].mystery, undefined)
  t.is(s.players[1].mystery, undefined)
})

test('a folded hand keeps its card face down, even after the river', (t) => {
  let s = startHand({
    seats: seats(3),
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    rng: mulberry32(4),
    mystery: true,
  })
  // p0 is under the gun three-handed: fold, and the other two check it down.
  const folder = s.players[s.toActIndex]
  s = applyAction(s, { type: 'fold' })
  s = callDownTo(s, 'complete')
  const after = s.players.find((p) => p.id === folder.id)!
  t.is(after.hole.length, 1)
  t.truthy(after.mystery)
  for (const p of s.players.filter((p) => p.id !== folder.id)) t.is(p.hole.length, 2)
})

test('the showdown reads the face-down card', (t) => {
  // p0 sees Ah with a face-down Ad; p1 sees Kh with a face-down 2c. The board
  // pairs the king, so on the cards anybody could see p1 is ahead. Only the
  // face-down ace wins it for p0.
  const deck = makeDeck(['Ah', 'Kh', 'Ad', '2c', 'Ks', '7d', '9c', '4s', 'Jh'])
  let s = startHand({
    seats: seats(2),
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    deck,
    mystery: true,
  })
  s = callDownTo(s, 'complete')
  t.true(s.result?.showdown)
  t.deepEqual(Object.keys(s.result!.payouts), ['p0'])
  t.regex(s.result!.evaluations!.p0.name, /Pair/)
})

test('an all-in before the flop runs out and flips both cards for the showdown', (t) => {
  const deck = makeDeck(['7h', 'Kh', '7d', '2c', 'Ks', '3d', '9c', '4s', 'Jh'])
  let s = startHand({
    seats: seats(2, 100),
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    deck,
    mystery: true,
  })
  s = applyAction(s, { type: 'raise', amount: 100 })
  s = applyAction(s, { type: 'call' })
  t.true(isHandComplete(s))
  t.is(s.community.length, 5)
  t.deepEqual(s.players[0].hole.map(key), ['7h', '7d'])
  t.deepEqual(s.players[1].hole.map(key), ['Kh', '2c'])
  // Kings (Kh + Ks on board) beat sevens.
  t.deepEqual(Object.keys(s.result!.payouts), ['p1'])
  t.is(s.players[0].stack + s.players[1].stack, 200)
})

/** The same spot with the face-down card of the player to act swapped for another unseen one. */
function withOtherMystery(s: HandState): HandState | null {
  const copy = structuredClone(s)
  const me = copy.players[copy.toActIndex]
  if (!me.mystery) return null
  const swap = copy.deck.findIndex((c) => key(c) !== key(me.mystery as Card))
  const [other] = copy.deck.splice(swap, 1)
  copy.deck.push(me.mystery)
  me.mystery = other
  return copy
}

test('an AI decides the same whatever its face-down card is', (t) => {
  // The AI sees `state`, so the proof that it never peeks is that its choice,
  // draw for draw from the same rng, does not move when the card does.
  const venue = venueById('cardroom')!
  const profile = { ...venue.ai, iterations: 120 }
  let compared = 0
  for (let hand = 0; hand < 30; hand++) {
    let s = startHand({
      seats: seats(6),
      buttonIndex: hand % 6,
      smallBlind: 10,
      bigBlind: 20,
      rng: mulberry32(100 + hand),
      mystery: true,
    })
    const play = mulberry32(900 + hand)
    while (!isHandComplete(s)) {
      const swapped = s.street !== 'river' ? withOtherMystery(s) : null
      const seed = Math.floor(play() * 1e9)
      const action = decideAction(s, profile, mulberry32(seed))
      if (swapped) {
        t.deepEqual(decideAction(swapped, profile, mulberry32(seed)), action)
        compared++
      }
      s = applyAction(s, action)
    }
  }
  t.true(compared > 100, `only ${compared} spots compared`)
})

test("the player's win % reads only the card they can see", (t) => {
  const deck = makeDeck(['Ah', 'Kh', '2c', '3d', '7s', '8s', '9d', 'Tc', 'Jd'])
  const s = startHand({
    seats: seats(2),
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    deck,
    mystery: true,
  })
  const hero = s.players[0].id
  const a = heroEquity(s, hero, mulberry32(7))
  const swapped = structuredClone(s)
  swapped.players[0].mystery = cardFromString('As')
  t.is(heroEquity(swapped, hero, mulberry32(7)), a)
  t.truthy(a !== null && a > 0 && a < 1)
})

test('chips add up and every AI action is legal over many mystery hands', (t) => {
  const venue = venueById('poolhall')!
  const profile = { ...venue.ai, iterations: 60 }
  const rng = mulberry32(42)
  for (let hand = 0; hand < 40; hand++) {
    let s = startHand({
      seats: seats(6, 300),
      buttonIndex: hand % 6,
      smallBlind: 10,
      bigBlind: 20,
      rng,
      mystery: true,
    })
    while (!isHandComplete(s)) s = applyAction(s, decideAction(s, profile, rng))
    t.is(
      s.players.reduce((sum, p) => sum + p.stack, 0),
      1_800,
    )
    if (s.result?.showdown) {
      for (const id of Object.keys(s.result.evaluations ?? {})) {
        t.is(s.players.find((p) => p.id === id)!.hole.length, 2)
      }
    }
  }
})

test('the Mystery Card table deals the rule and pays nothing either way', (t) => {
  t.true(MYSTERY_TABLE.mystery)
  t.true(MYSTERY_TABLE.membersOnly)
  t.is(MYSTERY_TABLE.buyIn, 0)
  t.is(MYSTERY_TABLE.prize, 0)
  t.true(houseStack(MYSTERY_TABLE))
  t.is(cashOutValue(MYSTERY_TABLE, 5_000), 0)
  t.false(
    ALL_VENUES.some((v) => v.id === MYSTERY_TABLE.id),
    'it has a /play route',
  )
  t.false(
    ALL_VENUES.some((v) => v.mystery),
    'another table deals Mystery Card',
  )
})
