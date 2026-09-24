import test from 'ava'
import { BET_PACK_ID, DRILL_KINDS, canPlayDrill, drillKind } from '@/config/drills'
import { drillAt, gradeDrill, nextDrill } from '@/lib/drills'
import { VALUE_MARGIN, generateBetOrCheck } from '@/lib/drills/betOrCheck'
import { PACK_SIZE, dealPlanned, planPack } from '@/lib/drills/pack'
import { EASIEST_VALUE, HARDEST_RIVER, HARDEST_VALUE, aimFor } from '@/lib/drills/rating'
import { riverRange } from '@/lib/drills/riverRange'
import { kindFloor, spotLadder } from '@/lib/drills/standing'
import type { Drill } from '@/lib/drills/types'
import { countAgainst, valueBand } from '@/lib/drills/valueRange'
import { mulberry32 } from '@/lib/poker/cards'

// The river pack's mirror. The count is held in tests/valueRange.test.ts; this
// file holds the generator's contract:
//
// 1. every spot is the same answer at every calling range the measured band
//    allows, and clear of the margin at each — a bet by its share against the
//    callers, a check by the whole gain, folds included;
// 2. the sentence carries the number the grade came from;
// 3. neither button wins on its own: a pack is five and five;
// 4. it is the membership's, under a stable id, in the commit that registers it.

const KIND = 'bet-or-check'

const corpus: Drill[] = []
const reasons: Record<string, number> = {}
for (let seed = 1; corpus.length < 120 && seed < 20_000; seed++) {
  const { drill, rejected } = generateBetOrCheck(seed)
  if (drill) corpus.push(drill)
  else if (rejected) reasons[rejected] = (reasons[rejected] ?? 0) + 1
}

const lineOf = (drill: Drill) => ({
  flop: drill.line?.[0].action ?? 'check',
  turn: drill.line?.[1].action ?? 'check',
})

test('the corpus is big enough to say anything', (t) => {
  t.is(corpus.length, 120)
  t.true(Object.keys(reasons).length > 0)
})

test('every spot is the same answer however wide they call, and clear of the margin', (t) => {
  const m = VALUE_MARGIN / 100
  for (const drill of corpus) {
    const hero = drill.hands?.[0].cards ?? []
    const calling = drill.calling
    if (!calling) {
      t.fail(`seed ${drill.seed}: no calling range`)
      continue
    }
    // Recomputed from the cards, not read off the spot.
    const counted = countAgainst(hero, drill.board, riverRange(hero, drill.board, lineOf(drill)))
    const band = valueBand(counted, calling.bet, calling.pot)
    for (const count of band.all) {
      if (drill.answer === 'bet') t.true(count.equity >= 0.5 + m, `seed ${drill.seed}`)
      else t.true(count.effective <= 0.5 - m && count.gain < 0, `seed ${drill.seed}`)
    }
    t.true(Math.abs(band.typical.equity - calling.equity) < 1e-12, 'the felt draws another range')
    t.true(gradeDrill(drill, drill.answer).correct)
    t.false(gradeDrill(drill, drill.answer === 'bet' ? 'check' : 'bet').correct)
  }
})

test('the sentence carries the number the grade came from', (t) => {
  for (const drill of corpus) {
    const said = drill.explanation.match(
      /wins ([\d.]+)% against the hands that call (\d+) into (\d+)/,
    )
    t.truthy(said, drill.explanation)
    t.is(drill.answer, Number(said?.[1]) > 50 ? 'bet' : 'check', drill.explanation)
    t.is(Number(said?.[2]), drill.calling?.bet ?? -1)
    t.is(Number(said?.[3]), drill.calling?.pot ?? -1)
    t.regex(drill.explanation, drill.answer === 'bet' ? /so it is a bet\.$/ : /so it is a check\.$/)
    t.notRegex(drill.explanation, /about/)
  }
})

test('the betting adds up: every bet was yours and called, and the river is checked to you', (t) => {
  for (const drill of corpus) {
    const line = drill.line ?? []
    t.deepEqual(
      line.map((s) => s.street),
      ['flop', 'turn', 'river'],
    )
    t.is(line[2].action, 'check')
    let pot = line[0].potBefore
    for (const step of line) {
      t.is(step.potBefore, pot)
      if (step.action === 'bet') pot += 2 * (step.amount ?? 0)
    }
    t.is(drill.calling?.pot, pot)
    t.true((drill.calling?.bet ?? 0) % 5 === 0 && (drill.calling?.bet ?? 0) >= pot / 2 - 5)
    t.is(drill.choices.find((c) => c.id === 'bet')?.label, `Bet ${drill.calling?.bet}`)
  }
})

test('neither button wins on its own: the stream and the pack', (t) => {
  const bets = corpus.filter((d) => d.answer === 'bet').length / corpus.length
  // Measured at 47% over 348 spots (2026-09-24).
  t.true(bets > 0.35 && bets < 0.65, `bet share ${bets.toFixed(2)}`)

  const rng = mulberry32(8)
  let seed = 1
  const nextSeed = () => seed++ * 7_919
  let uneven = 0
  for (const aim of [EASIEST_VALUE, HARDEST_VALUE]) {
    for (let p = 0; p < 8; p++) {
      const plan = planPack<'bet' | 'check'>('bet', 'check', rng)
      const dealt = plan.map((want) => dealPlanned(KIND, want, aim, nextSeed))
      const bet = dealt.filter((d) => d.answer === 'bet').length
      if (bet !== PACK_SIZE / 2) uneven++
      t.true(bet >= 4 && bet <= 6, `aim ${aim}: ${bet} bets in a pack`)
    }
  }
  t.true(uneven <= 2, `${uneven} of 16 packs came out uneven`)
})

test('the ladder sits a step under the river call, and the aim climbs it', (t) => {
  const ladder = spotLadder(KIND)
  t.is(ladder?.length, 3)
  t.is(kindFloor(KIND), EASIEST_VALUE)
  t.true(HARDEST_VALUE < HARDEST_RIVER)
  const shapes = new Set(ladder?.map((s) => s.settledBy))
  for (const drill of corpus) t.true(shapes.has(drill.settledBy), drill.settledBy)
  for (const shape of shapes)
    t.true(
      corpus.some((d) => d.settledBy === shape),
      `${shape}`,
    )
  t.is(nextDrill(KIND, 1, aimFor(EASIEST_VALUE, 1_000, 0)).kind, KIND)
})

test('a spot is the same spot every time it is dealt', (t) => {
  for (const seed of [corpus[0].seed, corpus[7].seed, 12_345]) {
    t.deepEqual(generateBetOrCheck(seed), generateBetOrCheck(seed))
    t.deepEqual(drillAt(KIND, seed), generateBetOrCheck(seed))
  }
})

// Rule #8: a paid kind has to say so in the commit that registers it.
test('the bet-or-check pack is registered as the membership’s, under its stable id', (t) => {
  const kind = drillKind(BET_PACK_ID)
  t.is(BET_PACK_ID, KIND, 'the course links here; the id may not move')
  t.true(kind.membersOnly, 'a paid kind shipped without its flag is free forever')
  t.false(canPlayDrill(kind, false))
  t.true(canPlayDrill(kind, true))
  t.is(kind.boardCards, 5)
  t.true(DRILL_KINDS.some((k) => k.id === KIND))
})
