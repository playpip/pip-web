import test from 'ava'
import { ACE_RUNS, BEST_FIVE, CAN_YOU_CHECK, WHO_WINS, toCards } from '@/config/learnExamples'
import { cardToString } from '@/lib/poker/cards'
import { bestFive, determineWinners, evaluateHand, type EvaluatedHand } from '@/lib/poker/handEval'

/**
 * The five cards the evaluator actually used, as "Kh" strings. Goes through
 * bestFive rather than reading solved.cards: the raw list is six cards on a
 * six-card flush or two trips, and holds a low ace as '1'. This used to read
 * it raw and was safe only because no fixture had that shape.
 */
const bestFiveOf = (solved: EvaluatedHand): string[] => bestFive(solved).map(cardToString)

// The whole point of this file: every worked example on a guide page states who
// wins a hand, in public, to people learning the rules. Getting one wrong is
// worse than not shipping the example. So the engine settles each of them, and
// the answers in the config are only ever a claim the tests have checked.

test('every example agrees with the evaluator about who wins', (t) => {
  for (const example of WHO_WINS) {
    const board = toCards(example.board)
    const { winners } = determineWinners(
      [
        { id: 'a' as const, hole: toCards(example.a) },
        { id: 'b' as const, hole: toCards(example.b) },
      ],
      board,
    )
    const actual = winners.length === 2 ? 'split' : winners[0]
    t.is(actual, example.answer, `${example.id}: evaluator disagrees`)
  }
})

test('every example uses five board cards, two hole cards, and no repeats', (t) => {
  for (const example of WHO_WINS) {
    t.is(example.board.length, 5, `${example.id}: board`)
    t.is(example.a.length, 2, `${example.id}: hand a`)
    t.is(example.b.length, 2, `${example.id}: hand b`)
    const all = [...example.board, ...example.a, ...example.b]
    t.is(new Set(all).size, all.length, `${example.id}: a card is dealt twice`)
  }
})

// Q-K-A-2-3 being nothing is the claim worth pinning: it is the one the page
// exists to correct, and it is the one a reader is least able to check.
test('the ace runs agree with the evaluator about what is a straight', (t) => {
  for (const run of ACE_RUNS) {
    const cards = toCards(run.cards)
    const solved = evaluateHand(cards, [])
    t.is(solved.name === 'Straight', run.isStraight, `${run.id}: evaluator says "${solved.name}"`)
  }
})

test('the ace runs are five distinct cards, and mixed suits so only the run is in question', (t) => {
  for (const run of ACE_RUNS) {
    t.is(run.cards.length, 5, `${run.id}: card count`)
    t.is(new Set(run.cards).size, 5, `${run.id}: a card is dealt twice`)
    const suits = new Set(run.cards.map((c) => c[1]))
    t.true(suits.size > 1, `${run.id}: all one suit would make it a flush question`)
    t.true(run.verdict.length > 0, `${run.id}: no verdict`)
  }
})

test('every example has an id and an explanation', (t) => {
  const ids = WHO_WINS.map((e) => e.id)
  t.is(new Set(ids).size, ids.length)
  for (const example of WHO_WINS) {
    t.true(example.id.length > 0)
    t.true(example.why.length > 0, `${example.id}: no explanation`)
  }
})

// BestFive names five of the seven cards and says that is the hand. A reader
// learning the rules has no way to check it, and the whole point of the widget
// is the case where the answer is counter-intuitive, so the evaluator settles
// each one rather than the author's reading of the board.

test('every best-five spot names the five cards the evaluator actually uses', (t) => {
  for (const spot of BEST_FIVE) {
    const solved = evaluateHand(toCards(spot.hole), toCards(spot.board))
    // Compared as sets: the config lists them in the order the widget reads
    // best, and pokersolver has its own ordering within a rank.
    t.deepEqual(
      bestFiveOf(solved).sort(),
      [...spot.best].sort(),
      `${spot.id}: not the best five available`,
    )
    t.is(solved.name, spot.engineName, `${spot.id}: hand name`)
  }
})

test('every best-five spot deals seven distinct cards, and the five come from them', (t) => {
  for (const spot of BEST_FIVE) {
    t.is(spot.hole.length, 2, `${spot.id}: hole`)
    t.is(spot.board.length, 5, `${spot.id}: board`)
    t.is(spot.best.length, 5, `${spot.id}: best five`)
    const seven = [...spot.hole, ...spot.board]
    t.is(new Set(seven).size, 7, `${spot.id}: a card is dealt twice`)
    for (const card of spot.best) {
      t.true(seven.includes(card), `${spot.id}: ${card} is not one of the seven`)
    }
    t.true(spot.why.length > 0, `${spot.id}: no explanation`)
  }
})

test('the three spots really are both-play, one-plays and neither-plays', (t) => {
  const played = (id: string) => {
    const spot = BEST_FIVE.find((s) => s.id === id)
    if (!spot) throw new Error(`no spot ${id}`)
    return spot.hole.filter((card) => spot.best.includes(card)).length
  }
  t.is(played('both-play'), 2)
  t.is(played('one-plays'), 1)
  t.is(played('neither-plays'), 0)
})

test('on the neither-plays spot the hole cards make no difference at all', (t) => {
  // The claim the spot exists to make: the board is the hand, so everyone
  // still in has it and the pot splits. Any other two cards must tie.
  const spot = BEST_FIVE.find((s) => s.id === 'neither-plays')
  if (!spot) throw new Error('no neither-plays spot')
  const { winners } = determineWinners(
    [
      { id: 'reader' as const, hole: toCards(spot.hole) },
      { id: 'anyone' as const, hole: toCards(['Jc', '4h']) },
    ],
    toCards(spot.board),
  )
  t.deepEqual(winners.sort(), ['anyone', 'reader'])
})

test('the checking situations are three distinct rules claims with verdicts', (t) => {
  // No cards, so nothing here is the evaluator's to settle. What a test can
  // still hold is that the set covers both answers rather than teaching one.
  const ids = CAN_YOU_CHECK.map((e) => e.id)
  t.is(new Set(ids).size, ids.length)
  t.true(CAN_YOU_CHECK.some((e) => e.canCheck))
  t.true(CAN_YOU_CHECK.some((e) => !e.canCheck))
  for (const example of CAN_YOU_CHECK) {
    t.true(example.situation.length > 0, `${example.id}: no situation`)
    t.true(example.verdict.length > 0, `${example.id}: no verdict`)
    t.true(
      example.verdict.startsWith(example.canCheck ? 'Yes' : 'No'),
      `${example.id}: the verdict must open with the answer it is scored against`,
    )
  }
})
