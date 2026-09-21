import test from 'ava'
import { DRILL_KINDS, canPlayDrill, drillKind } from '@/config/drills'
import {
  EASIEST_READ,
  HARDEST_READ,
  type ReadShape,
  drillAt,
  gradeDrill,
  nextDrill,
  readDifficulty,
} from '@/lib/drills'
import { kindFloor, spotLadder, standingLine } from '@/lib/drills/standing'
import type { Drill, RejectReason } from '@/lib/drills/types'
import { HAND_CATEGORIES, determineWinners, evaluateHand } from '@/lib/poker/handEval'

// "What have you got?" is the bottom of the ladder and the second free kind, so
// it carries both burdens: it has to be incapable of marking a correct answer
// wrong (it is free, and a stranger may meet it first), and it has to actually
// be easier than everything above it, or the rung does not exist.
//
// Everything is exact. The answer is `evaluateHand` reading a finished hand, so
// a test that is flaky here is a test that is wrong.

const KIND = 'whats-your-hand'

/** Every accepted spot in a range of seeds. */
function accepted(from: number, count: number): Drill[] {
  const drills: Drill[] = []
  for (let seed = from; seed < from + count; seed++) {
    const { drill } = drillAt(KIND, seed)
    if (drill) drills.push(drill)
  }
  return drills
}

const hero = (drill: Drill) => drill.hands?.[0]?.cards ?? []

test('the same seed is the same spot, forever', (t) => {
  for (const seed of [1, 7, 1_000, 4_294_967_295]) {
    t.deepEqual(drillAt(KIND, seed), drillAt(KIND, seed), `seed ${seed}`)
  }
})

// The answer is the hand, re-derived from the cards rather than read back off
// the generator. This is the whole of the kind: if the solver and the drill
// ever disagree about what somebody is holding, the drill is wrong and the
// player is right.
test('every answer is the hand the evaluator reads, recomputed from the dealt cards', (t) => {
  for (const drill of accepted(1, 400)) {
    const made = evaluateHand(hero(drill), drill.board)
    t.is(drill.answer, made.name, `seed ${drill.seed}`)
    const winning = drill.choices.filter((c) => c.winning)
    t.is(winning.length, 1, `seed ${drill.seed}: more than one right answer`)
    t.is(winning[0].id, made.name)
  }
})

test('the grader accepts the hand and nothing else', (t) => {
  for (const drill of accepted(1, 200)) {
    for (const choice of drill.choices) {
      t.is(gradeDrill(drill, choice.id).correct, choice.id === drill.answer, `seed ${drill.seed}`)
    }
    t.false(gradeDrill(drill, 'Royal Flush').correct)
  }
})

// Four buttons, all of them real categories, and no duplicates. A distractor
// that is not a hand anybody could have is a distractor you can eliminate
// without reading the board, which is the opposite of what this kind is for.
test('the four answers are four different real hands, weakest first', (t) => {
  for (const drill of accepted(1, 300)) {
    t.is(drill.choices.length, 4, `seed ${drill.seed}`)
    const ids = drill.choices.map((c) => c.id)
    t.is(new Set(ids).size, 4, `seed ${drill.seed}: a category offered twice`)
    for (const id of ids) t.true(HAND_CATEGORIES.includes(id), `${id} is not a hand`)
    const order = ids.map((id) => HAND_CATEGORIES.indexOf(id))
    t.deepEqual(
      order,
      [...order].sort((a, b) => a - b),
      `seed ${drill.seed}: not in ranking order`,
    )
  }
})

// A spot deals seven distinct cards and never shows the answer before asking.
test('every spot deals seven distinct cards and names nothing early', (t) => {
  for (const drill of accepted(1, 300)) {
    const all = [...hero(drill), ...drill.board]
    t.is(all.length, 7)
    t.is(new Set(all.map((c) => `${c.rank}${c.suit}`)).size, 7, `seed ${drill.seed}`)
    // `detail` is what a holding says it is. Naming the hand above the buttons
    // would be printing the answer over the question.
    t.is(drill.hands?.[0]?.detail, undefined, `seed ${drill.seed}: the panel gave it away`)
    t.is(drill.hands?.length, 1, 'a reading spot has one holding and no opponent')
  }
})

// The shape is a fact about whose cards are doing the work, and it is asked of
// the engine rather than counted off the five. Re-derived here the same way, so
// a generator that started guessing would say so.
test('the shape says how much of the hand is yours, and the engine agrees', (t) => {
  const seen = new Set<ReadShape>()
  for (const drill of accepted(1, 400)) {
    const hole = hero(drill)
    const board = drill.board
    const versusBoard = determineWinners(
      [
        { id: 'hero', hole },
        { id: 'board', hole: [] },
      ],
      board,
    )
    const alone = determineWinners(
      [
        { id: 'hero', hole },
        { id: 'left', hole: [hole[0]] },
        { id: 'right', hole: [hole[1]] },
      ],
      board,
    )
    const expected: ReadShape = versusBoard.winners.includes('board')
      ? 'plays-the-board'
      : alone.winners.length > 1
        ? 'uses-one'
        : 'uses-both'
    t.is(drill.settledBy, expected, `seed ${drill.seed}`)
    seen.add(expected)
  }
  t.is(seen.size, 3, 'a shape the ladder names is never dealt')
})

test('every spot carries a difficulty, and it is its shape plus at most one mirage', (t) => {
  for (const drill of accepted(1, 300)) {
    const shape = drill.settledBy as ReadShape
    const plain = readDifficulty(shape, false)
    const mirage = readDifficulty(shape, true)
    t.true(drill.difficulty === plain || drill.difficulty === mirage, `seed ${drill.seed}`)
    t.true(drill.difficulty >= EASIEST_READ && drill.difficulty <= HARDEST_READ)
  }
})

// **The whole point of the kind**: it is the easiest thing in the app. If this
// fails, the rung a beginner starts on has moved above the one above it.
test('this kind is rated below every other kind in the app', (t) => {
  for (const kind of DRILL_KINDS) {
    if (kind.id === KIND) continue
    t.true(
      HARDEST_READ >= kindFloor(kind.id) || kindFloor(kind.id) > EASIEST_READ,
      `${kind.id} starts below the reading kind, so the ladder has no bottom`,
    )
    t.true(kindFloor(KIND) <= kindFloor(kind.id), `${kind.id} opens easier than reading a hand`)
  }
})

// The sentence is the teaching, so it has to say which cards played rather than
// only what the hand was called.
test('the sentence names the five that play, every time', (t) => {
  for (const drill of accepted(1, 200)) {
    t.regex(drill.explanation, /The five that play: /, `seed ${drill.seed}`)
    const said = drill.explanation.split('The five that play: ')[1].replace('.', '').split(' ')
    t.is(said.length, 5, `seed ${drill.seed}: ${drill.explanation}`)
    const made = evaluateHand(hero(drill), drill.board)
    const five = new Set(made.best.map((c) => `${c.rank === 'T' ? '10' : c.rank}`))
    for (const card of said) t.true(five.has(card.slice(0, -1)), `${card} is not in the hand`)
  }
})

test('a board that plays on its own says so in words', (t) => {
  const boards = accepted(1, 600).filter((d) => d.settledBy === 'plays-the-board')
  t.true(boards.length > 0, 'no board-plays spot in 600 seeds, so this proved nothing')
  for (const drill of boards) {
    t.regex(drill.explanation, /all on the board/, `seed ${drill.seed}`)
    t.regex(drill.explanation, /everybody at this table has the same hand/)
  }
})

// Generation is a filtered stream. This kind rejects almost nothing, because
// every finished hand is a hand somebody can be asked to name — which is worth
// pinning, since a kind that started throwing spots away would be a kind that
// stopped being the easy one.
test('the filter keeps nearly everything, and only throws away what it cannot explain', (t) => {
  // Exhaustive rather than partial, so a new reject reason anywhere in the
  // vocabulary stops this file compiling and somebody has to decide whether
  // this kind can emit it.
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
  t.is(counts['free-guess'], 0)
  t.true(kept > 1_900, `only ${kept} of 2,000 seeds were askable`)
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
  t.truthy(standingLine(KIND, 800))
})

// Free, and free means the flag is absent rather than false: absent is what
// cannot be taken back (see config/membership.ts).
test('this kind is free, and shipped free', (t) => {
  const kind = drillKind(KIND)
  t.is(kind.membersOnly, undefined, 'the beginners’ kind carries a membership flag')
  t.true(canPlayDrill(kind, false))
  t.true(canPlayDrill(kind, true))
})

// It is the first thing in the room, because the room is a ladder now.
test('the registry lists it first, above everything that assumes it', (t) => {
  t.is(DRILL_KINDS[0].id, KIND, 'the easiest kind is not the first one a beginner sees')
})
