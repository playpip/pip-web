import test from 'ava'
import { DRILL_KINDS, RIVER_PACK_ID, canPlayDrill, drillKind } from '@/config/drills'
import { drillAt, gradeDrill, nextDrill } from '@/lib/drills'
import { RIVER_MARGIN, generateRiverCall } from '@/lib/drills/callingTheRiver'
import { EASIEST_RIVER, HARDEST_RIVER, HARDEST_PRICE } from '@/lib/drills/rating'
import { BLUFF_WEIGHTS, count, riverRange, weigh } from '@/lib/drills/riverRange'
import { kindFloor, spotLadder } from '@/lib/drills/standing'
import type { Drill } from '@/lib/drills/types'

// The first practice pack. Graded by counting (see tests/riverRange.test.ts
// for the count itself); what this file holds is the generator's contract:
//
// 1. every spot is decided the same way at the Garage's bluffing and at the
//    Main Event's, and clear of the margin at both,
// 2. the sentence carries the numbers the grade came from,
// 3. calls and folds come out close to even, so folding everything scores what
//    a coin does,
// 4. it is the membership's, and it says so in the commit that registers it.

const KIND = 'calling-the-river'

// One shared corpus: a seed that reaches the range costs a few milliseconds and
// most seeds are thrown away, so walking this once is the whole suite's cost.
const corpus: Drill[] = []
const reasons: Record<string, number> = {}
for (let seed = 1; corpus.length < 60 && seed < 5_000; seed++) {
  const { drill, rejected } = generateRiverCall(seed)
  if (drill) corpus.push(drill)
  else if (rejected) reasons[rejected] = (reasons[rejected] ?? 0) + 1
}

/** The line as the generator played it, back out of the spot. */
const lineOf = (drill: Drill) => ({
  flop: drill.line?.[0].action ?? 'check',
  turn: drill.line?.[1].action ?? 'check',
})

test('the corpus is big enough to say anything', (t) => {
  t.is(corpus.length, 60)
  t.true(Object.keys(reasons).length > 0, 'nothing was ever thrown away, so the filter is off')
})

test('every spot is the same answer whoever is betting, and clear of the margin', (t) => {
  // Recomputed from the cards rather than read off the spot, so this is a
  // second reading of the hand and not the generator agreeing with itself.
  for (const drill of corpus) {
    const hero = drill.hands?.[0].cards ?? []
    const stakes = drill.stakes
    const river = drill.line?.[2]
    if (!stakes || !river?.amount) {
      t.fail(`seed ${drill.seed}: no price`)
      continue
    }
    const potBefore = river.potBefore
    const required = stakes.toCall / (stakes.pot + stakes.toCall)
    const counted = count(
      hero,
      drill.board,
      riverRange(hero, drill.board, lineOf(drill)),
      stakes.toCall / potBefore,
    )
    for (const weight of [BLUFF_WEIGHTS.low, BLUFF_WEIGHTS.typical, BLUFF_WEIGHTS.high]) {
      const gap = (weigh(counted, weight).equity - required) * 100
      t.is(gap > 0 ? 'call' : 'fold', drill.answer, `seed ${drill.seed} at ${weight}`)
    }
    for (const weight of [BLUFF_WEIGHTS.low, BLUFF_WEIGHTS.high]) {
      const gap = Math.abs(weigh(counted, weight).equity - required) * 100
      t.true(gap >= RIVER_MARGIN, `seed ${drill.seed}: ${gap.toFixed(2)} at ${weight}`)
    }
    t.true(
      Math.abs((drill.range?.equity ?? 0) - weigh(counted, BLUFF_WEIGHTS.typical).equity) < 1e-12,
      'the felt draws a different range from the one that was graded',
    )
  }
})

test('the sentence carries the two numbers the grade came from', (t) => {
  for (const drill of corpus) {
    const said = drill.explanation.match(/wins ([\d.]+)% .* needs ([\d.]+)%/)
    t.truthy(said, drill.explanation)
    const [equity, required] = [Number(said?.[1]), Number(said?.[2])]
    t.is(drill.answer, equity > required ? 'call' : 'fold', drill.explanation)
    t.regex(
      drill.explanation,
      drill.answer === 'call' ? /so it is a call\.$/ : /so it is a fold\.$/,
    )
    t.notRegex(drill.explanation, /about/, 'a count said as an estimate')
  }
})

test('the betting adds up: every bet was called, and the price is the chips shown', (t) => {
  for (const drill of corpus) {
    const line = drill.line ?? []
    t.deepEqual(
      line.map((step) => step.street),
      ['flop', 'turn', 'river'],
    )
    t.is(line[2].action, 'bet', 'the river is always the bet being faced')
    let pot = line[0].potBefore
    for (const step of line) {
      t.is(step.potBefore, pot, `seed ${drill.seed}: the pot jumped`)
      if (step.action === 'bet') {
        t.true((step.amount ?? 0) > 0 && (step.amount ?? 0) % 5 === 0)
        if (step.street !== 'river') pot += 2 * (step.amount ?? 0)
      }
    }
    t.deepEqual(drill.stakes, { pot: pot + (line[2].amount ?? 0), toCall: line[2].amount })
  }
})

test('calls and folds come out close to even', (t) => {
  const calls = corpus.filter((d) => d.answer === 'call').length
  t.true(calls >= 18 && calls <= 42, `${calls} calls in ${corpus.length}`)
  for (const drill of corpus) {
    t.true(gradeDrill(drill, drill.answer).correct)
    t.false(gradeDrill(drill, drill.answer === 'call' ? 'fold' : 'call').correct)
  }
})

test('a spot is the same spot every time it is dealt', (t) => {
  for (const seed of [corpus[0].seed, corpus[7].seed, 12_345]) {
    t.deepEqual(generateRiverCall(seed), generateRiverCall(seed))
    t.deepEqual(drillAt(KIND, seed), generateRiverCall(seed))
  }
})

test('the ladder sits at and above the pot odds kind, and every shape it deals is on it', (t) => {
  const ladder = spotLadder(KIND)
  t.truthy(ladder)
  t.is(kindFloor(KIND), EASIEST_RIVER)
  t.true(HARDEST_RIVER > HARDEST_PRICE, 'reading a range is priced below counting two hands')
  const shapes = new Set(ladder?.map((s) => s.settledBy))
  for (const drill of corpus) t.true(shapes.has(drill.settledBy), drill.settledBy)
  // And the aimed walk reaches a spot, which is what the screen calls.
  t.is(nextDrill(KIND, 1, EASIEST_RIVER).kind, KIND)
})

// Rule #8: a paid kind has to say so in the commit that registers it.
test('the river pack is registered as the membership’s, under its stable id', (t) => {
  const kind = drillKind(RIVER_PACK_ID)
  t.is(RIVER_PACK_ID, KIND, 'the coaching report links here; the id may not move')
  t.true(kind.membersOnly, 'a paid kind shipped without its flag is free forever')
  t.false(canPlayDrill(kind, false))
  t.true(canPlayDrill(kind, true))
  t.is(kind.boardCards, 5)
  t.is(DRILL_KINDS.at(-1)?.id, KIND, 'the hardest kind sits at the end of the ladder')
})
