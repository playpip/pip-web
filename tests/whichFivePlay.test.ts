// The counts and hands `/blog/how-often-both-your-cards-play` prints.
//
// The full count is too slow for the suite (src/config/whichFivePlay.ts), so
// this holds what can be held in a second: the rows add up to every deal, and
// each worked hand says what the evaluator that settles Pip's pots says.

import test from 'ava'
import {
  BOARD_STRAIGHT,
  BOTH_FOR_A_STRAIGHT,
  DEALS,
  HOLE_CARDS_PLAYING,
  ONE_CARD_FLUSH,
  THIRD_PAIR,
  TIED_FIVES,
  TIED_FIVES_TOTAL,
  TWO_RIGHT_FIVES,
  type WorkedHand,
} from '@/config/whichFivePlay'
import { cardFromString } from '@/lib/poker/cards'
import { determineWinners } from '@/lib/poker/handEval'

/** Does this hand, with these hole cards in play, tie the best it can make? */
function ties(hand: WorkedHand, hole: readonly string[]): boolean {
  const { winners } = determineWinners(
    [
      { id: 'all', hole: hand.hole.map(cardFromString) },
      { id: 'some', hole: hole.map(cardFromString) },
    ],
    hand.board.map(cardFromString),
  )
  return winners.length === 2
}

function plays(hand: WorkedHand): WorkedHand['plays'] {
  if (ties(hand, [])) return 'none'
  if (ties(hand, [hand.hole[0]])) return 'first'
  if (ties(hand, [hand.hole[1]])) return 'second'
  return 'both'
}

test('the three rows are every deal', (t) => {
  t.is(DEALS, 2_809_475_760)
  t.is(HOLE_CARDS_PLAYING.board + HOLE_CARDS_PLAYING.one + HOLE_CARDS_PLAYING.both, DEALS)
})

test('the tied-five rows add up to the total the post prints', (t) => {
  t.is(
    Object.values(TIED_FIVES).reduce((sum, n) => sum + n, 0),
    TIED_FIVES_TOTAL,
  )
})

test('each worked hand plays the cards the post says it does', (t) => {
  for (const hand of [
    BOARD_STRAIGHT,
    THIRD_PAIR,
    ONE_CARD_FLUSH,
    TWO_RIGHT_FIVES,
    BOTH_FOR_A_STRAIGHT,
  ]) {
    t.is(plays(hand), hand.plays, hand.hole.join(' '))
  }
})

test('the two nines make two different right fives', (t) => {
  const { hole, board } = TWO_RIGHT_FIVES
  const straight = ['Th', 'Jd', 'Qc', hole[0]]
  const { winners } = determineWinners(
    [
      { id: 'yours', hole: [...straight, hole[1]].map(cardFromString) },
      { id: 'board', hole: [...straight, board[0]].map(cardFromString) },
    ],
    [],
  )
  t.deepEqual(winners, ['yours', 'board'])
})
