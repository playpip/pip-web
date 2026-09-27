import test from 'ava'
import { DRILL_KINDS, SHOVE_PACK_ID, canPlayDrill, drillKind } from '@/config/drills'
import { holeKey } from '@/config/handNames'
import { drillAt, gradeDrill, nextDrill } from '@/lib/drills'
import { PACK_SIZE, dealPlanned, planPack } from '@/lib/drills/pack'
import { EASIEST_SHOVE, HARDEST_SHOVE, aimFor } from '@/lib/drills/rating'
import {
  SHOVE_MARGIN,
  generateShoveOrFold,
  playShove,
  shoveTable,
  shoveVerdict,
} from '@/lib/drills/shoveOrFold'
import { type ShoveSeat, behind, callerModels, classOf, shoveEv } from '@/lib/drills/shoveRange'
import { kindFloor, spotLadder } from '@/lib/drills/standing'
import type { Drill } from '@/lib/drills/types'
import { mulberry32 } from '@/lib/poker/cards'

// The short-stack pack. The model itself is held in tests/shoveRange.test.ts;
// this file holds the generator's contract:
//
// 1. every answer is the sign of the expected value, re-read from the cards,
//    and the same at Nash, a fifth tighter and a quarter looser, clear of the
//    margin at all three after the chart's band;
// 2. the sentence carries the numbers the grade came from;
// 3. neither button wins on its own: a pack is five and five;
// 4. the table on the felt is the spot — your stack, everybody covering it;
// 5. it is the membership's, under a stable id, in the commit that registers it.

const KIND = 'shove-or-fold'

const corpus: Drill[] = []
const reasons: Record<string, number> = {}
for (let seed = 1; corpus.length < 400; seed++) {
  const { drill, rejected } = generateShoveOrFold(seed)
  if (drill) corpus.push(drill)
  else if (rejected) reasons[rejected] = (reasons[rejected] ?? 0) + 1
}

const heroOf = (drill: Drill) => drill.hands?.[0].cards ?? []
const spotOf = (drill: Drill) => ({
  seat: drill.seat as ShoveSeat,
  stack: drill.shove?.stack ?? 0,
})

test('every answer is the expected value’s, at all three sets of callers', (t) => {
  for (const drill of corpus) {
    const spot = spotOf(drill)
    const h = classOf(heroOf(drill))
    const models = callerModels(spot)
    for (const callers of [models.tight, models.nash, models.loose]) {
      const value = shoveEv(h, spot, callers)
      t.is(value.ev > 0 ? 'shove' : 'fold', drill.answer, `seed ${drill.seed}`)
      t.true(
        Math.abs(value.ev) - value.band >= SHOVE_MARGIN,
        `seed ${drill.seed}: ${value.ev} ± ${value.band}`,
      )
    }
    t.is(shoveVerdict(h, spot).answer, drill.answer as 'shove' | 'fold')
    t.true(Math.abs((drill.shove?.ev ?? 0) - shoveEv(h, spot, models.nash).ev) < 1e-12)
    t.true(gradeDrill(drill, drill.answer).correct)
    t.false(gradeDrill(drill, drill.answer === 'shove' ? 'fold' : 'shove').correct)
  }
  t.true(Object.keys(reasons).length > 0, 'nothing was ever thrown away, so the filter is off')
})

test('the sentence names the stack, the seat and the hand, and carries the numbers', (t) => {
  for (const drill of corpus) {
    const summary = drill.shove
    if (!summary) {
      t.fail(`seed ${drill.seed}: no summary`)
      continue
    }
    const hand = holeKey(heroOf(drill)) ?? ''
    t.true(drill.explanation.startsWith(`With ${summary.stack} big blinds`), drill.explanation)
    t.true(drill.explanation.includes(`, ${hand} is a ${drill.answer}:`), drill.explanation)
    const worth = drill.explanation.match(/(worth|loses) ([\d.]+) big blinds?/)
    t.truthy(worth, drill.explanation)
    t.is(worth?.[1], drill.answer === 'shove' ? 'worth' : 'loses')
    t.true(Math.abs(Number(worth?.[2]) - Math.abs(summary.ev)) <= 0.05 + 1e-9, drill.explanation)
    t.true(drill.explanation.includes(`win ${Number((summary.equityCalled * 100).toFixed(1))}%`))
    t.notRegex(drill.explanation, /about/)
    // The callers on the summary are the seats behind, in order.
    t.deepEqual(
      summary.callers.map((c) => c.seat),
      behind(spotOf(drill).seat),
    )
  }
})

test('aces are never a fold, and the rags are never a shove from the first seat deep', (t) => {
  for (const drill of corpus) {
    const hand = holeKey(heroOf(drill)) ?? ''
    if (['AA', 'KK', 'QQ', 'AKs', 'AKo'].includes(hand)) t.is(drill.answer, 'shove', hand)
    if (hand === '72o' && drill.seat === 'utg' && (drill.shove?.stack ?? 0) >= 8) {
      t.is(drill.answer, 'fold')
    }
  }
})

test('every seat and every stack is dealt', (t) => {
  t.deepEqual([...new Set(corpus.map((d) => d.seat))].sort(), ['btn', 'co', 'mp', 'sb', 'utg'])
  const stacks = new Set(corpus.map((d) => d.shove?.stack))
  for (let s = 3; s <= 15; s++) t.true(stacks.has(s), `${s} big blinds never dealt`)
})

test('neither button wins on its own: the stream and the pack', (t) => {
  const shoves = corpus.filter((d) => d.answer === 'shove').length / corpus.length
  // Measured at 56% over 2,928 spots (2026-09-24). Always-fold scores the rest.
  t.true(shoves > 0.45 && shoves < 0.65, `shove share ${shoves.toFixed(2)}`)

  const rng = mulberry32(5)
  let seed = 1
  const nextSeed = () => seed++ * 7_919
  let uneven = 0
  for (const aim of [EASIEST_SHOVE, 1_260, HARDEST_SHOVE]) {
    for (let p = 0; p < 20; p++) {
      const plan = planPack<'shove' | 'fold'>('shove', 'fold', rng)
      const dealt = plan.map((want) => dealPlanned(KIND, want, aim, nextSeed))
      const shoved = dealt.filter((d) => d.answer === 'shove').length
      if (shoved !== PACK_SIZE / 2) uneven++
      // Always-shove and always-fold each score what the plan dealt the other.
      t.true(shoved >= 4 && shoved <= 6, `aim ${aim}: ${shoved} shoves in a pack`)
    }
  }
  t.true(uneven <= 2, `${uneven} of 60 packs came out uneven`)
})

test('the table on the felt is the spot: your stack, the blinds, everybody covering you', (t) => {
  for (const drill of corpus.slice(0, 60)) {
    const spot = spotOf(drill)
    const state = shoveTable(heroOf(drill), spot.seat, spot.stack, drill.seed)
    const you = state.players[0]
    t.is(state.players[state.toActIndex].id, spot.seat, 'it is your turn')
    t.is(you.id, spot.seat)
    t.deepEqual(you.hole, heroOf(drill))
    t.is(you.stack + you.committedThisHand, spot.stack * 100)
    for (const p of state.players.slice(1)) {
      t.true(p.stack + p.committedThisHand > spot.stack * 100, 'somebody is shorter than you')
    }
    // Everybody before you has folded, and nobody after you has acted.
    for (const p of state.players.slice(1)) {
      const after = behind(spot.seat).includes(p.id as never)
      t.is(p.status === 'folded', !after, `${p.id} at seed ${drill.seed}`)
    }
    const shoved = playShove(state, 'shove')
    t.is(shoved.players[0].stack, 0, 'all in is all of it')
    t.is(playShove(state, 'fold').players[0].status, 'folded')
  }
})

test('the ladder is dealt, and the aim climbs it', (t) => {
  const ladder = spotLadder(KIND)
  t.is(ladder?.length, 3)
  t.is(kindFloor(KIND), EASIEST_SHOVE)
  const shapes = new Set(ladder?.map((s) => s.settledBy))
  for (const drill of corpus) t.true(shapes.has(drill.settledBy), drill.settledBy)
  for (const shape of shapes)
    t.true(
      corpus.some((d) => d.settledBy === shape),
      `${shape} never dealt`,
    )
  const mean = (aim: number) =>
    Array.from({ length: 40 }, (_, i) => nextDrill(KIND, 500 + i * 131, aim).difficulty).reduce(
      (a, b) => a + b,
    ) / 40
  t.true(mean(aimFor(EASIEST_SHOVE, 1_000, 0)) < mean(HARDEST_SHOVE))
})

test('a spot is the same spot every time it is dealt', (t) => {
  for (const seed of [corpus[0].seed, corpus[9].seed, 4_242]) {
    t.deepEqual(generateShoveOrFold(seed), generateShoveOrFold(seed))
    t.deepEqual(drillAt(KIND, seed), generateShoveOrFold(seed))
  }
})

// Rule #8: a paid kind has to say so in the commit that registers it.
test('the shove-or-fold pack is registered as the membership’s, under its stable id', (t) => {
  const kind = drillKind(SHOVE_PACK_ID)
  t.is(SHOVE_PACK_ID, KIND, 'the course links here; the id may not move')
  t.true(kind.membersOnly, 'a paid kind shipped without its flag is free forever')
  t.false(canPlayDrill(kind, false))
  t.true(canPlayDrill(kind, true))
  t.is(kind.boardCards, 0, 'it is asked before the flop')
  t.true(DRILL_KINDS.some((k) => k.id === KIND))
})
