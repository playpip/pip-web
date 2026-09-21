import test from 'ava'
import { cardFromString } from '@/lib/poker/cards'
import { gradeMove } from '@/lib/review/moveGrade'
import type { HandEvent, HandRecord } from '@/store/game'

// Grading every move against the cards they actually held.
//
// This is the half of the review that is *hindsight*, and it is deliberate: a
// replay is the one place hindsight is the point, and it is the only way to say
// anything at all about a bet. The things worth pinning are:
//
// 1. **A bluff that works is good, and better the worse the hand was.** That is
//    the whole reason bets can be graded here at all.
// 2. **A bluff that gets called is bad, in proportion to what went in.**
// 3. **Nobody is a special case.** The opponents are graded by the same
//    arithmetic as the player, off the same recorded numbers.

const cards = (...s: string[]) => s.map(cardFromString)

const FLOP = cards('Ah', 'Kd', '7c')

/**
 * A hand on the flop: the hero holds the nuts-ish or nothing depending on the
 * cards passed, one opponent, and whatever events the test needs.
 */
function record(events: HandEvent[], over: Partial<HandRecord> = {}): HandRecord {
  return {
    handNo: 1,
    smallBlind: 10,
    bigBlind: 20,
    events,
    community: FLOP,
    reveals: [],
    seats: [
      { id: 'hero', name: 'Will', avatar: { seed: 'w', backgroundColor: 'b6e3f4' } },
      { id: 'ai1', name: 'Doris', avatar: { seed: 'd', backgroundColor: 'c0aede' } },
    ],
    hole: [
      { playerId: 'hero', cards: cards('2c', '3d') },
      { playerId: 'ai1', cards: cards('As', 'Kc') },
    ],
    buttonId: 'hero',
    start: { stacks: { hero: 1000, ai1: 1000 }, committed: {}, pot: 100 },
    summary: '',
    ...over,
  }
}

/** The flop, then whatever happens on it. */
const onFlop = (...rest: HandEvent[]): HandEvent[] => [
  { kind: 'board', label: 'Flop', cards: FLOP },
  ...rest,
]

test('a bluff that takes it down is good, and better the worse the hand was', (t) => {
  // 23o against top two pair on A-K-7 is drawing to almost nothing. Betting
  // 40 into 100 and taking it down wins a pot that was never going to be won.
  const hand = record(
    onFlop(
      {
        kind: 'action',
        playerId: 'hero',
        playerName: 'Will',
        type: 'bet',
        amount: 40,
        pot: 140,
        committed: { hero: 40, ai1: 0 },
      },
      {
        kind: 'action',
        playerId: 'ai1',
        playerName: 'Doris',
        type: 'fold',
        pot: 140,
        committed: { hero: 40, ai1: 0 },
      },
    ),
  )
  const move = gradeMove(hand, 1)
  t.truthy(move)
  t.is(move?.verdict, 'brilliant', 'a bluff that works with nothing is the definition of it')
  t.true((move?.bb ?? 0) > 0)
  t.regex(move?.line ?? '', /Everyone folded/)
})

test('the same bluff, called, is a mistake sized by what went in', (t) => {
  const hand = record(
    onFlop(
      {
        kind: 'action',
        playerId: 'hero',
        playerName: 'Will',
        type: 'bet',
        amount: 40,
        pot: 140,
        committed: { hero: 40, ai1: 0 },
      },
      {
        kind: 'action',
        playerId: 'ai1',
        playerName: 'Doris',
        type: 'call',
        amount: 40,
        pot: 180,
        committed: { hero: 40, ai1: 40 },
      },
    ),
  )
  const move = gradeMove(hand, 1)
  t.truthy(move)
  t.true((move?.bb ?? 0) < 0, 'betting into a better hand and getting called cannot be a gain')
  t.regex(move?.line ?? '', /better hand/)
})

test('a value bet that gets paid is good, and never brilliant', (t) => {
  // Top two pair against 23o: betting and being called is money, but it is not
  // a moment of inspiration.
  const hand = record(
    onFlop(
      {
        kind: 'action',
        playerId: 'ai1',
        playerName: 'Doris',
        type: 'bet',
        amount: 40,
        pot: 140,
        committed: { hero: 0, ai1: 40 },
      },
      {
        kind: 'action',
        playerId: 'hero',
        playerName: 'Will',
        type: 'call',
        amount: 40,
        pot: 180,
        committed: { hero: 40, ai1: 40 },
      },
    ),
  )
  const move = gradeMove(hand, 1)
  t.is(move?.playerId, 'ai1', 'the opponents are graded by the same arithmetic')
  t.is(move?.verdict, 'good')
  t.true((move?.equity ?? 0) > 0.9)
})

test('calling off with nothing is a blunder, and the number says how much', (t) => {
  const hand = record(
    onFlop(
      {
        kind: 'action',
        playerId: 'ai1',
        playerName: 'Doris',
        type: 'bet',
        amount: 200,
        pot: 300,
        committed: { hero: 0, ai1: 200 },
      },
      {
        kind: 'action',
        playerId: 'hero',
        playerName: 'Will',
        type: 'call',
        amount: 200,
        pot: 500,
        committed: { hero: 200, ai1: 200 },
      },
    ),
  )
  const move = gradeMove(hand, 2)
  t.is(move?.playerId, 'hero')
  t.is(move?.verdict, 'blunder')
  t.true((move?.bb ?? 0) <= -4)
  t.regex(move?.line ?? '', /It cost/)
})

test('folding a hand that was never getting there saves money', (t) => {
  const hand = record(
    onFlop(
      {
        kind: 'action',
        playerId: 'ai1',
        playerName: 'Doris',
        type: 'bet',
        amount: 200,
        pot: 300,
        committed: { hero: 0, ai1: 200 },
      },
      {
        kind: 'action',
        playerId: 'hero',
        playerName: 'Will',
        type: 'fold',
        pot: 300,
        committed: { hero: 0, ai1: 200 },
      },
    ),
  )
  const move = gradeMove(hand, 2)
  t.true((move?.bb ?? 0) > 0, 'laying down a losing hand facing a real price is a gain')
  t.regex(move?.line ?? '', /laid down/)
})

test('a check commits nothing, so it is never a mistake', (t) => {
  // What would have made a bet good is whether they fold, and that is the one
  // guess this file refuses to make.
  const hand = record(
    onFlop({ kind: 'action', playerId: 'hero', playerName: 'Will', type: 'check', pot: 100 }),
  )
  const move = gradeMove(hand, 1)
  t.is(move?.verdict, 'standard')
  t.is(move?.bb, 0)
})

test('a hand with nothing recorded to price it is left alone', (t) => {
  // No pot, no hole cards: an older record, or one out of a /hand link. Silence
  // beats a confident grade drawn from nothing.
  const bare = record(
    onFlop({ kind: 'action', playerId: 'hero', playerName: 'Will', type: 'bet', amount: 40 }),
    { start: undefined, hole: undefined },
  )
  t.is(gradeMove(bare, 1), null)
})

test('a call in a record that never kept the chips in front is not priced at zero', (t) => {
  // "Nothing to pay" is a claim, and a hand from before those maps existed
  // cannot support it.
  const old = record(
    onFlop(
      { kind: 'action', playerId: 'ai1', playerName: 'Doris', type: 'bet', amount: 200, pot: 300 },
      { kind: 'action', playerId: 'hero', playerName: 'Will', type: 'call', amount: 200, pot: 500 },
    ),
  )
  t.is(gradeMove(old, 2), null)
})

test('a board card is not a move', (t) => {
  const hand = record(onFlop())
  t.is(gradeMove(hand, 0), null)
})
