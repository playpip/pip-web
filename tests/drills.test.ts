import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'
import { DRILL_KINDS, drillKind } from '@/config/drills'
import {
  EASIEST_SPOT,
  HARDEST_SPOT,
  MAX_ATTEMPTS,
  RATING_FLOOR,
  STARTING_RATING,
  drillAt,
  expectedScore,
  gradeDrill,
  kFactor,
  nextDrill,
  nextRating,
} from '@/lib/drills'
import type { Drill, RejectReason } from '@/lib/drills/types'
import { cardToString } from '@/lib/poker/cards'
import { determineWinners, evaluateHand } from '@/lib/poker/handEval'

// A drill grades a stranger, in public, on a page that is free and unmetered.
// The engine settling it is exact, so anything wrong here is wrong in the layer
// above it: the spot that was dealt, the sentence under the answer, or the
// filter that decides which spots are worth asking. That is what this file is
// for. Fixed seeds in, fixed grades out, and the properties that have to hold
// across a large sample rather than on three hand-picked spots.

const KIND = 'which-hand-wins'

/** Every accepted spot in a range of seeds. */
function accepted(from: number, count: number): Drill[] {
  const drills: Drill[] = []
  for (let seed = from; seed < from + count; seed++) {
    const { drill } = drillAt(KIND, seed)
    if (drill) drills.push(drill)
  }
  return drills
}

const cards = (drill: Drill, id: string) => drill.choices.find((c) => c.id === id)?.cards ?? []

test('the same seed is the same spot, forever', (t) => {
  for (const seed of [1, 36, 1_000, 4_294_967_295]) {
    t.deepEqual(drillAt(KIND, seed), drillAt(KIND, seed), `seed ${seed}`)
  }
})

// The pinned spots. Not a golden file for its own sake: these are the four
// shapes the sentence has to get right (a category beating another, a card
// settling two of the same hand, a kicker settling two identical hands, and a
// split), and if the generator or the wording moves they say so here rather
// than on the page.
const PINNED: { seed: number; answer: string; explanation: string }[] = [
  {
    seed: 36,
    answer: 'b',
    explanation: 'Hand B takes it: three of a kind beats two pair.',
  },
  {
    seed: 7,
    answer: 'b',
    explanation: 'Hand B takes it: both make a pair, and the six outranks the four.',
  },
  {
    seed: 27,
    answer: 'a',
    explanation: 'Hand A takes it: both make a pair, and the king outkicks the nine.',
  },
  {
    seed: 39,
    answer: 'split',
    explanation: 'Both make two pair, and neither is higher, so the pot is split.',
  },
  {
    seed: 4,
    answer: 'a',
    explanation: 'Hand A takes it: neither hand makes a pair, and the ace outkicks the jack.',
  },
]

test('fixed seeds grade the same way every run', (t) => {
  for (const pin of PINNED) {
    const { drill } = drillAt(KIND, pin.seed)
    if (!drill) {
      t.fail(`seed ${pin.seed} no longer generates a spot`)
      continue
    }
    t.is(drill.answer, pin.answer, `seed ${pin.seed}: answer`)
    t.is(drill.explanation, pin.explanation, `seed ${pin.seed}: explanation`)
    t.true(gradeDrill(drill, pin.answer).correct, `seed ${pin.seed}: grade`)
  }
})

// The one that matters most. The grade is settled at generation time, so this
// re-runs the evaluator over the cards the drill actually dealt and checks the
// two agree. If they ever don't, a player is being marked wrong for being
// right, which is the failure this drill exists to be incapable of.
test('every answer agrees with the evaluator, recomputed from the dealt cards', (t) => {
  const drills = accepted(1, 3_000)
  t.true(drills.length > 2_000, 'sample too small to mean anything')
  for (const drill of drills) {
    const { winners } = determineWinners(
      [
        { id: 'a', hole: cards(drill, 'a') },
        { id: 'b', hole: cards(drill, 'b') },
      ],
      drill.board,
    )
    const expected = winners.length > 1 ? 'split' : winners[0]
    t.is(drill.answer, expected, `seed ${drill.seed}`)
  }
})

test('the grader accepts the answer and nothing else', (t) => {
  for (const drill of accepted(50_000, 500)) {
    for (const choice of drill.choices) {
      const grade = gradeDrill(drill, choice.id)
      t.is(grade.correct, choice.id === drill.answer, `seed ${drill.seed}: ${choice.id}`)
      t.is(grade.answer, drill.answer)
      t.is(grade.explanation, drill.explanation)
    }
  }
})

test('the reveal marks every winning hand, and a split marks all three', (t) => {
  for (const drill of accepted(1, 2_000)) {
    const winning = drill.choices.filter((choice) => choice.winning).map((choice) => choice.id)
    if (drill.answer === 'split') {
      t.deepEqual(winning.sort(), ['a', 'b', 'split'], `seed ${drill.seed}`)
    } else {
      t.deepEqual(winning, [drill.answer], `seed ${drill.seed}`)
    }
  }
})

test('every spot deals nine distinct cards and plays five of each seven', (t) => {
  for (const drill of accepted(1, 2_000)) {
    t.is(drill.board.length, 5, `seed ${drill.seed}: board`)
    const all = [...drill.board, ...cards(drill, 'a'), ...cards(drill, 'b')].map(cardToString)
    t.is(new Set(all).size, 9, `seed ${drill.seed}: a card is dealt twice`)
    for (const id of ['a', 'b']) {
      const choice = drill.choices.find((c) => c.id === id)
      const seven = new Set([...drill.board, ...cards(drill, id)].map(cardToString))
      t.is(choice?.cards.length, 2, `seed ${drill.seed}: ${id} hole`)
      t.is(choice?.plays?.length, 5, `seed ${drill.seed}: ${id} best five`)
      for (const card of choice?.plays ?? []) {
        t.true(seven.has(cardToString(card)), `seed ${drill.seed}: ${id} plays a card it lacks`)
      }
    }
  }
})

// The explanation is the part a reader is asked to trust, so it is checked
// against the grade rather than only for being non-empty.
test('no explanation names a hand other than the one that won', (t) => {
  for (const drill of accepted(1, 3_000)) {
    const { explanation, answer, seed } = drill
    t.true(explanation.endsWith('.'), `seed ${seed}: not a sentence`)
    if (answer === 'split') {
      t.true(explanation.includes('split'), `seed ${seed}: ${explanation}`)
      t.false(explanation.includes('takes it'), `seed ${seed}: ${explanation}`)
    } else {
      const winner = answer === 'a' ? 'Hand A' : 'Hand B'
      const loser = answer === 'a' ? 'Hand B' : 'Hand A'
      t.true(explanation.startsWith(`${winner} takes it:`), `seed ${seed}: ${explanation}`)
      t.false(explanation.includes(loser), `seed ${seed}: ${explanation}`)
    }
  }
})

// Generation is a filtered stream rather than a raw one. Both halves of that
// are worth holding: the filter has to actually reject, and the reason it
// rejects for has to stay the one we meant.
test('the filter throws away one-sided spots, and only those', (t) => {
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
  }
  let kept = 0
  for (let seed = 1; seed <= 5_000; seed++) {
    const { drill, rejected } = drillAt(KIND, seed)
    if (drill) kept++
    else if (rejected) counts[rejected]++
  }
  t.true(counts['one-sided'] > 100, `the filter is not biting: ${counts['one-sided']} rejected`)
  t.true(kept > counts['one-sided'], 'more spots are thrown away than kept')
  // The reasons that belong to the two turn kinds. This kind has no turn, no
  // chop rule, no draw to be dead on and no price to be close to, so seeing one
  // here would mean the generators had got crossed.
  for (const reason of ['already-ahead', 'chop-possible', 'drawing-dead', 'ambiguous'] as const) {
    t.is(counts[reason], 0, `${reason} is not this kind's vocabulary`)
  }
  // Not a tuning knob. This fires when the sentence and the grade came from
  // different readings of the same hand, which would mean the drill had gone
  // quiet about spots it cannot explain instead of us hearing about it.
  t.is(counts.unexplainable, 0, 'a spot could not be explained from its own evaluation')
})

// What "one-sided" means, checked from the outside rather than from the
// constant that implements it: a flush against a pair is a look, not a
// question, and it should not survive the filter.
test('the accepted spots are within one hand category of each other', (t) => {
  for (const drill of accepted(1, 2_000)) {
    const [a, b] = ['a', 'b'].map((id) => evaluateHand(cards(drill, id), drill.board))
    t.true(
      Math.abs(a.categoryRank - b.categoryRank) <= 1,
      `seed ${drill.seed}: ${a.name} v ${b.name}`,
    )
    for (const id of ['a', 'b']) {
      t.true(
        (drill.choices.find((c) => c.id === id)?.detail ?? '').length > 0,
        `seed ${drill.seed}`,
      )
    }
  }
})

test('the stream always finds a spot, and quickly', (t) => {
  let worst = 0
  for (let seed = 1; seed <= 2_000; seed++) {
    let attempts = 1
    while (!drillAt(KIND, seed + attempts - 1).drill) attempts++
    worst = Math.max(worst, attempts)
    t.is(nextDrill(KIND, seed).seed, seed + attempts - 1)
  }
  // Far under MAX_ATTEMPTS, and stated as a number so that a generator which
  // starts rejecting nearly everything fails here rather than in a browser.
  t.true(worst < 25, `worst run of rejections was ${worst}`)
  t.true(MAX_ATTEMPTS > worst * 10)
})

test('every registered kind is complete and generates', (t) => {
  for (const kind of DRILL_KINDS) {
    t.is(drillKind(kind.id), kind)
    t.regex(kind.id, /^[a-z0-9-]+$/)
    t.true(kind.title.length > 0 && kind.blurb.length > 0 && kind.question.length > 0)
    t.true(kind.gradedBy.length > 0)
    t.is(nextDrill(kind.id, 1).kind, kind.id)
  }
})

// The bug this pins shipped, and it was invisible from every angle a test
// usually looks from: the engine was right, the grades were right, and the
// screen still showed one player the same nine cards every time they opened it
// (Will, 14 Aug). The app is a static export, so a spot generated during a
// render is generated once — at build time — and baked into the HTML. Every
// screen therefore deals from `randomSeed()`, on mount, and a fixed seed
// reaching a component is the thing to fail on.
test('the screens deal a fresh spot, never a fixed one', (t) => {
  for (const file of readdirSync(new URL('../src/components/drills', import.meta.url))) {
    const source = readFileSync(
      new URL(`../src/components/drills/${file}`, import.meta.url),
      'utf-8',
    )
    const calls = source.match(/nextDrill\([^)]*\)/g) ?? []
    for (const call of calls) {
      t.regex(call, /randomSeed\(\)/, `${file}: "${call}" is the same spot for every visitor`)
    }
  }
})

// The kinds are one route, /game/drills/[kind], enumerated from the registry
// rather than a folder each. So the thing worth holding is the other way round
// from the old one: the route exists, it is inside the app, and there is no
// drill left out on the website.
test('drills are app routes, and only app routes', (t) => {
  t.true(readdirSync(new URL('../src/app/game/drills', import.meta.url)).includes('[kind]'))
  t.throws(() => readdirSync(new URL('../src/app/drills', import.meta.url)), {
    code: 'ENOENT',
  })
})

// --- what may never be built here ------------------------------------------
//
// Three rules, each of which would otherwise be eroded by one reasonable-looking
// commit rather than by a decision anyone would notice making. They are tests
// and not comments for exactly that reason.

const libSources = () =>
  readdirSync(new URL('../src/lib/drills', import.meta.url)).map((f) => `src/lib/drills/${f}`)

const drillSources = () => [
  ...libSources(),
  ...readdirSync(new URL('../src/components/drills', import.meta.url)).map(
    (f) => `src/components/drills/${f}`,
  ),
]

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')

/**
 * A file with its comments taken out.
 *
 * The bans below are on what the code does, not on what it is allowed to say
 * about itself: a note explaining why there is no allowance here must not read
 * as an allowance. String literals are kept, because a meter's worst form is a
 * line of copy telling somebody what they have left.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

// 1. The free kind is unmetered by ruling (technology#38). Progress is now kept
//    — a rating, a best run, an accuracy — and that is a different thing from a
//    meter: one is a mirror of what you did, the other is a number you run out
//    of. The engine stays pure so the only place that can hold either is the
//    profile, and the words a meter would need are banned outright.
test('the drills layer keeps a score and never keeps a limit', (t) => {
  for (const path of libSources()) {
    const source = code(path)
    t.notRegex(source, /localStorage|sessionStorage|indexedDB/, `${path}: storage in the engine`)
    t.notRegex(source, /@\/store\//, `${path}: the engine reaches for a store`)
  }
  for (const path of drillSources()) {
    const source = code(path)
    // The screens read the profile, which persists itself. Nothing in the
    // drills layer talks to storage directly.
    t.notRegex(source, /localStorage|sessionStorage|indexedDB/, `${path}: storage`)
    // The vocabulary of a meter. If one of these is genuinely needed for
    // something else, that is the moment to check it is not this.
    t.notRegex(
      source,
      /\b(remaining|lockout|locked|paywall|quota|allowance|freeTrial|drillsLeft)\b/i,
      `${path}: reads like a meter`,
    )
  }
})

// 2. No clock. A daily streak, a decay, a "come back tomorrow" and a "you have
//    not played since Tuesday" all need to know what day it is, and none of
//    them can be built in a folder that cannot find out. This is the house
//    position from lib/daily.ts ("no streaks, no history pressure") made
//    mechanical, and it is the guard that stops the rating quietly becoming a
//    thing you can be behind on.
test('nothing in the drills layer can read the clock', (t) => {
  for (const path of drillSources()) {
    t.notRegex(code(path), /\bDate\b|\bperformance\.now\b/, `${path}: reads the clock`)
  }
})

// 3. The rating is arithmetic on the answers and nothing else — no bonus for
//    turning up, no floor under a wrong answer, no multiplier.
test('the rating only ever moves on the answer', (t) => {
  // Right on a spot above you is worth a lot; right on a spot far below you is
  // worth nothing at all, and says so rather than inventing a point.
  t.true(nextRating(1_000, 1_400, true, 100) > 1_000)
  t.is(nextRating(1_600, 820, true, 100), 1_600)
  t.true(nextRating(1_600, 820, false, 100) <= 1_581)
  // Wrong on a spot far above you costs almost nothing.
  t.true(nextRating(800, 1_400, false, 100) >= 794)

  // It cannot fall through the floor however long you get it wrong.
  let rating = STARTING_RATING
  for (let i = 0; i < 500; i++) rating = nextRating(rating, EASIEST_SPOT, false, i)
  t.is(rating, RATING_FLOOR)

  // And missing the hardest spots does not drag you to the floor at all: it
  // settles where missing them is what somebody at that rating is expected to
  // do. Elo doing its job, and worth pinning because it is the difference
  // between a rating and a punishment.
  rating = STARTING_RATING
  for (let i = 0; i < 500; i++) rating = nextRating(rating, HARDEST_SPOT, false, i)
  t.true(rating > RATING_FLOOR + 200, `the hardest spots alone bottomed it out at ${rating}`)

  // And it settles rather than running away. There is no ceiling in the code —
  // the spots are the ceiling: once the gain from the hardest spot this kind
  // can deal rounds to nothing, the number stops, and answering another two
  // thousand perfectly does not move it a point. That is why nothing here has
  // to cap it.
  rating = STARTING_RATING
  for (let i = 0; i < 2_000; i++) rating = nextRating(rating, HARDEST_SPOT, true, i)
  const settled = rating
  for (let i = 2_000; i < 4_000; i++) rating = nextRating(rating, HARDEST_SPOT, true, i)
  t.is(rating, settled, `still climbing at ${rating}`)
  t.true(settled < HARDEST_SPOT + 800, `runaway rating: ${settled}`)

  // Calibration is fast, then it is not.
  t.true(kFactor(0) > kFactor(20))
  t.true(kFactor(20) > kFactor(200))
  t.is(kFactor(200), kFactor(20_000), 'the K-factor stops moving')

  // Elo's own identity, which is what makes the two directions fair against
  // each other: at your own level the spot is a coin flip.
  t.is(expectedScore(1_000, 1_000), 0.5)
})

// 4. No drill is graded against what the AI would do.
//
//    The spec's fifth kind, the spot trainer, is specified as graded by "the AI
//    policy plus equity", and `decideAction` cannot carry that. Measured with
//    `pnpm spot-sim` on 2026-09-02, n=120 spots per venue, asking the identical
//    HandState twelve times under twelve seeds: at Friends' Garage its own bot
//    gave more than one answer on 82.5% of spots and flipped between folding
//    and continuing on 81.7%. That is by design and not a defect. `misread`
//    scales noise into the hand-strength estimate by skill, there is an
//    outright random give-up fold below skill 1, and `estimateEquity` is
//    sampled, so at the profile's own 600 iterations the estimate's band is
//    wider than the 4-point ambiguity margin meant to protect the grade.
//
//    Even the fairest possible key, skill 1 with no misread and no give-up,
//    still answered differently on 57.5% and flipped fold-versus-continue on
//    40.8%. **A grader that changes its mind about the same position is not a
//    grader**, and this is the one drill failure our own credibility argument
//    says we cannot ship: marking a correct answer wrong.
//
//    The rest of the measurement is why this is a ban on the grader and not on
//    the kind. On the spots that were stable and unambiguous, the policy never
//    once disagreed with the price the pot was laying (0 of 46 at the Garage, 0
//    of 50 at the Pub, so under about 7% by the rule of three). That is
//    selection rather than vindication: a spot that survives twelve seeds is
//    one where the decision was never close. Grade a spot trainer against
//    equity versus price, which is exact arithmetic on a number with a stated
//    band, and it is defensible. Grade it against the bot and it is not.
test('no drill grades against the AI policy', (t) => {
  for (const path of drillSources()) {
    t.notRegex(
      code(path),
      /decideAction|poker\/ai\/policy/,
      `${path}: grades against the AI policy, which answers the same spot differently`,
    )
  }
})

// The difficulty on a spot is part of the contract and travels with the seed,
// like the sentence and the grade do. Everything that scores an answer reads
// it off the drill rather than working it out again from the cards.
test('every spot carries a difficulty, and it matches how it was settled', (t) => {
  const seen = new Set<string>()
  for (const drill of accepted(1, 3_000)) {
    seen.add(drill.settledBy)
    t.is(drill.difficulty, gradeDrill(drill, drill.answer).difficulty, `seed ${drill.seed}`)
    t.true(
      drill.difficulty >= EASIEST_SPOT && drill.difficulty <= HARDEST_SPOT,
      `seed ${drill.seed}`,
    )
    // A split is the hardest shape and takes no decoy adjustment, so it is the
    // one difficulty that is a fixed number.
    if (drill.settledBy === 'split') t.is(drill.difficulty, HARDEST_SPOT, `seed ${drill.seed}`)
    // The sentence and the shape are one reading of the hand, not two.
    if (drill.settledBy === 'kicker') t.regex(drill.explanation, /outkicks/, `seed ${drill.seed}`)
    if (drill.settledBy === 'rank') t.regex(drill.explanation, /outranks/, `seed ${drill.seed}`)
    if (drill.settledBy === 'category') t.regex(drill.explanation, / beats /, `seed ${drill.seed}`)
  }
  // All four shapes turn up in a normal sample. If one stopped, the ordering
  // the rating rests on would be describing spots that no longer exist.
  t.deepEqual([...seen].sort(), ['category', 'kicker', 'rank', 'split'])
})

// The point of rating the spots at all: a mixed sample has to spread, or the
// rating is a coin flip with extra steps.
test('the spots are not all worth the same', (t) => {
  const difficulties = accepted(1, 2_000).map((drill) => drill.difficulty)
  t.true(new Set(difficulties).size >= 4, 'the difficulties barely differ')
  const spread = Math.max(...difficulties) - Math.min(...difficulties)
  t.true(spread >= 400, `only ${spread} points between the easiest and hardest spot`)
})
