import test from 'ava'
import { DRILL_KINDS } from '@/config/drills'
import {
  AIM_BAND,
  AIM_SAMPLE,
  RATING_FLOOR,
  SETTLING_SPOTS,
  STARTING_RATING,
  aimFor,
  drillAt,
  nextDrill,
} from '@/lib/drills'
import { kindFloor, spotLadder } from '@/lib/drills/standing'
import type { DrillKindId } from '@/lib/drills/types'

// The spots are chosen for the player now, and this file is the whole of that
// claim.
//
// **What it replaces.** Every kind used to deal the first spot its filter
// accepted, so difficulty was whatever fell out of the shuffle: a player's
// second-ever hand could be a split pot or three draws at once — the top of the
// kind's own ladder. The rating existed and selected nothing, which is the
// difference between a set of puzzles and a shuffle (Will, 2026-09-21).
//
// Three properties, and none of them is about being kind to anybody:
//
// 1. A beginner opens at the bottom of the kind's ladder.
// 2. A player above the ladder stops being asked the easy ones.
// 3. Nothing here reads the clock, caps anything, or makes a spot unreachable.
//    The aim is a preference over a stream, not a gate on it.

const KINDS = DRILL_KINDS.map((kind) => kind.id)

/** What a run of spots at this aim actually deals. */
function dealt(kind: DrillKindId, aim: number, count = 40): number[] {
  return Array.from({ length: count }, (_, i) => nextDrill(kind, 1_000 + i * 977, aim).difficulty)
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

test('a player with no record is aimed at the bottom of the ladder', (t) => {
  for (const kind of KINDS) {
    t.is(aimFor(kindFloor(kind), STARTING_RATING, 0), kindFloor(kind), kind)
  }
})

test('the aim walks from the ladder’s bottom to the rating, and then stays there', (t) => {
  const floor = 620
  const rating = 1_200
  t.is(aimFor(floor, rating, 0), floor)
  t.is(aimFor(floor, rating, SETTLING_SPOTS), rating)
  t.is(aimFor(floor, rating, SETTLING_SPOTS * 10), rating, 'the aim drifted after settling')
  // Monotonic in between, so there is no rung where the spots get easier for
  // having answered one more.
  let last = floor
  for (let answered = 0; answered <= SETTLING_SPOTS; answered++) {
    const aim = aimFor(floor, rating, answered)
    t.true(aim >= last, `answered ${answered}: the aim went backwards`)
    last = aim
  }
})

test('a player below the ladder is aimed below it, not lifted onto it', (t) => {
  // Somebody who has answered fifty and is rated under the easiest shape is
  // being told something true. Aiming above them would be the drill deciding it
  // knows better than their own answers.
  const aim = aimFor(950, RATING_FLOOR, 50)
  t.is(aim, RATING_FLOOR)
})

// The behaviour that matters, per kind: the spots a beginner is dealt are
// easier than the spots a strong player is dealt. Run over every registered
// kind, so a new one cannot quietly opt out of being a ladder.
test('every kind deals a beginner easier spots than it deals somebody above it', (t) => {
  for (const kind of KINDS) {
    const ladder = spotLadder(kind)
    if (!ladder || ladder.length < 2) continue
    const bottom = mean(dealt(kind, aimFor(kindFloor(kind), STARTING_RATING, 0)))
    const top = mean(dealt(kind, aimFor(kindFloor(kind), 2_000, 100)))
    t.true(
      bottom < top,
      `${kind}: a beginner averages ${bottom.toFixed(0)} and a strong player ${top.toFixed(0)}`,
    )
    // And the beginner's spots really are the easy rung rather than merely
    // easier: within a band of the bottom of the ladder.
    t.true(
      bottom <= ladder[0].rating + AIM_BAND,
      `${kind}: a beginner averages ${bottom.toFixed(0)}, ladder starts at ${ladder[0].rating}`,
    )
  }
})

// Aiming higher deals harder spots, on every kind and at every rung. This is
// the property that holds without exception, and it is the one a player feels:
// the spots follow the number.
test('aiming at a higher rung deals harder spots, on every kind', (t) => {
  for (const kind of KINDS) {
    const ladder = spotLadder(kind)
    if (!ladder) continue
    const averages = ladder.map((rung) => mean(dealt(kind, rung.rating, 24)))
    for (let i = 1; i < averages.length; i++) {
      t.true(
        averages[i] >= averages[i - 1],
        `${kind}: aiming at ${ladder[i].rating} deals easier spots than aiming at ${ladder[i - 1].rating}`,
      )
    }
    t.true(averages.at(-1)! > averages[0], `${kind}: the aim moves nothing`)
  }
})

/** How often this kind deals this shape, measured rather than assumed. */
function frequency(kind: DrillKindId, settledBy: string): number {
  let kept = 0
  let seen = 0
  for (let seed = 1; seed <= 600; seed++) {
    const { drill } = drillAt(kind, seed)
    if (!drill) continue
    kept++
    if (drill.settledBy === settledBy) seen++
  }
  return seen / kept
}

// **An aim finds a rung when the kind's budget can afford to look for it, and
// the exceptions are a property of the generators rather than of aiming.**
//
// The walk looks at `AIM_SAMPLE[kind]` accepted spots at most, so a shape it
// deals rarely cannot be found by a walk that sees two — and two is what
// `hand-strength` gets, because a spot there is 990 showdowns (see the table on
// AIM_SAMPLE). Both of that kind's upper rungs come out excused: its hardest
// shape is 2% of what it deals *by construction*, and even the middle one at
// 44% is under the line when the budget is two.
//
// **That is a smaller loss than it reads as.** Before aiming, a player got
// whatever the shuffle produced — 2% for the hardest shape there, exactly as
// now. Aiming on this kind moves the average rather than picking the rung, and
// the test above holds the part that matters: a higher aim still deals harder
// spots. `which-hand-wins` sits just under the line on split pots for the same
// reason, at 5%.
//
// So the expectation is derived here rather than written down: where the kind
// deals a shape often enough for its own budget to catch one, the aim has to
// catch it. The test says out loud which rungs it excused, so a change that
// quietly made three more of them rare reads as a diff.
test('an aim lands on its rung wherever the kind’s budget can find it', (t) => {
  const excused: string[] = []
  for (const kind of KINDS) {
    const ladder = spotLadder(kind)
    if (!ladder) continue
    for (const rung of ladder) {
      const reachable = frequency(kind, String(rung.settledBy)) * AIM_SAMPLE[kind]
      if (reachable < 1) {
        excused.push(`${kind}:${rung.settledBy}`)
        continue
      }
      const spots = dealt(kind, rung.rating, 12)
      const near = spots.filter((d) => Math.abs(d - rung.rating) <= AIM_BAND).length
      t.true(near >= 6, `${kind} at ${rung.rating}: only ${near} of 12 landed on the rung`)
    }
  }
  t.deepEqual(
    excused.sort(),
    ['hand-strength:draw-is-favourite', 'hand-strength:live-underdog', 'which-hand-wins:split'],
    'a different set of rungs is now too rare for its kind to aim at — decide whether that ' +
      'is a generator that got stingier or a budget that got too small, and say which here',
  )
})

// **Aiming narrows nothing.** Every shape a kind deals is still reachable — at
// the aim that asks for it — so the hardest rung is not a thing a player can be
// locked out of by their own rating.
test('every shape on every ladder is still dealt, at the aim that asks for it', (t) => {
  for (const kind of KINDS) {
    const ladder = spotLadder(kind)
    if (!ladder) continue
    for (const rung of ladder) {
      const spots = Array.from({ length: 60 }, (_, i) =>
        nextDrill(kind, 5_000 + i * 613, rung.rating),
      )
      t.true(
        spots.some((spot) => spot.settledBy === rung.settledBy),
        `${kind}: ${rung.settledBy} never appeared, even when asked for`,
      )
    }
  }
})

// The old behaviour is still the behaviour without an aim, which is what lets
// every other test in the suite go on saying what it said.
test('no aim means the first accepted spot, exactly as before', (t) => {
  for (const kind of KINDS) {
    for (const seed of [1, 77, 4_242]) {
      let expected = null
      for (let attempt = 0; attempt < 500 && !expected; attempt++) {
        expected = drillAt(kind, (seed + attempt) >>> 0).drill
      }
      t.deepEqual(nextDrill(kind, seed), expected, `${kind} at ${seed}`)
    }
  }
})

test('the walk is deterministic in the seed and the aim', (t) => {
  for (const kind of KINDS) {
    t.deepEqual(nextDrill(kind, 4_242, 1_000), nextDrill(kind, 4_242, 1_000), kind)
  }
})

// The sample is a budget on generation and the expensive kinds get a smaller
// one (see AIM_SAMPLE). Pinned so that raising the cheap ones cannot quietly
// raise the one that costs 31ms a spot.
test('the generation budget is set per kind, and the dear one is the small one', (t) => {
  for (const kind of KINDS) {
    t.true(AIM_SAMPLE[kind] >= 1, `${kind} has no budget`)
    t.true(AIM_SAMPLE[kind] <= 16, `${kind}: a budget this size is not a budget`)
  }
  t.true(
    AIM_SAMPLE['hand-strength'] < AIM_SAMPLE['which-hand-wins'],
    'the kind that enumerates 990 showdowns is sampled as hard as the cheap one',
  )
})

// A spot has to arrive between one tap and the next. The aim walks more seeds
// than the old path did, so the cost of the walk is the thing to hold, and it
// is held on the kind that is dearest to generate.
test('a spot still arrives quickly enough to deal on a tap', (t) => {
  for (const kind of KINDS) {
    const aim = aimFor(kindFloor(kind), STARTING_RATING, 0)
    const started = performance.now()
    for (let i = 0; i < 10; i++) nextDrill(kind, 20_000 + i * 31, aim)
    const each = (performance.now() - started) / 10
    t.true(each < 250, `${kind}: ${each.toFixed(0)}ms a spot`)
  }
})

// **The aim can make one answer the usual one, and then the button wins.** At
// the top of "Which hand wins?" the nearest rung is the split pot, and before
// the cap more than half the spots dealt at 1400 and up were splits — pressing
// "They split it" every time was a winning strategy (Will, 2026-09-23). The cap
// holds splits to at most a fifth wherever the aim would have chosen them, and
// leaves the low end exactly as it was.
test('a high rating on which-hand-wins is not mostly split pots', (t) => {
  for (const aim of [1400, 1600, 2000]) {
    let splits = 0
    const n = 400
    for (let i = 1; i <= n; i++) {
      if (nextDrill('which-hand-wins', i * 104_729, aim).answer === 'split') splits++
    }
    t.true(splits / n <= 0.25, `${aim}: ${splits} of ${n} were splits`)
    t.true(splits > 0, `${aim}: the cap removed split pots altogether`)
  }
  let low = 0
  for (let i = 1; i <= 400; i++) {
    if (nextDrill('which-hand-wins', i * 104_729, 800).answer === 'split') low++
  }
  t.true(low <= 8, `at 800 the cap should change nothing, and ${low} of 400 were splits`)
})
