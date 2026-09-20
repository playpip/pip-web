// Five-Card Draw: a street that is not a betting round.
//
// Every other variant in here changes what the cards mean. This one changes the
// *shape of a hand* — there is no board, there are two betting rounds instead
// of four, and between them every player still in gets a turn that has nothing
// to do with chips. That is the first time this engine's turn loop has had to
// do something other than take a bet, and the ways it can go wrong are quiet
// ones:
//
//   - an all-in player skipped in the draw round, so they show down the five
//     they were dealt after paying to see more;
//   - a repeated index in the discard list, throwing one card and drawing two,
//     which leaks the deck;
//   - the round ending when the *betting* round would have ended rather than
//     when everybody has drawn.
//
// None of those throw. They just deal somebody the wrong hand.

import test from 'ava'
import { type HandState, applyAction, legalActions, potSize, startHand } from '@/lib/poker/engine'
import { decideDiscard } from '@/lib/poker/ai/draw'
import { HOLE_CARDS, evaluateHand } from '@/lib/poker/handEval'
import { cardFromString, createDeck, mulberry32, shuffle, type Card } from '@/lib/poker/cards'

const hand = (spec: string): Card[] => spec.split(' ').map(cardFromString)

function table(seats = 3, deck?: Card[]) {
  return startHand({
    seats: Array.from({ length: seats }, (_, i) => ({ id: `p${i}`, name: `P${i}`, stack: 1_000 })),
    buttonIndex: 0,
    smallBlind: 10,
    bigBlind: 20,
    deck: deck ?? shuffle(createDeck(), mulberry32(4)),
    variant: 'draw',
  })
}

/** Call/check every betting decision; discard nothing in the draw round. */
function playOut(state: HandState, discard: () => number[] = () => []): HandState {
  let guard = 0
  while (state.street !== 'complete' && guard++ < 200) {
    const legal = legalActions(state)
    if (!legal) break
    state = legal.canDraw
      ? applyAction(state, { type: 'draw', discard: discard() })
      : applyAction(state, legal.canCheck ? { type: 'check' } : { type: 'call' })
  }
  return state
}

// --- the shape of a hand -----------------------------------------------------

test('everybody is dealt five cards and there is no board', (t) => {
  const state = table()
  t.is(HOLE_CARDS.draw, 5)
  for (const p of state.players) t.is(p.hole.length, 5)
  t.is(state.community.length, 0)
})

test('the streets are bet, draw, bet, show', (t) => {
  const seen: string[] = []
  let state = table()
  let guard = 0
  while (state.street !== 'complete' && guard++ < 200) {
    if (seen[seen.length - 1] !== state.street) seen.push(state.street)
    const legal = legalActions(state)
    if (!legal) break
    state = legal.canDraw
      ? applyAction(state, { type: 'draw', discard: [] })
      : applyAction(state, legal.canCheck ? { type: 'check' } : { type: 'call' })
  }
  t.deepEqual(seen, ['preflop', 'draw', 'postdraw'])
  // And no board street ever appeared, which is the other half of the claim.
  for (const street of ['flop', 'turn', 'river']) t.false(seen.includes(street))
})

test('the board stays empty all the way to the showdown', (t) => {
  const state = playOut(table())
  t.is(state.community.length, 0)
  t.truthy(state.result)
})

// --- the draw round ----------------------------------------------------------

test('the draw round offers discarding and nothing else', (t) => {
  let state = table()
  while (state.street === 'preflop') {
    const legal = legalActions(state)
    if (!legal) break
    state = applyAction(state, legal.canCheck ? { type: 'check' } : { type: 'call' })
  }
  t.is(state.street, 'draw')
  const legal = legalActions(state)
  t.truthy(legal)
  t.true(legal?.canDraw)
  t.is(legal?.maxDiscards, 5)
  // A screen that offered any of these would be offering something the engine
  // refuses, which is a dead click.
  t.false(legal?.canFold)
  t.false(legal?.canCheck)
  t.false(legal?.canCall)
  t.false(legal?.canBet)
  t.false(legal?.canRaise)
})

test('betting during the draw round is refused', (t) => {
  let state = table()
  while (state.street === 'preflop') {
    const legal = legalActions(state)
    if (!legal) break
    state = applyAction(state, legal.canCheck ? { type: 'check' } : { type: 'call' })
  }
  t.is(state.street, 'draw')
  t.throws(() => applyAction(state, { type: 'fold' }))
  t.throws(() => applyAction(state, { type: 'bet', amount: 100 }))
})

test('drawing outside the draw round is refused', (t) => {
  const state = table()
  t.is(state.street, 'preflop')
  t.throws(() => applyAction(state, { type: 'draw', discard: [0] }))
})

test('standing pat keeps the exact five you had', (t) => {
  let state = table()
  while (state.street === 'preflop') {
    const legal = legalActions(state)
    if (!legal) break
    state = applyAction(state, legal.canCheck ? { type: 'check' } : { type: 'call' })
  }
  const before = state.players[state.toActIndex].hole.map((c) => `${c.rank}${c.suit}`)
  const id = state.players[state.toActIndex].id
  const after = applyAction(state, { type: 'draw', discard: [] })
  const now = after.players.find((p) => p.id === id)!.hole.map((c) => `${c.rank}${c.suit}`)
  t.deepEqual(now, before)
})

test('discarding replaces exactly what you threw, and keeps the rest', (t) => {
  let state = table()
  while (state.street === 'preflop') {
    const legal = legalActions(state)
    if (!legal) break
    state = applyAction(state, legal.canCheck ? { type: 'check' } : { type: 'call' })
  }
  const actor = state.players[state.toActIndex]
  const id = actor.id
  const kept = [actor.hole[1], actor.hole[3], actor.hole[4]].map((c) => `${c.rank}${c.suit}`)

  const after = applyAction(state, { type: 'draw', discard: [0, 2] })
  const now = after.players.find((p) => p.id === id)!
  t.is(now.hole.length, 5, 'the hand changed size')
  // The three untouched cards are still there, still in order.
  t.deepEqual(
    now.hole.slice(0, 3).map((c) => `${c.rank}${c.suit}`),
    kept,
  )
})

test('a repeated or out-of-range index cannot leak the deck', (t) => {
  // The indices come off a screen. `[0, 0, 9, -1]` must throw away one card
  // and draw one, not throw one and draw four.
  let state = table()
  while (state.street === 'preflop') {
    const legal = legalActions(state)
    if (!legal) break
    state = applyAction(state, legal.canCheck ? { type: 'check' } : { type: 'call' })
  }
  const id = state.players[state.toActIndex].id
  const deckBefore = state.deck.length
  const after = applyAction(state, { type: 'draw', discard: [0, 0, 9, -1, 0] })
  t.is(after.players.find((p) => p.id === id)!.hole.length, 5)
  t.is(deckBefore - after.deck.length, 1, 'the deck moved by more than one card')
})

test('everybody still in gets exactly one turn in the draw round', (t) => {
  let state = table(4)
  while (state.street === 'preflop') {
    const legal = legalActions(state)
    if (!legal) break
    state = applyAction(state, legal.canCheck ? { type: 'check' } : { type: 'call' })
  }
  const drawers = new Set<string>()
  while (state.street === 'draw') {
    const id = state.players[state.toActIndex].id
    t.false(drawers.has(id), `${id} was asked to draw twice`)
    drawers.add(id)
    state = applyAction(state, { type: 'draw', discard: [] })
  }
  t.is(drawers.size, 4)
  t.is(state.street, 'postdraw')
})

// --- the deck ----------------------------------------------------------------

test('five seats drawing five each cannot exhaust the deck', (t) => {
  // 25 dealt + 25 replacements = 50, against 52. This is the arithmetic the
  // five-seat cap rests on, so it is asserted rather than assumed — a six-seat
  // draw table would need 60 and `applyAction` would throw mid-hand.
  let state = table(5)
  while (state.street === 'preflop') {
    const legal = legalActions(state)
    if (!legal) break
    state = applyAction(state, legal.canCheck ? { type: 'check' } : { type: 'call' })
  }
  t.is(state.deck.length, 52 - 25)
  while (state.street === 'draw') {
    state = applyAction(state, { type: 'draw', discard: [0, 1, 2, 3, 4] })
  }
  t.true(state.deck.length >= 0)
  for (const p of state.players) t.is(p.hole.length, 5)
})

test('a hand never deals the same card twice', (t) => {
  for (let seed = 0; seed < 40; seed++) {
    const state = playOut(table(5, shuffle(createDeck(), mulberry32(seed))), () => [0, 1, 2])
    const dealt = state.players.flatMap((p) => p.hole.map((c) => `${c.rank}${c.suit}`))
    t.is(new Set(dealt).size, dealt.length, `seed ${seed}: a duplicate card reached a hand`)
  }
})

// --- the money ---------------------------------------------------------------

test('the pot still balances across a draw hand', (t) => {
  for (let seed = 0; seed < 60; seed++) {
    const state = playOut(table(4, shuffle(createDeck(), mulberry32(seed))), () => [0, 1])
    if (!state.result) continue
    const paidIn = state.players.reduce((sum, p) => sum + p.committedThisHand, 0)
    const paidOut = Object.values(state.result.payouts).reduce((sum, n) => sum + n, 0)
    t.is(paidOut, paidIn, `seed ${seed}: the pot did not balance`)
    t.is(
      state.players.reduce((sum, p) => sum + p.stack, 0),
      4_000,
      `seed ${seed}: chips appeared or vanished`,
    )
  }
})

test('the draw round moves no chips', (t) => {
  let state = table(3)
  while (state.street === 'preflop') {
    const legal = legalActions(state)
    if (!legal) break
    state = applyAction(state, legal.canCheck ? { type: 'check' } : { type: 'call' })
  }
  const potBefore = potSize(state)
  while (state.street === 'draw') {
    state = applyAction(state, { type: 'draw', discard: [0, 1, 2] })
  }
  t.is(potSize(state), potBefore)
})

// --- the showdown ------------------------------------------------------------

test('a draw showdown reads five cards and no board', (t) => {
  const five = hand('Ah Kh Qh Jh Th')
  t.is(evaluateHand(five, [], 'draw').description, 'Royal Flush')
  t.is(evaluateHand(hand('2h 2d 9s 9c Ah'), [], 'draw').name, 'Two Pair')
})

// --- the discard policy ------------------------------------------------------

const discard = (spec: string) => decideDiscard(hand(spec), mulberry32(1))

test('a made hand stands pat', (t) => {
  t.deepEqual(discard('Ah Kh Qh Jh Th'), [], 'broke a royal flush')
  t.deepEqual(discard('2h 3d 4s 5c 6h'), [], 'broke a straight')
  t.deepEqual(discard('9h 9d 9s 2c 2h'), [], 'broke a full house')
})

test('it keeps four to a flush and throws the odd card', (t) => {
  // Four hearts and a stray club: one card, nine outs.
  t.deepEqual(discard('Ah Kh 7h 2h 9c'), [4])
})

test('it keeps a pair over nothing, and draws three', (t) => {
  const kept = discard('9h 9d 2s 5c Kh')
  t.is(kept.length, 3)
  t.false(kept.includes(0))
  t.false(kept.includes(1), 'it broke the pair')
})

test('two pair draws one', (t) => {
  t.deepEqual(discard('9h 9d 4s 4c Kh'), [4])
})

test('trips draws two', (t) => {
  const kept = discard('9h 9d 9s 4c Kh')
  t.deepEqual(kept.sort(), [3, 4])
})

test('nothing at all keeps an ace, or throws the lot', (t) => {
  t.deepEqual(discard('Ah Kd 8s 4c 2h').sort(), [1, 2, 3, 4], 'it did not keep the ace')
  t.deepEqual(discard('Qh Jd 8s 4c 2h').sort(), [0, 1, 2, 3, 4], 'it kept queen-high')
})

test('the policy always returns indices it is allowed to discard', (t) => {
  // Fuzzed, because the one thing that would be catastrophic is an index the
  // engine then refuses or silently drops.
  for (let seed = 0; seed < 300; seed++) {
    const rng = mulberry32(seed)
    const five = shuffle(createDeck(), rng).slice(0, 5)
    const out = decideDiscard(five, rng)
    t.is(new Set(out).size, out.length, `seed ${seed}: a repeated index`)
    for (const i of out) t.true(i >= 0 && i < 5, `seed ${seed}: index ${i} out of range`)
  }
})
