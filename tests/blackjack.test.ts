// Blackjack's rules, and the one property that matters more than all of them.
//
// This is a table you put chips on, so the test that would embarrass us is not
// "does a natural pay 3:2" — it is "did the stack end up where the arithmetic
// says it should". Every path through the engine moves money: the stake leaves
// on the deal, a double takes another, a split takes another still, a surrender
// hands half back. Five places to get it wrong and no error thrown by any of
// them, because being short a few chips looks exactly like having lost.
//
// So the first section is conservation and the rest is the rule book.
//
// The table is hit-and-stand only (Will, 2026-09-20), so the tests for
// doubling, splitting and surrender went with the code they covered. What is
// left has to be tighter for it: with one decision and one hand there is
// nowhere for a rounding error to hide except in plain sight.

import test from 'ava'
import {
  type BlackjackState,
  deal,
  handNet,
  handValue,
  hit,
  isNatural,
  newGame,
  options,
  stand,
} from '@/lib/blackjack/engine'
import { HOUSE_RULES, houseRulesById } from '@/lib/blackjack/rules'
import { cardFromString, mulberry32, type Card } from '@/lib/poker/cards'

const cards = (spec: string): Card[] => spec.split(' ').map(cardFromString)
const rng = (seed = 7) => mulberry32(seed)
const rules = (id: string) => houseRulesById(id)

/**
 * A game whose next few cards are stacked, so a rule can be tested rather than
 * hunted for. Cards are drawn with `pop()`, so the spec reads in deal order.
 *
 * **The rigged cards sit on top of a full shoe rather than being the whole of
 * it**, and that is not tidiness: a four-card shoe is below the reshuffle
 * threshold, so the first `draw` folds it back together and shuffles the rig
 * away. The first version of this helper did exactly that and eight tests
 * failed for reasons that had nothing to do with the rules they were testing.
 *
 * The filler may duplicate a rigged card, which a real shoe would not. Nothing
 * below depends on the cards after the ones it names.
 */
function rigged(spec: string, houseId = 'standard', stack = 1_000): BlackjackState {
  const game = newGame(rules(houseId), stack, rng())
  return { ...game, shoe: [...game.shoe, ...cards(spec).reverse()] }
}

// --- the money ---------------------------------------------------------------

test('a settled hand moves the stack by exactly what it paid', (t) => {
  // The property, over a long random session rather than one contrived hand.
  // Anything that takes a stake and forgets to hand it back shows up here as a
  // stack that has drifted from the sum of the results.
  let game = newGame(rules('standard'), 10_000, rng(11))
  const r = rng(99)
  let expected = 10_000

  for (let i = 0; i < 400 && game.stack >= 100; i++) {
    game = deal(game, 100, r)
    while (game.phase === 'player') {
      // Crude on purpose: hit under seventeen, stand otherwise. It is not
      // basic strategy and does not need to be — a conservation test wants
      // both branches taken, not played well.
      const value = handValue(game.hand?.cards ?? [])
      game = value.total < 17 ? hit(game, r) : stand(game, r)
    }
    expected += handNet(game)
    t.is(game.stack, expected, `the stack drifted on hand ${i}`)
  }
  t.true(expected !== 10_000, 'the session never resolved a hand')
})

test('sitting down and standing straight back up costs nothing', (t) => {
  const game = newGame(rules('standard'), 2_500, rng())
  t.is(game.stack, 2_500)
  t.is(game.phase, 'idle')
})

test('the stake leaves the stack on the deal, not at the end', (t) => {
  // So the number on screen is always chips you could actually stand up with.
  const game = deal(newGame(rules('standard'), 1_000, rng()), 250, rng())
  t.true(game.stack <= 750, 'the stake is still counted as yours mid-hand')
})

test('a bet larger than the stack is refused rather than quietly shrunk', (t) => {
  const game = newGame(rules('standard'), 100, rng())
  t.throws(() => deal(game, 250, rng()))
  t.throws(() => deal(game, 0, rng()))
})

// --- what a hand is worth ----------------------------------------------------

test('aces count eleven until that busts, then one', (t) => {
  t.deepEqual(handValue(cards('Ah 9d')), { total: 20, soft: true, bust: false })
  t.deepEqual(handValue(cards('Ah 9d 5c')), { total: 15, soft: false, bust: false })
  // Two aces demote one at a time, and three demote twice.
  t.is(handValue(cards('Ah Ad')).total, 12)
  t.is(handValue(cards('Ah Ad Ac 8s')).total, 21)
  t.is(handValue(cards('Kh Qd 5c')).total, 25)
  t.true(handValue(cards('Kh Qd 5c')).bust)
})

test('faces are ten and the rest are themselves', (t) => {
  t.is(handValue(cards('Kh Qd')).total, 20)
  t.is(handValue(cards('Jh Td')).total, 20)
  t.is(handValue(cards('7h 2d')).total, 9)
})

test('a natural is exactly two cards', (t) => {
  t.true(isNatural(cards('Ah Kd')))
  t.true(isNatural(cards('Td Ac')))
  // Twenty-one in three cards is a fine hand and it is not a natural — it pays
  // evens, which the paytable test below pins.
  t.false(isNatural(cards('7h 7d 7s')))
  t.false(isNatural(cards('Kh Qd')))
})

// --- the paytable ------------------------------------------------------------

test('a natural pays what the table says it pays', (t) => {
  // Player Ah Kd, dealer 9c 7s. Same cards, two tables, two payouts — which is
  // the entire difference 6:5 makes and the reason it is on the card.
  for (const [houseId, expected] of [
    ['standard', 100 + 150],
    ['brutal', 100 + 120],
  ] as const) {
    const game = deal(rigged('Ah 9c Kd 7s', houseId), 100, rng())
    t.is(game.phase, 'settled')
    t.is(game.hand?.outcome, 'blackjack')
    t.is(game.hand?.returned, expected, houseId)
  }
})

test('a natural against a natural is a push, not a win', (t) => {
  const game = deal(rigged('Ah Ad Kc Ks'), 100, rng())
  t.is(game.hand?.outcome, 'push')
  t.is(game.hand?.returned, 100)
  t.is(handNet(game), 0)
})

test('a dealer’s natural ends the hand before you can act', (t) => {
  // The rule people expect least. Dealer A-K is turned over immediately, and
  // the player's fourteen never gets the chance to become anything.
  const game = deal(rigged('7h Ad 7d Kc 7s'), 100, rng())
  t.is(game.phase, 'settled', 'the hand carried on past a dealer natural')
  t.is(handValue(game.hand?.cards ?? []).total, 14)
  t.is(game.hand?.outcome, 'lose')
  t.is(game.hand?.returned, 0)
})

test('twenty-one made in three cards is a win, not a blackjack', (t) => {
  // 7-7-7 is twenty-one and beats the dealer's nineteen — but it pays evens,
  // not 3:2. Paying it as a natural is the generous-looking bug that quietly
  // makes the table wrong.
  let game = deal(rigged('7h Kc 7d 9s 7s'), 100, rng())
  while (game.phase === 'player') game = hit(game, rng())
  t.is(handValue(game.hand?.cards ?? []).total, 21)
  t.is(game.hand?.outcome, 'win')
  t.is(game.hand?.returned, 200, 'a made 21 was paid as a natural')
})

test('a bust loses even when the dealer busts too', (t) => {
  let game = deal(rigged('Th 9c 6d 7s 9h Ks'), 100, rng())
  game = hit(game, rng())
  t.true(handValue(game.hand?.cards ?? []).bust)
  t.is(game.hand?.outcome, 'lose')
  t.is(game.hand?.returned, 0)
})

// --- the dealer --------------------------------------------------------------

test('the dealer stands on seventeen, and on soft seventeen where the table says so', (t) => {
  // Dealer A-6 is a soft seventeen. Standard stands; Brutal draws. The player
  // has to stand first, or the dealer has not played yet and both tables look
  // identical — which is how the first version of this test passed twice.
  const stands = stand(deal(rigged('Th Ac 9d 6s 5h', 'standard'), 100, rng()), rng())
  t.is(stands.phase, 'settled')
  t.is(stands.dealer.length, 2, 'the standard table drew to a soft 17')

  const draws = stand(deal(rigged('Th Ac 9d 6s 5h', 'brutal'), 100, rng()), rng())
  t.true(draws.dealer.length > 2, 'the brutal table stood on a soft 17')
})

test('the dealer does not draw when there is nothing left to beat', (t) => {
  // Every player hand busted, so dealing the dealer a runout settles nothing
  // and only invites "it got lucky".
  let game = deal(rigged('Th 9c 6d 7s 9h 2c 3d'), 100, rng())
  game = hit(game, rng())
  t.is(game.phase, 'settled')
  t.true(handValue(game.hand?.cards ?? []).bust)
  t.is(game.dealer.length, 2, 'the dealer drew to a table of busts')
})

// --- the two decisions there are ---------------------------------------------

test('hit and stand are the whole of it', (t) => {
  // The table dropped to two actions on purpose. This is the test that fails
  // if a third ever creeps back in without the edge figures being redone with
  // it — doubling is worth about 1.5% and splitting about 0.6%, and `rules.ts`
  // quotes numbers that assume neither exists.
  const live = deal(rigged('8h 9c 8d 7s 3c 4d'), 100, rng())
  t.deepEqual(options(live), { canHit: true, canStand: true })
  t.deepEqual(Object.keys(options(live)).sort(), ['canHit', 'canStand'])
})

test('a finished hand offers nothing', (t) => {
  const done = stand(deal(rigged('Th 9c 6d 7s 5h'), 100, rng()), rng())
  t.deepEqual(options(done), { canHit: false, canStand: false })
  t.deepEqual(options(newGame(rules('standard'), 500, rng())), {
    canHit: false,
    canStand: false,
  })
})

test('a pair is just a hand worth twice the card', (t) => {
  // Eights are the most-split hand in blackjack and here they are sixteen,
  // which is the worst hand in blackjack. That is the cost of the trade, and
  // it is real — stated here rather than discovered at the table.
  const pair = deal(rigged('8h 9c 8d 7s'), 100, rng())
  t.is(handValue(pair.hand?.cards ?? []).total, 16)
  t.deepEqual(options(pair), { canHit: true, canStand: true })
})

test('twenty-one closes the hand rather than asking again', (t) => {
  // Not a rule so much as a courtesy: nobody hits twenty-one, so the engine
  // does not offer.
  let game = deal(rigged('7h Kc 7d 9s 7s'), 100, rng())
  game = hit(game, rng())
  t.is(handValue(game.hand?.cards ?? []).total, 21)
  t.is(game.phase, 'settled')
})

// --- the shoe ----------------------------------------------------------------

test('the shoe is the number of decks the table says, and it reshuffles', (t) => {
  for (const house of HOUSE_RULES) {
    const game = newGame(house, 1_000, rng())
    t.is(game.shoe.length, house.decks * 52, house.id)
  }

  // Played long enough to exhaust a single deck several times over. If the
  // reshuffle did not fire, drawing throws and this fails loudly.
  let game = newGame(rules('friendly'), 1_000_000, rng(3))
  const r = rng(4)
  for (let i = 0; i < 300; i++) {
    game = deal(game, 10, r)
    while (game.phase === 'player') game = stand(game, r)
  }
  t.true(game.shoe.length > 0)
  t.is(game.shoe.length + game.discards.length, 52, 'cards went missing from the shoe')
})

test('every table states an edge, and brutal is the worst of them', (t) => {
  for (const house of HOUSE_RULES) {
    t.true(house.edgePercent > 0, `${house.id} claims no house edge at all`)
    t.truthy(house.blurb, `${house.id} does not say what it does`)
  }
  const byEdge = [...HOUSE_RULES].sort((a, b) => a.edgePercent - b.edgePercent)
  t.deepEqual(
    byEdge.map((h) => h.id),
    ['friendly', 'standard', 'brutal'],
    'the tables are not ordered by how much they take',
  )
})
