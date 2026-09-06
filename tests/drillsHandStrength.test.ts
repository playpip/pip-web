import test from 'ava'
import { DRILL_KINDS, canPlayDrill, drillKind } from '@/config/drills'
import { MAX_ATTEMPTS, drillAt, gradeDrill, nextDrill } from '@/lib/drills'
import {
  CHOP_CEILING,
  COIN_FLIP_MARGIN,
  LIVE,
  ONE_SIDED,
  RUNOUTS,
  UNSEEN_AFTER_FLOP,
} from '@/lib/drills/handStrength'
import {
  EASIEST_STRENGTH,
  HARDEST_STRENGTH,
  type SpotKind,
  type StrengthShape,
  strengthDifficulty,
} from '@/lib/drills/rating'
import { spotLadder } from '@/lib/drills/standing'
import type { Drill, RejectReason } from '@/lib/drills/types'
import { cardToString, createDeck } from '@/lib/poker/cards'
import { determineWinners } from '@/lib/poker/handEval'

// "Hand strength" is the third kind that comes with the membership, and the
// first one that asks about a board with two cards still to come.
//
// The tests are the counting kind's two halves - the answer is right, and the
// gate is real - with the same third the pricing kind added: the number in the
// sentence has to be the number that settled it. A drill that grades a flop
// against a count it did not print is worse than one that grades it wrong,
// because nothing on the screen would say so.
//
// Everything is exact. The favourite is 990 showdowns, so there is no sampling
// anywhere in this kind and a flaky test here is a wrong test.
//
// **The sweep is generated once and every test slices it.** A spot costs 990
// showdowns, about 40ms, where the turn kinds cost 44, so a file that re-swept
// per test would spend a minute and a half of gate re-deriving spots it had
// already derived. Generation is pure, so one pass is the same evidence.

const KIND = 'hand-strength'

/** How far the one sweep runs. Every count below is a slice of this. */
const SWEEP = 600

/** Seeds 1..SWEEP, each with the spot it made or the reason it did not. */
const SWEPT = Array.from({ length: SWEEP }, (_, i) => ({
  seed: i + 1,
  ...drillAt(KIND, i + 1),
}))

/** The first `count` seeds' worth of accepted spots. */
function accepted(count: number): Drill[] {
  const drills: Drill[] = []
  for (const swept of SWEPT.slice(0, count)) if (swept.drill) drills.push(swept.drill)
  return drills
}

/** The kind's own vocabulary, and a narrowing so a test can use it as one. */
const STRENGTH_SHAPES: StrengthShape[] = ['clear-favourite', 'live-underdog', 'draw-is-favourite']
const isStrengthShape = (shape: SpotKind): shape is StrengthShape =>
  (STRENGTH_SHAPES as SpotKind[]).includes(shape)

const cardsOf = (drill: Drill, id: string) =>
  drill.choices.find((choice) => choice.id === id)?.cards ?? []

/**
 * What each hand is worth, worked out again from the cards the spot dealt.
 *
 * Deliberately not the generator's own enumeration: it rebuilds the deck, takes
 * out the seven cards on the screen, deals every pair of the rest and reads the
 * showdown. If this ever disagrees with the drill, somebody paying for this is
 * being marked wrong for being right.
 */
function favouriteOf(drill: Drill): { id: string; takes: number; chops: number; equity: number } {
  const seen = new Set(
    [...drill.board, ...cardsOf(drill, 'a'), ...cardsOf(drill, 'b')].map(cardToString),
  )
  const rest = createDeck().filter((card) => !seen.has(cardToString(card)))
  const contenders = [
    { id: 'a', hole: cardsOf(drill, 'a') },
    { id: 'b', hole: cardsOf(drill, 'b') },
  ]
  let aWins = 0
  let bWins = 0
  let chops = 0
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      const turn = rest[i]
      const river = rest[j]
      if (!turn || !river) continue
      const { winners } = determineWinners(contenders, [...drill.board, turn, river])
      if (winners.length > 1) chops++
      else if (winners[0] === 'a') aWins++
      else bWins++
    }
  }
  const runouts = (rest.length * (rest.length - 1)) / 2
  const equityA = (aWins + chops / 2) / runouts
  const id = equityA >= 0.5 ? 'a' : 'b'
  return {
    id,
    takes: id === 'a' ? aWins : bWins,
    chops,
    equity: id === 'a' ? equityA : 1 - equityA,
  }
}

test('the deck arithmetic the sentence quotes is the deck arithmetic', (t) => {
  // 990 is printed to a player, so it gets to be wrong in exactly one place.
  t.is(UNSEEN_AFTER_FLOP, 52 - 2 - 2 - 3)
  t.is(RUNOUTS, 990)
})

test('the same seed is the same spot, forever', (t) => {
  for (const seed of [1, 2, 94, 200]) {
    t.deepEqual(drillAt(KIND, seed), drillAt(KIND, seed))
  }
})

// The pinned spots: both answers, all three shapes, and both halves of the
// sentence. If the enumeration or the wording moves, it says so here rather
// than on a paying player's screen.
const PINNED: { seed: number; answer: string; shape: StrengthShape; explanation: string }[] = [
  {
    seed: 1,
    answer: 'a',
    shape: 'live-underdog',
    explanation:
      'Hand A is the favourite: it takes 730 of the 990 runouts and chops 9, which is 74%. It is ahead on the flop as well, on high card alone.',
  },
  {
    seed: 2,
    answer: 'b',
    shape: 'clear-favourite',
    explanation:
      'Hand B is the favourite: it takes 756 of the 990 runouts and chops 21, which is 77%. It is ahead on the flop as well, on high card alone.',
  },
  {
    // The kind's reason for existing, in one spot. Both hands play the board's
    // pair of fives and Hand B holds the better kicker, so it is ahead on the
    // flop and a reader who stops there picks it. Hand A holds two hearts on a
    // two-heart board and takes it 54% of the time.
    seed: 94,
    answer: 'a',
    shape: 'draw-is-favourite',
    explanation:
      'Hand A is the favourite: it takes 515 of the 990 runouts and chops 46, which is 54%. Hand B is ahead on the flop with a pair and does not stay there.',
  },
]

test('fixed seeds settle and grade the same way every run', (t) => {
  for (const pin of PINNED) {
    const { drill } = drillAt(KIND, pin.seed)
    t.truthy(drill, `seed ${pin.seed} no longer generates a spot`)
    if (!drill) continue
    t.is(drill.answer, pin.answer, `seed ${pin.seed}`)
    t.is(drill.settledBy, pin.shape, `seed ${pin.seed}`)
    t.is(drill.explanation, pin.explanation, `seed ${pin.seed}`)
  }
})

// The one that matters most, and the reason this kind is enumerated rather than
// simulated: the answer is re-derived from the cards on the screen by code that
// shares nothing with the generator.
test('every answer agrees with the cards, recounted from scratch', (t) => {
  for (const drill of accepted(40)) {
    const again = favouriteOf(drill)
    t.is(drill.answer, again.id, `seed ${drill.seed} says ${drill.answer}`)
    t.true(
      drill.choices.find((choice) => choice.id === again.id)?.winning === true,
      `seed ${drill.seed} does not mark its own answer as winning`,
    )
  }
})

test('the count in the sentence is the count that settled it', (t) => {
  // The pricing kind's rule, one street earlier: a number a player is shown has
  // to be the number the grade came from, or the sentence is decoration.
  for (const drill of accepted(25)) {
    const again = favouriteOf(drill)
    t.true(
      drill.explanation.includes(`takes ${again.takes} of the ${RUNOUTS} runouts`),
      `seed ${drill.seed}: ${drill.explanation}`,
    )
    if (again.chops > 0) {
      t.true(
        drill.explanation.includes(`chops ${again.chops}`),
        `seed ${drill.seed} does not say how many runouts chop`,
      )
    }
    t.true(
      drill.explanation.includes(`${Math.round(again.equity * 100)}%`),
      `seed ${drill.seed}: ${drill.explanation}`,
    )
  }
})

test('no spot is too close to call, none is a walkover, and none is mostly a chop', (t) => {
  // All three cuts, from the outside. Under the margin the player is right
  // either way; over the ceiling they never had to read anything; past the chop
  // ceiling the screen is not asking the question the sentence answers.
  const broken: string[] = []
  for (const drill of accepted(200)) {
    const again = favouriteOf(drill)
    if (again.equity - 0.5 < COIN_FLIP_MARGIN) broken.push(`${drill.seed}: coin flip`)
    if (again.equity > ONE_SIDED) broken.push(`${drill.seed}: ${again.equity.toFixed(2)} walkover`)
    if (again.chops / RUNOUTS > CHOP_CEILING) broken.push(`${drill.seed}: ${again.chops} chops`)
  }
  t.deepEqual(broken, [])
})

test('the filter throws away the spots that are not questions, and only those', (t) => {
  // Generation is a filtered stream. Both halves are worth holding: it has to
  // actually reject, and the reasons have to stay the ones we meant.
  const seen = new Set<RejectReason>()
  let rejected = 0
  for (const swept of SWEPT) {
    if (!swept.rejected) continue
    rejected++
    seen.add(swept.rejected)
  }
  t.true(rejected > 0, 'the filter never fired, so it is not a filter')
  t.true(
    rejected / SWEEP < 0.6,
    `${rejected} of ${SWEEP} seeds thrown away, so the stream is mostly rejection`,
  )
  t.deepEqual(
    [...seen].sort(),
    ['ambiguous', 'chop-possible', 'one-sided'],
    'the kind rejects for a reason it was not built to reject for',
  )
})

test('every spot deals seven distinct cards, both hands face up on a flop', (t) => {
  for (const drill of accepted(60)) {
    t.is(drill.board.length, 3, `seed ${drill.seed}`)
    t.is(drill.choices.length, 2, `seed ${drill.seed}`)
    const all = [...drill.board, ...cardsOf(drill, 'a'), ...cardsOf(drill, 'b')]
    t.is(all.length, 7, `seed ${drill.seed}`)
    t.is(new Set(all.map(cardToString)).size, 7, `seed ${drill.seed} deals a card twice`)
    // Both made hands are named from the start. You cannot decide which hand
    // gets there without being told what each one is now.
    for (const choice of drill.choices) t.truthy(choice.detail, `seed ${drill.seed}`)
  }
})

test('the registry says three board cards, and the spots deal three', (t) => {
  // The registry's `boardCards` is drawn before a spot exists, so nothing else
  // can catch it disagreeing with the deal.
  t.is(drillKind(KIND).boardCards, 3)
  t.is(accepted(5)[0]?.board.length, 3)
})

test('exactly one choice is the answer, and the grader accepts only it', (t) => {
  for (const drill of accepted(60)) {
    t.is(
      drill.choices.filter((choice) => choice.winning).length,
      1,
      `seed ${drill.seed} marks more than one hand`,
    )
    t.true(gradeDrill(drill, drill.answer).correct, `seed ${drill.seed}`)
    for (const choice of drill.choices) {
      t.is(gradeDrill(drill, choice.id).correct, choice.id === drill.answer, `seed ${drill.seed}`)
    }
  }
})

test('answering the same hand every time scores what a coin scores', (t) => {
  // Which of the two hands is the favourite has nothing to do with which was
  // dealt first, and this is the test that stops the rating quietly becoming a
  // reading of who noticed that "always Hand A" works.
  const drills = accepted(300)
  const a = drills.filter((drill) => drill.answer === 'a').length
  const share = a / drills.length
  t.true(drills.length > 100, `only ${drills.length} spots to measure`)
  t.true(
    share > 0.4 && share < 0.6,
    `Hand A is the answer on ${(share * 100).toFixed(0)}% of spots`,
  )
})

test('every spot carries a difficulty, and it is the one its shape is worth', (t) => {
  for (const drill of accepted(60)) {
    // The kind deals its own vocabulary and nothing else, which is the half a
    // cast would have hidden.
    t.true(isStrengthShape(drill.settledBy), `seed ${drill.seed} deals ${drill.settledBy}`)
    if (!isStrengthShape(drill.settledBy)) continue
    t.is(
      drill.difficulty,
      strengthDifficulty(drill.settledBy),
      `seed ${drill.seed} is rated something its shape is not`,
    )
    t.true(drill.difficulty >= EASIEST_STRENGTH && drill.difficulty <= HARDEST_STRENGTH)
  }
})

test('the ladder reads up, and names every shape the generator deals', (t) => {
  const ladder = spotLadder(KIND)
  t.truthy(ladder)
  if (!ladder) return
  const ratings = ladder.map((rung) => rung.rating)
  t.deepEqual(
    ratings,
    [...ratings].sort((x, y) => x - y),
    'the ladder is not in order',
  )
  const named = new Set(ladder.map((rung) => rung.settledBy))
  for (const drill of accepted(200)) {
    t.true(
      named.has(drill.settledBy),
      `${drill.settledBy} is dealt and the ladder does not name it`,
    )
  }
})

test('the hardest shape is rare, and not so rare its row can never appear', (t) => {
  // Measured 2026-09-01 over the whole sweep: clear-favourite 54%, live-underdog 44%,
  // draw-is-favourite 2.2% of accepted spots.
  //
  // **The rarest shape is the hardest one**, which is true of the other kinds
  // too and rarer here than on either of them (a split is 5.5%, a three-draw
  // turn 5.9%). Nobody chose that: a made hand on a flop usually holds up over
  // two cards, and accept/reject does not reweight the game to make the lesson
  // commoner. So the row a player would most want takes around 450 answers to
  // clear a floor of ten, and the thing to change if that is too slow is the
  // generator, not this number. What the floor guards is a change that drops
  // the shape to nearly never and leaves a row that cannot exist.
  const FLOOR = 0.015
  const drills = accepted(SWEEP)
  const counts: Record<string, number> = {}
  for (const drill of drills) counts[drill.settledBy] = (counts[drill.settledBy] ?? 0) + 1
  for (const rung of spotLadder(KIND) ?? []) {
    const share = (counts[rung.settledBy] ?? 0) / drills.length
    t.true(
      share >= FLOOR,
      `${rung.settledBy} is dealt on ${(share * 100).toFixed(1)}% of spots, so its row needs ${Math.round(10 / Math.max(share, 1e-6))} answers`,
    )
  }
})

test('the boundary between the two common shapes is the one the ladder describes', (t) => {
  // From the outside: a clear favourite takes three runouts in four, and a live
  // underdog takes at least a quarter. Both read off the recount rather than
  // off the constant that implements them.
  for (const drill of accepted(120)) {
    if (drill.settledBy === 'draw-is-favourite') continue
    const { equity } = favouriteOf(drill)
    const expected = equity < LIVE ? 'live-underdog' : 'clear-favourite'
    t.is(drill.settledBy, expected, `seed ${drill.seed} at ${(equity * 100).toFixed(1)}%`)
  }
})

test('the stream always finds a spot, and quickly enough to deal on mount', (t) => {
  // A spot here costs 990 showdowns, so the walk length is the whole budget:
  // two seeds is under a tenth of a second and twenty is a visible wait. Read
  // off the sweep as its longest run of rejections rather than by walking
  // again, which is the same measurement for none of the cost.
  let worst = 0
  let run = 0
  for (const swept of SWEPT) {
    run = swept.drill ? 0 : run + 1
    worst = Math.max(worst, run)
  }
  t.true(worst < 10, `the filter rejected ${worst} seeds in a row`)
  t.true(worst < MAX_ATTEMPTS)
  t.notThrows(() => nextDrill(KIND, 1))
})

// ---------------------------------------------------------------------------
// The gate. The half that is about money rather than poker.
// ---------------------------------------------------------------------------

// technology#55, and rule #8 under it: we never charge later for something that
// shipped free. The flag has to be on a paid kind in the commit that registers
// it, because no later commit can take back a kind that has been given away. By
// name rather than by iterating the registry, for the same reason as the other
// two paid kinds' version of this test.
test("hand strength is registered as the membership's, not as free", (t) => {
  const kind = drillKind(KIND)
  t.true(kind.membersOnly, 'a paid kind shipped without its flag is free forever')
  t.false(canPlayDrill(kind, false))
  t.true(canPlayDrill(kind, true))
})

test('the membership has three kinds in it, and the free one is still free', (t) => {
  const paid = DRILL_KINDS.filter((kind) => kind.membersOnly).map((kind) => kind.id)
  t.deepEqual(paid.sort(), ['count-your-outs', 'hand-strength', 'pot-odds'])
  t.true(canPlayDrill(drillKind('which-hand-wins'), false))
})

test('the flop kind carries no pot and no price', (t) => {
  // A stray price would draw a line of numbers over a spot that is not about
  // them, and `stakes` belongs to the kind whose question is a price.
  for (const drill of accepted(40)) {
    t.is(drill.stakes, undefined, `seed ${drill.seed}`)
    t.is(drill.hands, undefined, `seed ${drill.seed} draws its hands twice`)
  }
})
