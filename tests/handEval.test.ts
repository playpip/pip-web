import test from 'ava'
import { bestFive, evaluateHand, determineWinners, handPhrase } from '@/lib/poker/handEval'
import { cardToString, cardFromString, type Card } from '@/lib/poker/cards'

const h = (...s: string[]): Card[] => s.map(cardFromString)

const five = (hole: Card[], board: Card[]): string =>
  bestFive(evaluateHand(hole, board)).map(cardToString).join(' ')

test('recognises a flush', (t) => {
  const ev = evaluateHand(h('Ah', 'Kh'), h('2h', '7h', 'Th', '3c', '4d'))
  t.is(ev.name, 'Flush')
})

test('recognises a full house', (t) => {
  const ev = evaluateHand(h('Ah', 'Ad'), h('As', 'Kh', 'Kd', '3c', '4d'))
  t.is(ev.name, 'Full House')
})

test('higher hand wins between two players', (t) => {
  const board = h('2c', '7s', 'Ts', 'Jc', '3d')
  const { winners } = determineWinners(
    [
      { id: 'aces', hole: h('Ah', 'Ad') },
      { id: 'kings', hole: h('Kh', 'Kd') },
    ],
    board,
  )
  t.deepEqual(winners, ['aces'])
})

test('identical hands split (both winners)', (t) => {
  // Board plays a broadway straight; both players just play the board.
  const board = h('Ts', 'Js', 'Qh', 'Kd', 'Ac')
  const { winners } = determineWinners(
    [
      { id: 'p1', hole: h('2c', '3d') },
      { id: 'p2', hole: h('4c', '5d') },
    ],
    board,
  )
  t.is(winners.length, 2)
  t.true(winners.includes('p1') && winners.includes('p2'))
})

// bestFive is what a reveal draws and what tells two same-category hands apart,
// so the shapes that matter are the ones where the solver hands back more than
// five cards. It does that for a six-card flush and for two trips, and both
// stay in their own descending order, which is why the first five are the hand.
test('bestFive is five cards, in the solver’s order, even where more are eligible', (t) => {
  t.is(five(h('9d', '7d'), h('Ad', 'Td', '5h', 'Kd', '4d')), 'Ad Kd Td 9d 7d')
  t.is(five(h('Ks', 'Kd'), h('Ah', 'Ad', 'As', 'Kh', '2c')), 'Ah Ad As Ks Kd')
  t.is(five(h('Ah', 'Kd'), h('As', '7d', '2c', 'Th', '4s')), 'Ah As Kd Th 7d')
})

// The case that makes the slice legal rather than lucky. A full house whose
// trips rank *below* its pair is the one shape where "first five" and "five
// highest" disagree: sorted by rank the aces would lead and the reveal would
// show a pair of aces and a pair of threes. The solver leads with the trips.
test('bestFive keeps the solver’s order when the trips rank below the pair', (t) => {
  t.is(five(h('3s', '3h'), h('3d', 'As', 'Ah', '2c', '4d')), '3s 3h 3d As Ah')
})

// The ace the solver renames to '1' when it plays low. Left as '1' it would be
// an unreadable card face and a rank our own type does not have.
test('bestFive maps a low ace back to an ace', (t) => {
  t.is(five(h('Ac', 'Kh'), h('5h', '4d', '3h', '2d', '9s')), '5h 4d 3h 2d Ac')
})

// bestFive slices, so the overflow itself never reaches a caller through it.
// Anything else reading solved.cards inherits it, and the wrapper's whole
// claim is that the first five are the hand, so assert the raw shape once here
// rather than leaving it as a sentence in a doc comment.
test('the solver overflows past five only where more than five are eligible', (t) => {
  const raw = (hole: Card[], board: Card[]): string =>
    evaluateHand(hole, board)
      .solved.cards.map((c) => c.value + c.suit)
      .join(' ')

  // Six-card flush and two trips: six cards back, hand first.
  t.is(raw(h('9d', '7d'), h('Ad', 'Td', '5h', 'Kd', '4d')), 'Ad Kd Td 9d 7d 4d')
  t.is(raw(h('Ks', 'Kd'), h('Ah', 'Ad', 'As', 'Kh', '2c')), 'Ah Ad As Ks Kd Kh')
  // A six-card straight flush does not overflow: a straight is five or nothing,
  // which is why the doc comment names flushes and full houses and not straights.
  t.is(raw(h('9s', '8s'), h('7s', '6s', '5s', '4s', '2d')), '9s 8s 7s 6s 5s')
  // And the low ace arrives as '1', a rank our Card type does not have.
  t.is(raw(h('Ac', 'Kh'), h('5h', '4d', '3h', '2d', '9s')), '5h 4d 3h 2d 1c')
})

// handPhrase leans on a quirk: a royal flush is *named* "Straight Flush" and
// only the description tells them apart. If descr ever stopped being exactly
// "Royal Flush" the recap and every drill grade would quietly call one a
// straight flush, and no name assertion anywhere would fail.
test('handPhrase tells a royal flush from a straight flush by description alone', (t) => {
  const royal = evaluateHand(h('As', 'Ks'), h('Qs', 'Js', 'Ts', '2c', '3d'))
  t.is(royal.name, 'Straight Flush')
  t.is(royal.description, 'Royal Flush')
  t.is(handPhrase(royal), 'a royal flush')

  const straightFlush = evaluateHand(h('Ks', 'Qs'), h('Js', 'Ts', '9s', '2c', '3d'))
  t.is(straightFlush.name, 'Straight Flush')
  t.is(handPhrase(straightFlush), 'a straight flush')
})

// Every name the solver can return has a phrase, or the caller drops the clause
// rather than shipping "won with undefined". Cheap to state, and it is the
// list that would go stale first if a name were ever renamed.
test('handPhrase covers every category the solver names', (t) => {
  const cases: [string, Card[], Card[]][] = [
    ['high card', h('Ah', 'Kd'), h('7s', '5c', '2d', '9h', 'Jc')],
    ['a pair', h('Ah', 'Ad'), h('7s', '5c', '2d', '9h', 'Jc')],
    ['two pair', h('Ah', 'Ad'), h('Ks', 'Kc', '2d', '9h', 'Jc')],
    ['three of a kind', h('Ah', 'Ad'), h('As', '5c', '2d', '9h', 'Jc')],
    ['a straight', h('9h', '8d'), h('7s', '6c', '5d', '2h', 'Jc')],
    ['a flush', h('Ah', 'Kh'), h('2h', '7h', 'Th', '3c', '4d')],
    ['a full house', h('Ah', 'Ad'), h('As', 'Kh', 'Kd', '3c', '4d')],
    ['four of a kind', h('Ah', 'Ad'), h('As', 'Ac', 'Kd', '3c', '4d')],
    ['a straight flush', h('Ks', 'Qs'), h('Js', 'Ts', '9s', '2c', '3d')],
    ['a royal flush', h('As', 'Ks'), h('Qs', 'Js', 'Ts', '2c', '3d')],
  ]
  for (const [expected, hole, board] of cases) {
    t.is(handPhrase(evaluateHand(hole, board)), expected, `${expected}: no phrase`)
  }
})

test('kicker decides when top pair ties', (t) => {
  const board = h('As', '7d', '2c', 'Th', '4s')
  const { winners } = determineWinners(
    [
      { id: 'bigKicker', hole: h('Ah', 'Kd') },
      { id: 'smallKicker', hole: h('Ac', 'Qd') },
    ],
    board,
  )
  t.deepEqual(winners, ['bigKicker'])
})
