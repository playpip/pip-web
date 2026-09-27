// Short Deck's two non-standard rules, and the deck they come from.
//
// This file exists because pokersolver cannot rank short deck and does not say
// so — ask it and it puts a full house over a flush, confidently, and reads
// A-9-8-7-6 as ace-high nothing. Both are silent wrong answers at a showdown,
// which is the worst shape a bug can have in this app: no error, no crash, just
// the wrong player scooping and a hand history that looks fine.
//
// So the ranking is ours (src/lib/poker/shortDeck.ts) and the proof is here.

import test from 'ava'
import { cardFromString } from '@/lib/poker/cards'
import { SHORT_DECK_RANKS, createDeck } from '@/lib/poker/cards'
import { compareShortDeck, evaluateShortDeck } from '@/lib/poker/shortDeck'
import { DECK_RANKS, determineWinners, evaluateHand } from '@/lib/poker/handEval'

const hand = (spec: string) => spec.split(' ').map(cardFromString)
const score = (spec: string) => evaluateShortDeck(hand(spec)).score
const beats = (a: string, b: string) => compareShortDeck(score(a), score(b)) > 0

// --- the deck ----------------------------------------------------------------

test('the short deck is thirty-six cards, six to ace', (t) => {
  const deck = createDeck(SHORT_DECK_RANKS)
  t.is(deck.length, 36)
  t.is(new Set(deck.map((c) => `${c.rank}${c.suit}`)).size, 36, 'a card is in there twice')
  for (const low of ['2', '3', '4', '5']) {
    t.false(
      deck.some((c) => c.rank === low),
      `a ${low} survived the strip`,
    )
  }
  for (const rank of SHORT_DECK_RANKS) {
    t.is(deck.filter((c) => c.rank === rank).length, 4, `${rank} is not four-suited`)
  }
})

test('the variant map hands out the short deck and leaves the others alone', (t) => {
  t.is(DECK_RANKS.shortdeck.length, 9)
  t.is(DECK_RANKS.holdem.length, 13)
  t.is(DECK_RANKS.omaha.length, 13)
})

// --- rule one: a flush beats a full house ------------------------------------

test('a flush beats a full house', (t) => {
  // The rule everyone knows about short deck, and the one a general evaluator
  // gets backwards. Nine of each suit instead of thirteen makes flushes rarer
  // while full houses stay put, so the standard order stops matching the odds.
  t.true(beats('6h 8h Th Qh Ah', 'As Ad Ac Ks Kd'), 'a flush lost to aces full')
  t.false(beats('As Ad Ac Ks Kd', '6h 8h Th Qh Ah'), 'the boat was ranked over the flush')
})

test('the rest of the order is the usual one', (t) => {
  const ladder = [
    '6h 8d Ts Jc Ah', // high card
    '6h 6d Ts Jc Ah', // pair
    '6h 6d Ts Tc Ah', // two pair
    '6h 6d 6s Tc Ah', // trips
    '6h 7d 8s 9c Th', // straight
    '6h 6d 6s Tc Th', // full house
    '6h 8h Th Qh Ah', // flush          ← promoted
    '6h 6d 6s 6c Ah', // quads
    '6h 7h 8h 9h Th', // straight flush
  ]
  for (let i = 1; i < ladder.length; i++) {
    t.true(beats(ladder[i], ladder[i - 1]), `${ladder[i]} does not beat ${ladder[i - 1]}`)
  }
})

// --- rule two: the ace plays below the six -----------------------------------

test('A-6-7-8-9 is a straight, and it is nine-high', (t) => {
  const wheel = evaluateShortDeck(hand('Ah 6d 7s 8c 9h'))
  t.is(wheel.name, 'Straight')
  t.is(wheel.description, 'Straight, 9 High')

  // The half that actually loses a pot: scored as ace-high it would beat a real
  // ten-high straight, which is the opposite of the truth.
  t.true(beats('6h 7d 8s 9c Th', 'Ah 6d 7s 8c 9h'), 'the wheel outranked a ten-high straight')
  t.true(beats('Ah 6d 7s 8c 9h', 'Kh Kd 6s Qc Jh'), 'the wheel lost to a pair of kings')
})

test('the ace still plays high in the other straight', (t) => {
  const broadway = evaluateShortDeck(hand('Th Jd Qs Kc Ah'))
  t.is(broadway.description, 'Straight, A High')
  t.true(beats('Th Jd Qs Kc Ah', '9h Td Js Qc Kh'))
})

test('the wheel in one suit is a straight flush, not a royal', (t) => {
  const h = evaluateShortDeck(hand('Ah 6h 7h 8h 9h'))
  t.is(h.name, 'Straight Flush')
  t.is(h.description, 'Straight Flush, 9 High')
  t.true(beats('Th Jh Qh Kh Ah', 'Ah 6h 7h 8h 9h'), 'the wheel flush beat a royal')
})

test('an ace with a gap is not a straight', (t) => {
  // The failure mode of a lazy wheel check: A-6-7-8-T is nothing.
  t.is(evaluateShortDeck(hand('Ah 6d 7s 8c Th')).name, 'High Card')
})

// --- picking the best five out of seven --------------------------------------

test('it finds the best five of seven', (t) => {
  // Five hearts and a set of sixes in the same seven cards. Note this is not
  // where the promotion shows up and cannot be: a seven-card holding can never
  // be both a flush and a full house, because five cards of one suit are five
  // different ranks and the two spare cards can only pair two of them. The
  // promotion only ever decides a hand *between players*, which is the
  // showdown test below.
  const h = evaluateShortDeck(hand('6h 9h Kh Qh Th 6d 6s'))
  t.is(h.name, 'Flush')
  t.is(h.cards.length, 5)
  t.true(
    h.cards.every((c) => c.suit === 'h'),
    'the five it returned are not all hearts',
  )
})

test('the five it returns are the five it scored', (t) => {
  const h = evaluateShortDeck(hand('6h 7d 8s 9c Th Ad Kd'))
  t.is(h.description, 'Straight, 10 High')
  t.deepEqual(
    h.cards.map((c) => `${c.rank}${c.suit}`),
    ['Th', '9c', '8s', '7d', '6h'],
  )
})

test('the wheel puts its ace last, because that is where it plays', (t) => {
  const h = evaluateShortDeck(hand('Ah 6d 7s 8c 9h'))
  t.is(h.cards[0].rank, '9')
  t.is(h.cards[4].rank, 'A')
})

// --- through the engine's own seam -------------------------------------------

test('evaluateHand routes short deck away from pokersolver', (t) => {
  // Same seven cards, two variants, two different right answers. The wheel is
  // the cleanest demonstration: pokersolver looks for A-2-3-4-5, finds nothing,
  // and calls it ace high. If this ever agrees, short deck has quietly been
  // handed back to the library.
  const hole = hand('Ah 6d')
  const board = hand('7s 8c 9h Kd Qs')
  t.is(evaluateHand(hole, board, 'shortdeck').name, 'Straight')
  t.is(evaluateHand(hole, board, 'holdem').name, 'High Card')
})

test('a short-deck showdown is settled on the short-deck order', (t) => {
  // Three sixes and two hearts on the board. One player fills a flush, the
  // other fills sixes full of tens — the one comparison the promotion decides.
  const board = hand('6h 9h Qh 6d 6s')
  const flush = { id: 'flush', hole: hand('Kh Th') }
  const boat = { id: 'boat', hole: hand('Ts Td') }

  t.deepEqual(determineWinners([flush, boat], board, 'shortdeck').winners, ['flush'])
  // And the same two hands the other way round under Hold'em rules, which is
  // the proof that the variant is doing the work rather than the cards.
  t.deepEqual(determineWinners([flush, boat], board, 'holdem').winners, ['boat'])
})

test('two identical short-deck hands split', (t) => {
  const board = hand('6h 7d 8s 9c Th')
  const a = { id: 'a', hole: hand('Ad Kd') }
  const b = { id: 'b', hole: hand('As Ks') }
  const { winners } = determineWinners([a, b], board, 'shortdeck')
  t.deepEqual([...winners].sort(), ['a', 'b'], 'the board straight did not chop')
})

test('short-deck hands carry their best five for the table to show', (t) => {
  const h = evaluateHand(hand('Kh Th'), hand('6h 9h Qh 6d 6s'), 'shortdeck')
  t.is(h.best.length, 5)
  t.falsy(h.solved, 'a short-deck hand came back with a pokersolver hand attached')
})

// --- the comparator ----------------------------------------------------------

test('comparing is transitive across the whole ladder', (t) => {
  // Cheap guard against a tiebreaker that sorts one pair correctly and another
  // pair backwards, which is the way a hand-rolled comparator usually breaks.
  const hands = [
    '6h 8d Ts Jc Ah',
    '6h 6d Ts Jc Ah',
    '6h 6d Ts Tc Ah',
    '6h 6d 6s Tc Ah',
    'Ah 6d 7s 8c 9h',
    '6h 7d 8s 9c Th',
    '6h 6d 6s Tc Th',
    '6h 8h Th Qh Ah',
    '6h 6d 6s 6c Ah',
    '6h 7h 8h 9h Th',
  ]
  const sorted = [...hands].sort((a, b) => compareShortDeck(score(a), score(b)))
  t.deepEqual(sorted, hands, 'the ladder does not sort into its own order')
})
