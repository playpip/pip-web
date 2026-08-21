import test from 'ava'
import {
  FLOPS,
  FLOPS_BOARD_TRIPS,
  FLOPS_SET_OR_BETTER,
  FLOPS_WITH_YOUR_RANK,
  FLOP_OUTCOMES,
  POCKET_PAIRS,
  PREFLOP_HANDS,
} from '@/config/flopSet'
import { type Card, RANKS, type Rank, createDeck } from '@/lib/poker/cards'
import { evaluateHand } from '@/lib/poker/handEval'

// /learn/how-often-do-you-flop-a-set states five counts, and every one of them
// is checkable by exhaustion: a pocket pair leaves 50 unseen cards, so there
// are 19,600 flops and no sampling is required to say what they contain.
//
// Two things are deliberate here. The counts live in the config as typed
// literals rather than as a function call, so this file can disagree with them;
// derived from the evaluator they would agree with the evaluator by
// construction and prove nothing. And the grading is done by evaluateHand, the
// same call the game makes to decide who wins a pot, so the page and the table
// cannot come apart.

/** The two cards of `rank` that a player holds, and the 50 that are left. */
function dealt(rank: Rank): { hole: Card[]; unseen: Card[] } {
  const deck = createDeck()
  const ofRank = deck.filter((card) => card.rank === rank)
  const hole = [ofRank[0], ofRank[1]]
  const unseen = deck.filter((card) => !hole.includes(card))
  return { hole, unseen }
}

interface FlopCensus {
  /** Evaluator category name -> flops that grade that way. */
  byHand: Map<string, number>
  /** Flops holding at least one of the two remaining cards of your rank. */
  withYourRank: number
  /** Flops that are three of a kind of some other rank. */
  boardTrips: number
  total: number
}

/** Every flop this pocket pair can meet, graded. */
function census(rank: Rank): FlopCensus {
  const { hole, unseen } = dealt(rank)
  const byHand = new Map<string, number>()
  let withYourRank = 0
  let boardTrips = 0
  let total = 0
  for (let i = 0; i < unseen.length; i++) {
    for (let j = i + 1; j < unseen.length; j++) {
      for (let k = j + 1; k < unseen.length; k++) {
        const flop = [unseen[i], unseen[j], unseen[k]]
        const { name } = evaluateHand(hole, flop)
        byHand.set(name, (byHand.get(name) ?? 0) + 1)
        if (flop.some((card) => card.rank === rank)) withYourRank++
        if (flop[0].rank === flop[1].rank && flop[1].rank === flop[2].rank) boardTrips++
        total++
      }
    }
  }
  return { byHand, withYourRank, boardTrips, total }
}

// Pocket sevens: an arbitrary pair, and the last test in this file is the one
// that says the choice does not matter.
const SEVENS = census('7')

test('there are 19,600 flops behind a pocket pair, and every one of them is counted', (t) => {
  t.is(SEVENS.total, FLOPS)
  // C(50,3), spelled out rather than asserted against itself.
  t.is(FLOPS, (50 * 49 * 48) / (3 * 2 * 1))
})

test('the evaluator grades the 19,600 flops exactly as the page prints them', (t) => {
  const claimed = new Map(FLOP_OUTCOMES.map((row) => [row.hand, row.flops]))
  t.deepEqual([...SEVENS.byHand.keys()].sort(), [...claimed.keys()].sort())
  for (const [hand, flops] of claimed) {
    t.is(SEVENS.byHand.get(hand), flops, hand)
  }
})

test('the five counts add up to every flop there is', (t) => {
  const summed = FLOP_OUTCOMES.reduce((sum, row) => sum + row.flops, 0)
  t.is(summed, FLOPS)
})

test('11.8% counts cards: 2,304 flops contain one of your rank', (t) => {
  t.is(SEVENS.withYourRank, FLOPS_WITH_YOUR_RANK)
  // The page says "about 11.8%" in prose, twice, because that is the figure a
  // reader arrives already knowing. It is the only number on the page that is
  // typed as a percentage rather than printed from a count.
  t.is(((FLOPS_WITH_YOUR_RANK / FLOPS) * 100).toFixed(1), '11.8')
})

test('grading the hands instead gives 2,352, and the difference is the board coming trips', (t) => {
  const setOrBetter = FLOP_OUTCOMES.filter((row) => row.hand !== 'Two Pair' && row.hand !== 'Pair')
  t.is(
    setOrBetter.reduce((sum, row) => sum + row.flops, 0),
    FLOPS_SET_OR_BETTER,
  )
  t.is(SEVENS.boardTrips, FLOPS_BOARD_TRIPS)
  t.is(FLOPS_WITH_YOUR_RANK + FLOPS_BOARD_TRIPS, FLOPS_SET_OR_BETTER)
})

// The page says both of these are exact rather than rounded, which is the sort
// of sentence that becomes false the moment anyone edits a count.
test('the two headline shares really are exactly 12% and exactly 88%', (t) => {
  t.is(FLOPS_SET_OR_BETTER / FLOPS, 0.12)
  t.is((FLOPS - FLOPS_SET_OR_BETTER) / FLOPS, 0.88)
})

test('a pocket pair is exactly one deal in seventeen', (t) => {
  const deck = createDeck()
  let hands = 0
  let pairs = 0
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      hands++
      if (deck[i].rank === deck[j].rank) pairs++
    }
  }
  t.is(hands, PREFLOP_HANDS)
  t.is(pairs, POCKET_PAIRS)
  t.is(PREFLOP_HANDS / POCKET_PAIRS, 17)
})

// The page's last claim, and the one a reader is most likely to doubt: deuces
// and aces flop sets at the same rate. Thirteen full enumerations rather than a
// spot check, because "the same for every pair" is a statement about all of
// them.
test('every rank of pocket pair meets exactly the same 19,600 flops', (t) => {
  const reference = [...SEVENS.byHand.entries()].sort()
  for (const rank of RANKS) {
    const { byHand, withYourRank, boardTrips } = census(rank)
    t.deepEqual([...byHand.entries()].sort(), reference, `pocket ${rank}s`)
    t.is(withYourRank, FLOPS_WITH_YOUR_RANK, `pocket ${rank}s`)
    t.is(boardTrips, FLOPS_BOARD_TRIPS, `pocket ${rank}s`)
  }
})
