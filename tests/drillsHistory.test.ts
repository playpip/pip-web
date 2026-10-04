import test from 'ava'
import {
  RATING_HISTORY_CAP,
  type RatingPoint,
  appendRatingPoint,
  seedRatingHistory,
  thinRatingHistory,
} from '@/lib/drills/history'
import { STARTING_RATING } from '@/lib/drills/rating'

// The drill rating's history: the line on the /stats graph.
//
// Two halves, as with the shapes. The first is the thinning, which is pure and
// is where a bug would quietly lose the start of somebody's line or let the
// profile grow without end. The second is the store action, driven for real,
// because `recordDrill` is the one place a point is written and a test that
// re-implements the append proves only that the test can append.

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

/** A history of `n` answers, one point each, with a rating that wanders. */
const line = (n: number): RatingPoint[] =>
  Array.from({ length: n + 1 }, (_, i) => [i, STARTING_RATING + ((i * 37) % 200) - 100])

test('a history that fits is left exactly as it is', (t) => {
  const points = line(50)
  t.deepEqual(thinRatingHistory(points), points)
  t.not(thinRatingHistory(points), points, 'a copy, never the array it was handed')
})

test('thinning keeps the first point and the recent stretch whole', (t) => {
  const points = line(RATING_HISTORY_CAP) // one over the cap, counting the zero
  const thinned = thinRatingHistory(points)

  t.true(thinned.length <= RATING_HISTORY_CAP)
  t.deepEqual(thinned[0], points[0], 'the start of the line is never thinned away')
  const recent = Math.floor(RATING_HISTORY_CAP / 2)
  t.deepEqual(thinned.slice(-recent), points.slice(-recent), 'the recent stretch is untouched')
})

test('a thinned point keeps its true place on the x axis', (t) => {
  // The whole reason a point is a pair: after thinning, the line is still drawn
  // over spots answered rather than over whichever points happened to survive.
  const points = line(500)
  const byAnswered = new Map(points.map(([x, y]) => [x, y]))
  const thinned = thinRatingHistory(points)
  for (const [x, y] of thinned) t.is(byAnswered.get(x), y, `point at ${x} moved`)
  for (let i = 1; i < thinned.length; i++) {
    t.true(thinned[i][0] > thinned[i - 1][0], 'strictly increasing in spots answered')
  }
})

test('a history far over the cap is brought under it in one call', (t) => {
  // A synced row or a hand-edited backup could arrive with any length. One call
  // has to settle it, however many halvings that takes.
  const thinned = thinRatingHistory(line(10_000))
  t.true(thinned.length <= RATING_HISTORY_CAP)
  t.deepEqual(thinned[0], [0, STARTING_RATING - 100])
  t.is(thinned.at(-1)?.[0], 10_000)
})

test('the cap cannot be set low enough to never finish', (t) => {
  const thinned = thinRatingHistory(line(40), 1)
  t.true(thinned.length <= 4)
  t.is(thinned[0][0], 0)
  t.is(thinned.at(-1)?.[0], 40)
})

test('appending one answer at a time never outgrows the cap', (t) => {
  let history = seedRatingHistory(0, STARTING_RATING)
  for (let answered = 1; answered <= 2_000; answered++) {
    history = appendRatingPoint(history, answered, STARTING_RATING + (answered % 50))
    t.true(history.length <= RATING_HISTORY_CAP)
  }
  t.deepEqual(history[0], [0, STARTING_RATING])
  t.deepEqual(history.at(-1), [2_000, STARTING_RATING])
  // It thins in halves, not one point at a time, so the store is not rewriting
  // the whole line on every answer once it is full.
  t.true(history.length > RATING_HISTORY_CAP / 2)
})

test('the same answers always thin to the same line', (t) => {
  const a = thinRatingHistory(line(900))
  const b = thinRatingHistory(line(900))
  t.deepEqual(a, b)
})

test('a point at the same count replaces the last rather than stacking', (t) => {
  const history: RatingPoint[] = [
    [0, 1_000],
    [3, 1_040],
  ]
  t.deepEqual(appendRatingPoint(history, 3, 1_050), [
    [0, 1_000],
    [3, 1_050],
  ])
})

test('the seed is two true points, or one when nothing was answered', (t) => {
  t.deepEqual(seedRatingHistory(0, STARTING_RATING), [[0, STARTING_RATING]])
  t.deepEqual(seedRatingHistory(40, 1_180), [
    [0, STARTING_RATING],
    [40, 1_180],
  ])
})

test('recordDrill writes a point per answer, ending on the rating', (t) => {
  useProfile.getState().reset()
  const record = useProfile.getState().recordDrill
  record('which-hand-wins', true, 1_240, 1, 'kicker')
  record('which-hand-wins', false, 820, 0, 'category')
  record('which-hand-wins', true, 1_010, 1, 'rank')

  const rec = useProfile.getState().drills['which-hand-wins']
  t.is(rec.history.length, 4, 'the starting point and one per answer')
  t.deepEqual(rec.history[0], [0, STARTING_RATING])
  t.deepEqual(
    rec.history.map(([x]) => x),
    [0, 1, 2, 3],
  )
  t.deepEqual(rec.history.at(-1), [rec.answered, rec.rating], 'the line ends on the headline')
})

test('a long session through the store stays inside the cap', (t) => {
  useProfile.getState().reset()
  const record = useProfile.getState().recordDrill
  for (let i = 0; i < 600; i++) record('count-your-outs', i % 3 !== 0, 1_180, 1, 'two-draws')
  const rec = useProfile.getState().drills['count-your-outs']
  t.true(rec.history.length <= RATING_HISTORY_CAP)
  t.deepEqual(rec.history.at(-1), [600, rec.rating])
  t.deepEqual(rec.history[0], [0, STARTING_RATING])
})
