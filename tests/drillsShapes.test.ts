import test from 'ava'
import { nextDrill } from '@/lib/drills'
import { SHAPE_MIN_ANSWERS, shapeBreakdown } from '@/lib/drills/shapes'
import { spotLadder } from '@/lib/drills/standing'
import type { DrillKindId } from '@/lib/drills/types'

// The per-shape breakdown: which shapes of spot you get right, printed as the
// fraction it is.
//
// Two halves, and the second one is the half that would have shipped broken.
// The first is the join itself, which is small: a kind's ladder crossed with
// the counters on the profile, floored, easiest first. The second is whether
// the surface can ever appear, which is a question about the generators rather
// than about this file, and which no amount of reading the join can answer.
//
// **The counting is tested through the real store action.** `recordDrill` is
// where a shape is counted, so a test that reimplements the increment proves
// only that the test can add up. Driving `useProfile` in node is a little
// unusual here and it is the whole point: what is asserted below is the code
// the runner calls.

/**
 * An in-memory `localStorage` so the persist middleware has somewhere to write.
 *
 * Without it the store still works and prints a warning per write, which is a
 * few hundred lines of noise across this file. Installed before the store is
 * imported, which is why the import below is dynamic: a static one is hoisted
 * above this and the shim would arrive too late.
 */
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
})

const { useProfile } = await import('@/store/profile')

const KINDS: DrillKindId[] = ['which-hand-wins', 'count-your-outs']

/** How often each shape is dealt over a run of seeds. */
function shapeFrequency(kind: DrillKindId, seeds: number): Record<string, number> {
  const counts: Record<string, number> = {}
  for (let s = 1; s <= seeds; s++) {
    const drill = nextDrill(kind, (s * 2_654_435_761) % 2_147_483_647)
    counts[drill.settledBy] = (counts[drill.settledBy] ?? 0) + 1
  }
  return counts
}

test('the shape floor is ten answers', (t) => {
  // Pinned to its value, in the discipline of tests/noiseFloors.test.ts, and
  // for a weaker reason than those two. This floor is not the point at which
  // the product starts making a claim about a person, because the row makes no
  // claim: "3 of 11" is eleven answers the player gave, and the sample size is
  // printed rather than hidden behind a percentage. All the number does is keep
  // "1 of 1" off the screen. Moving it is still a decision about how little
  // evidence we will print, so it costs an edit here.
  t.is(
    SHAPE_MIN_ANSWERS,
    10,
    'SHAPE_MIN_ANSWERS decides how few answers a shape row is worth printing. Say why in the commit.',
  )
})

test('rows come back easiest first, in the ladder’s order', (t) => {
  const kind: DrillKindId = 'which-hand-wins'
  const ladder = spotLadder(kind)
  if (!ladder) return t.fail('the free kind has a ladder')

  const shapes = Object.fromEntries(
    // Deliberately built in reverse, so an implementation that iterates the
    // record's keys instead of the ladder comes back hardest first and fails.
    [...ladder].reverse().map((s) => [s.settledBy, { answered: 20, correct: 10 }]),
  )
  const rows = shapeBreakdown(kind, shapes)

  t.deepEqual(
    rows.map((r) => r.settledBy),
    ladder.map((s) => s.settledBy),
  )
  t.deepEqual(
    rows.map((r) => r.label),
    ladder.map((s) => s.label),
    'the row and the standing sentence call a shape the same thing',
  )
})

test('a shape under the floor is absent, and at the floor it is a row', (t) => {
  const under = shapeBreakdown('which-hand-wins', {
    category: { answered: SHAPE_MIN_ANSWERS - 1, correct: 4 },
  })
  t.deepEqual(under, [])

  const at = shapeBreakdown('which-hand-wins', {
    category: { answered: SHAPE_MIN_ANSWERS, correct: 4 },
  })
  t.is(at.length, 1)
  t.is(at[0].answered, SHAPE_MIN_ANSWERS)
  t.is(at[0].correct, 4, 'the counters are printed, never rounded into a percentage')
})

test('a shape the ladder does not name is dropped', (t) => {
  // The failure: a shape retired or renamed in a later version, still sitting
  // in a profile persisted before it went, rendering a row with no label on it.
  const rows = shapeBreakdown('which-hand-wins', {
    category: { answered: 30, correct: 20 },
    'flush-over-flush': { answered: 30, correct: 1 },
  })
  t.deepEqual(
    rows.map((r) => r.settledBy),
    ['category'],
  )
})

test('a record with no shapes on it at all is not a crash', (t) => {
  // What a v15 profile looks like the moment after the migration, and what the
  // remote half of a merge looks like if an older client wrote it.
  t.deepEqual(shapeBreakdown('which-hand-wins', undefined), [])
  t.deepEqual(shapeBreakdown('which-hand-wins', {}), [])
})

test('the store counts by shape, and the rows add up to the kind’s total', (t) => {
  // Through `recordDrill` itself, with spots from the real generator. The
  // invariant is true of one device: every answer is counted once in the total
  // and once under its shape, so the two sums agree. (Across two devices a
  // merge can leave the rows summing higher, which is why nothing shows that
  // sum, see mergeShapes in lib/sync/merge.ts.)
  const kind: DrillKindId = 'which-hand-wins'
  useProfile.getState().reset()

  let expectedCorrect = 0
  for (let s = 1; s <= 120; s++) {
    const drill = nextDrill(kind, s * 7_919)
    // Right on two spots in three, so `correct` is neither the total nor zero.
    const correct = s % 3 !== 0
    if (correct) expectedCorrect++
    useProfile.getState().recordDrill(kind, correct, drill.difficulty, 0, drill.settledBy)
  }

  const record = useProfile.getState().drills[kind]
  t.is(record.answered, 120)
  t.is(record.correct, expectedCorrect)

  const rows = Object.values(record.shapes)
  t.is(
    rows.reduce((sum, r) => sum + r.answered, 0),
    record.answered,
    'every answer landed under exactly one shape',
  )
  t.is(
    rows.reduce((sum, r) => sum + r.correct, 0),
    record.correct,
  )
  for (const [shape, row] of Object.entries(record.shapes)) {
    t.true(row.correct <= row.answered, `${shape} cannot be right more often than asked`)
  }
})

test('a fresh record starts with no shapes rather than a row of zeroes', (t) => {
  useProfile.getState().reset()
  t.false('which-hand-wins' in useProfile.getState().drills, 'no record before the first answer')

  const drill = nextDrill('which-hand-wins', 4_242)
  useProfile.getState().recordDrill('which-hand-wins', false, drill.difficulty, 0, drill.settledBy)

  const record = useProfile.getState().drills['which-hand-wins']
  t.deepEqual(Object.keys(record.shapes), [drill.settledBy], 'one answer, one shape')
  t.deepEqual(shapeBreakdown('which-hand-wins', record.shapes), [], 'and nothing on screen yet')
})

// ---------------------------------------------------------------------------
// Whether the surface can ever appear. This is the half that reading the join
// cannot answer, and it is a fact about the generators.
// ---------------------------------------------------------------------------

test('every shape a generator deals is named on its kind’s ladder', (t) => {
  // The join drops what the ladder does not name, which is right for a retired
  // shape and silent for a live one. If a kind ever starts dealing a shape
  // nobody added to the ladder, those answers are counted and never shown.
  for (const kind of KINDS) {
    const named = new Set<string>(spotLadder(kind)?.map((s) => s.settledBy))
    for (const shape of Object.keys(shapeFrequency(kind, 400))) {
      t.true(named.has(shape), `${kind} deals ${shape} and its ladder does not name it`)
    }
  }
})

test('every shape on a ladder is dealt often enough for its row to be reachable', (t) => {
  // Measured 2026-08-26 over 2,000 seeds a kind. `which-hand-wins`: category
  // ~50%, kicker ~23%, rank ~21%, split ~5.5%. `count-your-outs`: one-draw
  // ~56%, two-draws ~38%, many-draws ~5.9%.
  //
  // **The rarest shape is the hardest one on both ladders**, so the row a
  // player would most want is the one that takes longest to appear: at one spot
  // in eighteen, `split` and `many-draws` need around two hundred answers to
  // clear a floor of ten. That is a real property of the generators and it is
  // the number to change if we ever decide the hard shapes should be readable
  // sooner. The bound here is deliberately loose: what it is guarding is a
  // generator change that drops a shape to nearly never, which would leave a
  // row that quietly cannot exist.
  const FLOOR = 0.02
  for (const kind of KINDS) {
    const seeds = 2_000
    const counts = shapeFrequency(kind, seeds)
    for (const shape of spotLadder(kind) ?? []) {
      const share = (counts[shape.settledBy] ?? 0) / seeds
      t.true(
        share >= FLOOR,
        `${kind} deals ${shape.settledBy} on ${(100 * share).toFixed(1)}% of spots, so its row needs ${Math.round(SHAPE_MIN_ANSWERS / Math.max(share, 1e-6))} answers to appear`,
      )
    }
  }
})
