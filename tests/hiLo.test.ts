// Omaha Hi-Lo: the low rules, and the pot that now has to be cut in two.
//
// The second half is the one that would hurt. Every other showdown in this
// engine hands a pot to one set of winners; this one halves it, and a halving
// is where chips go missing — an odd chip rounded the wrong way twice a hand,
// or half a pot awarded to a low that does not exist. Neither throws. Both just
// quietly leave the table with less money than it was played for.
//
// So: the low rules, then conservation, then the pot-limit betting hi-lo
// inherits from Omaha.

import test from 'ava'
import { bestLow, compareLow, determineLowWinners } from '@/lib/poker/hiLo'
import { HOLE_CARDS, determineWinners, evaluateHand, isOmaha } from '@/lib/poker/handEval'
import { applyAction, legalActions, startHand } from '@/lib/poker/engine'
import { cardFromString, createDeck, mulberry32, shuffle, type Card } from '@/lib/poker/cards'

const hand = (spec: string): Card[] => spec.split(' ').map(cardFromString)
const low = (hole: string, board: string) => bestLow(hand(hole), hand(board))

// --- what qualifies ----------------------------------------------------------

test('a low is five different ranks, all eight or lower', (t) => {
  t.is(low('Ah 2d Kc Qs', '3h 4d 5s Kh Qd')?.description, '5-4-3-2-A')
  // A nine on every combination: no low at all.
  t.is(low('9h 9d Kc Qs', '9s Th Jd Qh Kd'), null)
  // Four low cards and nothing to pair them with is still four cards.
  t.is(low('Ah 2d Kc Qs', 'Kh Qd Jc 3s 9h'), null)
})

test('pairs do not make a low', (t) => {
  // A-2 in hand, board has an ace and a two: the only five-card picks repeat a
  // rank, so there is no low even though every card is small.
  t.is(low('Ah 2d Kc Qs', 'As 2c 3h Kh Qd'), null)
})

test('the nut low is the wheel, and the ace is a one', (t) => {
  const nuts = low('Ah 2d Kc Qs', '3h 4d 5s 9h Kd')
  t.is(nuts?.description, '5-4-3-2-A')
  t.deepEqual(nuts?.values, [5, 4, 3, 2, 1])
})

test('straights and flushes do not stop a hand being low', (t) => {
  // 5-4-3-2-A of one suit is the best low there is, and calling it a straight
  // flush and disqualifying it is the mistake a high-hand evaluator would make.
  const suited = low('Ah 2h Kc Qs', '3h 4h 5h 9d Kd')
  t.is(suited?.description, '5-4-3-2-A')
})

test('a lower card at the top wins, however bad the rest is', (t) => {
  // 8-7-6-5-4 loses to 8-7-6-5-3; read from the top down, first difference wins.
  t.true(compareLow([8, 7, 6, 5, 3], [8, 7, 6, 5, 4]) < 0)
  t.true(compareLow([8, 4, 3, 2, 1], [7, 6, 5, 4, 3]) > 0, 'an eight beat a seven')
  t.is(compareLow([8, 7, 6, 5, 4], [8, 7, 6, 5, 4]), 0)
})

test('the exactly-two rule applies to the low as well', (t) => {
  // The board is a made low all by itself — A-2-3-4-5 — but you must still use
  // two from your hand, so a hand with only one low card cannot use it.
  t.is(low('Kh Qd Jc Ts', 'Ah 2d 3s 4h 5d'), null)
  // With two low cards it plays — and note how much *worse* the low gets. The
  // board alone reads 5-4-3-2-A, but two of your cards have to go in, so the
  // six and the seven push the four and the five out: 7-6-3-2-A. That is the
  // exactly-two rule costing a player the nuts, which is the whole character
  // of the game.
  t.is(low('6h 7d Jc Ts', 'Ah 2d 3s 4h 5d')?.description, '7-6-3-2-A')
})

test('your high and your low can come from different cards', (t) => {
  // K-K for the high, A-2 for the low, one holding. The whole reason the low is
  // enumerated separately rather than read off the high hand.
  //
  // The board needs three low cards of its own or nobody has a low at all,
  // which is worth stating because it is the single most common reason a hi-lo
  // pot is scooped.
  const hole = hand('Kh Kd Ah 2d')
  const board = hand('Ks 3c 4d 6h Qs')
  t.is(evaluateHand(hole, board, 'omahahilo').name, 'Three of a Kind')
  t.is(bestLow(hole, board)?.description, '6-4-3-2-A')
})

// --- who wins the low --------------------------------------------------------

test('nobody qualifying is an empty list, not an empty split', (t) => {
  const board = hand('Kh Qd Jc Th 9s')
  const { winners } = determineLowWinners(
    [
      { id: 'a', hole: hand('Ah 2d 3c 4s') },
      { id: 'b', hole: hand('5h 6d 7c 8s') },
    ],
    board,
  )
  t.deepEqual(winners, [], 'a low was found on a board with no low cards')
})

test('two identical lows split the low half', (t) => {
  const board = hand('3h 4d 5s Kh Qd')
  const { winners } = determineLowWinners(
    [
      { id: 'a', hole: hand('Ah 2d Kc Qs') },
      { id: 'b', hole: hand('As 2c Jd Ts') },
    ],
    board,
  )
  t.deepEqual([...winners].sort(), ['a', 'b'])
})

// --- the pot ------------------------------------------------------------------

/** Play a hand out with everyone calling, and return the finished state. */
function playToShowdown(deck: Card[], seats = 3, bigBlind = 20) {
  let state = startHand({
    seats: Array.from({ length: seats }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      stack: 1_000,
    })),
    buttonIndex: 0,
    smallBlind: Math.floor(bigBlind / 2),
    bigBlind,
    deck,
    variant: 'omahahilo',
  })
  let guard = 0
  while (state.street !== 'complete' && guard++ < 200) {
    const actor = state.players[state.toActIndex]
    if (!actor) break
    const legal = legalActions(state)
    if (!legal) break
    state = applyAction(state, legal.canCheck ? { type: 'check' } : { type: 'call' })
  }
  return state
}

test('a split pot still adds up, over a hundred hands', (t) => {
  // The property that matters. Whatever the low did, the chips paid out have to
  // equal the chips put in — no odd chip invented, none dropped on the floor.
  for (let seed = 0; seed < 100; seed++) {
    const state = playToShowdown(shuffle(createDeck(), mulberry32(seed)))
    if (!state.result) continue
    const paidIn = state.players.reduce((sum, p) => sum + p.committedThisHand, 0)
    const paidOut = Object.values(state.result.payouts).reduce((sum, n) => sum + n, 0)
    t.is(paidOut, paidIn, `seed ${seed}: the pot did not balance`)
    // And the stacks agree with the payouts, which is the same fact from the
    // other end and the one a player would actually notice.
    const stacks = state.players.reduce((sum, p) => sum + p.stack, 0)
    t.is(stacks, seats() * 1_000, `seed ${seed}: chips appeared or vanished`)
  }
})
const seats = () => 3

test('the odd chip goes to the high hand', (t) => {
  // An odd pot cannot halve evenly, and where the spare chip lands has to be a
  // rule rather than a rounding accident. A fifteen-chip big blind three-handed
  // makes a 45-chip pot, so the odd case actually turns up instead of being
  // hunted for among even ones.
  let split = 0
  let odd = 0
  for (let seed = 0; seed < 120; seed++) {
    const state = playToShowdown(shuffle(createDeck(), mulberry32(seed + 500)), 3, 15)
    const awards = state.result?.potsAwarded ?? []
    if (awards.length !== 2) continue
    split++
    const [high, lowHalf] = awards
    t.true(high.amount >= lowHalf.amount, `seed ${seed}: the low half is the bigger one`)
    t.true(high.amount - lowHalf.amount <= 1, `seed ${seed}: the halves are not halves`)
    if ((high.amount + lowHalf.amount) % 2 === 1) {
      odd++
      t.is(high.amount, lowHalf.amount + 1, `seed ${seed}: the odd chip went low`)
    }
  }
  t.true(split > 0, 'no pot was ever split, so this proved nothing')
  t.true(odd > 0, 'no odd pot ever came up, so the odd-chip rule is untested')
})

test('a hand with no low pays one set of winners, not two', (t) => {
  // Half of all hi-lo pots. If this ever awards two halves, the second is going
  // to nobody and the chips stop existing.
  const board = hand('Kh Qd Jc Th 9s')
  const { winners } = determineLowWinners([{ id: 'a', hole: hand('Ah 2d 3c 4s') }], board)
  t.is(winners.length, 0)
})

// --- what it inherits from Omaha ---------------------------------------------

test('hi-lo is dealt four cards and read two at a time', (t) => {
  t.is(HOLE_CARDS.omahahilo, 4)
  t.true(isOmaha('omahahilo'))
  t.true(isOmaha('omaha'))
  t.false(isOmaha('holdem'))
  t.false(isOmaha('shortdeck'))
})

test('the high half is ordinary Omaha, exactly-two rule and all', (t) => {
  // Four hearts in hand is not a flush here either.
  const hole = hand('Ah Kh Qh Jh')
  const board = hand('2h 3h 7d 9c Ts')
  t.not(evaluateHand(hole, board, 'omahahilo').name, 'Flush')
  t.is(
    evaluateHand(hole, board, 'omahahilo').name,
    evaluateHand(hole, board, 'omaha').name,
    'the high half disagrees with Omaha',
  )
})

test('hi-lo bets pot-limit, like the Omaha it comes from', (t) => {
  const state = startHand({
    seats: [
      { id: 'a', name: 'A', stack: 10_000 },
      { id: 'b', name: 'B', stack: 10_000 },
    ],
    buttonIndex: 0,
    smallBlind: 10,
    bigBlind: 20,
    deck: shuffle(createDeck(), mulberry32(1)),
    variant: 'omahahilo',
  })
  const legal = legalActions(state)
  if (!legal) throw new Error('a fresh hand had no legal actions')
  // No-limit would allow the whole stack. Pot-limit preflop heads-up caps the
  // first raise well below it.
  t.true(legal.maxRaiseTo < 10_000, 'hi-lo let a player shove preflop')
})

test('a hi-lo showdown finds a high winner even when nobody makes a low', (t) => {
  const board = hand('Kh Qd Jc Th 9s')
  const { winners } = determineWinners(
    [
      { id: 'a', hole: hand('Ah 2d 3c 4s') },
      { id: 'b', hole: hand('Ad Kc 5h 6d') },
    ],
    board,
    'omahahilo',
  )
  t.true(winners.length > 0, 'nobody won a pot that was definitely played for')
})
