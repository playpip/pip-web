import test from 'ava'
import { canPlayDrill, drillKind } from '@/config/drills'
import {
  EASIEST_FIVE,
  HARDEST_FIVE,
  type FiveShape,
  drillAt,
  fiveDifficulty,
  gradeDrill,
  nextDrill,
} from '@/lib/drills'
import { MOST_ANSWERS, PLAYS, selectionId } from '@/lib/drills/whichFivePlay'
import { spotLadder, standingLine } from '@/lib/drills/standing'
import type { Drill, RejectReason } from '@/lib/drills/types'
import { determineWinners, evaluateHand } from '@/lib/poker/handEval'
import type { Card } from '@/lib/poker/cards'

// "Which five play?" is the one kind whose answer is a set rather than a
// button, and that is what these tests are mostly about. Two things have to
// hold or the kind is dishonest:
//
// 1. **Every set of five that ties the best hand is accepted.** With two kings
//    on the board and a king in your hand, which king you keep does not change
//    what you have, and marking one of two identical hands wrong would be the
//    drill disagreeing with the engine it is teaching.
// 2. **Guessing does not work.** Twenty-one sets, and a spot where several are
//    right is a spot where tapping at random gets there often enough to be a
//    strategy. Those are thrown away rather than shipped.
//
// Exact throughout: the answer is twenty-one showdowns compared by the solver,
// so a flaky test here is a wrong test.

const KIND = 'which-five-play'

function accepted(from: number, count: number): Drill[] {
  const drills: Drill[] = []
  for (let seed = from; seed < from + count; seed++) {
    const { drill } = drillAt(KIND, seed)
    if (drill) drills.push(drill)
  }
  return drills
}

const hero = (drill: Drill) => drill.hands?.[0]?.cards ?? []
const seven = (drill: Drill) => [...hero(drill), ...drill.board]

/** Every way to take five from seven, the same twenty-one the generator ranks. */
function fives(cards: readonly Card[]): Card[][] {
  const sets: Card[][] = []
  for (let a = 0; a < cards.length; a++) {
    for (let b = a + 1; b < cards.length; b++) {
      sets.push(cards.filter((_, i) => i !== a && i !== b))
    }
  }
  return sets
}

test('the same seed is the same spot, forever', (t) => {
  for (const seed of [1, 7, 1_000, 4_294_967_295]) {
    t.deepEqual(drillAt(KIND, seed), drillAt(KIND, seed), `seed ${seed}`)
  }
})

// The load-bearing one. Every accepted set is re-derived here from the cards
// rather than read back off the generator: a set is right if and only if the
// solver cannot find five of the seven that beat it.
test('the accepted sets are exactly the sets that tie the best hand', (t) => {
  for (const drill of accepted(1, 200)) {
    const sets = fives(seven(drill))
    const { winners } = determineWinners(
      sets.map((cards, i) => ({ id: i, hole: cards })),
      [],
    )
    const expected = winners.map((i) => selectionId(sets[i])).sort()
    t.deepEqual([...(drill.answers ?? [drill.answer])].sort(), expected, `seed ${drill.seed}`)
    // And the hand those five make is the hand the player has.
    const made = evaluateHand(hero(drill), drill.board)
    for (const i of winners) {
      t.is(evaluateHand(sets[i], []).name, made.name, `seed ${drill.seed}: a set of the wrong hand`)
    }
  }
})

test('the grader takes any correct set and refuses every other', (t) => {
  for (const drill of accepted(1, 120)) {
    const right = drill.answers ?? [drill.answer]
    for (const id of right) t.true(gradeDrill(drill, id).correct, `seed ${drill.seed}: ${id}`)
    for (const set of fives(seven(drill))) {
      const id = selectionId(set)
      t.is(gradeDrill(drill, id).correct, right.includes(id), `seed ${drill.seed}: ${id}`)
    }
    // A selection of the wrong size cannot be right, whatever is in it.
    t.false(gradeDrill(drill, selectionId(seven(drill).slice(0, 4))).correct)
    t.false(gradeDrill(drill, selectionId(seven(drill))).correct)
  }
})

// The order of the taps is not part of the answer. This is the property the
// whole interaction rests on: a player reads the board in whatever order they
// like and the same five cards have to come to the same id.
test('a set is the same set whatever order it was tapped in', (t) => {
  for (const drill of accepted(1, 60)) {
    const best = evaluateHand(hero(drill), drill.board).best
    const forwards = selectionId(best)
    const backwards = selectionId([...best].reverse())
    t.is(forwards, backwards, `seed ${drill.seed}`)
    t.true(gradeDrill(drill, backwards).correct)
  }
})

test('the canonical answer is one of the accepted sets, and there are never too many', (t) => {
  for (const drill of accepted(1, 400)) {
    const answers = drill.answers ?? [drill.answer]
    t.true(answers.includes(drill.answer), `seed ${drill.seed}`)
    t.true(answers.length <= MOST_ANSWERS, `seed ${drill.seed}: ${answers.length} right answers`)
    t.true(answers.length >= 1)
  }
})

// The seven cards are the controls, and the five marked `winning` are the ones
// the reveal rings. Every card is offered exactly once.
test('every card is a choice, and the five that play are marked', (t) => {
  for (const drill of accepted(1, 300)) {
    t.is(drill.choices.length, 7, `seed ${drill.seed}`)
    t.is(new Set(drill.choices.map((c) => c.id)).size, 7)
    t.is(drill.choices.filter((c) => c.winning).length, PLAYS, `seed ${drill.seed}`)
    const marked = drill.choices
      .filter((c) => c.winning)
      .flatMap((c) => c.cards)
      .map((c) => `${c.rank}${c.suit}`)
      .sort()
    const best = evaluateHand(hero(drill), drill.board)
      .best.map((c) => `${c.rank}${c.suit}`)
      .sort()
    t.deepEqual(marked, best, `seed ${drill.seed}`)
    // Each choice carries its own card and says it out loud, because a card
    // face is read inconsistently or not at all.
    for (const choice of drill.choices) {
      t.is(choice.cards.length, 1)
      t.truthy(choice.spoken)
    }
  }
})

test('the shape says how much choosing there is, and the engine agrees', (t) => {
  const seen = new Set<FiveShape>()
  for (const drill of accepted(1, 400)) {
    const hole = hero(drill)
    const { winners } = determineWinners(
      [
        { id: 'hero', hole },
        { id: 'board', hole: [] },
      ],
      drill.board,
    )
    const made = evaluateHand(hole, drill.board)
    const usesAll = ['Straight', 'Flush', 'Full House', 'Straight Flush'].includes(made.name)
    const expected: FiveShape = winners.includes('board')
      ? 'board-plays'
      : usesAll
        ? 'made-five'
        : 'kickers-matter'
    t.is(drill.settledBy, expected, `seed ${drill.seed}`)
    seen.add(expected)
  }
  t.is(seen.size, 3, 'a shape the ladder names is never dealt')
})

test('every spot carries a difficulty, and it is exactly what its shape is worth', (t) => {
  for (const drill of accepted(1, 300)) {
    t.is(drill.difficulty, fiveDifficulty(drill.settledBy as FiveShape), `seed ${drill.seed}`)
    t.true(drill.difficulty >= EASIEST_FIVE && drill.difficulty <= HARDEST_FIVE)
  }
})

// The spots that are a free guess are thrown away rather than shipped, and this
// is the count that says the cut is doing something without eating the kind.
test('the filter throws away the free guesses, and only those', (t) => {
  const counts: Record<RejectReason, number> = {
    'one-sided': 0,
    unexplainable: 0,
    'already-ahead': 0,
    'chop-possible': 0,
    'drawing-dead': 0,
    ambiguous: 0,
    'free-guess': 0,
  }
  let kept = 0
  for (let seed = 1; seed <= 2_000; seed++) {
    const { drill, rejected } = drillAt(KIND, seed)
    if (drill) kept++
    else if (rejected) counts[rejected]++
  }
  t.is(counts['one-sided'], 0)
  t.is(counts['already-ahead'], 0)
  t.is(counts['chop-possible'], 0)
  t.is(counts['drawing-dead'], 0)
  t.is(counts.ambiguous, 0)
  t.true(counts['free-guess'] > 0, 'the cut never fired, so it is not doing anything')
  t.true(kept > 1_900, `only ${kept} of 2,000 seeds were askable`)
})

test('the sentence says what the hand is and what the rest of the five are doing', (t) => {
  for (const drill of accepted(1, 200)) {
    const explanation = drill.explanation
    t.true(explanation.length > 20, `seed ${drill.seed}`)
    if (drill.settledBy === 'made-five') t.regex(explanation, /uses all five cards/)
    if (drill.settledBy === 'kickers-matter') t.regex(explanation, /highest card/)
    if (drill.settledBy === 'board-plays') t.regex(explanation, /five on the board/)
    // A meter's vocabulary is banned in this folder, copy included.
    t.notRegex(explanation, /\b(remaining|locked|allowance|quota)\b/i)
  }
})

test('a spot with two right answers says so rather than letting it look like luck', (t) => {
  const several = accepted(1, 800).filter((d) => (d.answers?.length ?? 1) > 1)
  t.true(several.length > 0, 'no multi-answer spot in 800 seeds, so this proved nothing')
  for (const drill of several) {
    t.regex(drill.explanation, /every one of them is right/, `seed ${drill.seed}`)
  }
})

test('the stream always finds a spot, and quickly enough to deal on mount', (t) => {
  for (const seed of [1, 99, 12_345, 4_294_967_290]) {
    t.truthy(nextDrill(KIND, seed))
  }
})

test('the ladder reads up, and names every shape the generator deals', (t) => {
  const ladder = spotLadder(KIND)
  t.truthy(ladder)
  const ratings = ladder?.map((s) => s.rating) ?? []
  t.deepEqual(
    ratings,
    [...ratings].sort((a, b) => a - b),
    'the ladder does not read easiest first',
  )
  const named = new Set(ladder?.map((s) => s.settledBy))
  for (const drill of accepted(1, 200)) t.true(named.has(drill.settledBy), drill.settledBy)
  t.truthy(standingLine(KIND, 900))
})

// Paid, and the flag was on it in the commit that registered it: a kind that
// ships without one is free forever and cannot be taken back (technology#55).
test("this kind is registered as the membership's, not as free", (t) => {
  const kind = drillKind(KIND)
  t.true(kind.membersOnly, 'a paid kind shipped without its flag is free forever')
  t.false(canPlayDrill(kind, false))
  t.true(canPlayDrill(kind, true))
})
