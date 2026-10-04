import test from 'ava'
import { DRILL_KINDS, OPEN_PACK_ID, canPlayDrill, drillKind } from '@/config/drills'
import { holeKey } from '@/config/handNames'
import { COMPARED_HANDS, COMPARED_SEATS, SEATS, opensHand, seatById } from '@/config/positions'
import { BAND_LISTS, HAND_BANDS, cumulativeShare } from '@/config/startingHands'
import { drillAt, gradeDrill, nextDrill } from '@/lib/drills'
import { OPENING_SEATS, generateOpenOrFold, openAnswer, openVerdict } from '@/lib/drills/openOrFold'
import { PACK_SIZE, dealPlanned, planPack } from '@/lib/drills/pack'
import { EASIEST_OPEN, HARDEST_OPEN, aimFor } from '@/lib/drills/rating'
import { kindDifficulty, kindFloor, spotLadder } from '@/lib/drills/standing'
import type { Drill } from '@/lib/drills/types'
import { mulberry32 } from '@/lib/poker/cards'

// The second practice pack. What this file holds:
//
// 1. the answer is the starting-hand chart's, so the pack cannot contradict the
//    free guides — checked against the guides' own examples, by name;
// 2. the sentence says the answer the grade gave;
// 3. neither button wins on its own: a pack is five and five, and a player who
//    always raises or always folds scores what a coin does;
// 4. it is the membership's, under a stable id, in the commit that registers it.

const KIND = 'open-or-fold'

const corpus: Drill[] = []
const reasons: Record<string, number> = {}
for (let seed = 1; corpus.length < 600; seed++) {
  const { drill, rejected } = generateOpenOrFold(seed)
  if (drill) corpus.push(drill)
  else if (rejected) reasons[rejected] = (reasons[rejected] ?? 0) + 1
}

const heroOf = (drill: Drill) => drill.hands?.[0].cards ?? []

test('every answer is the chart’s, read a second time from the cards', (t) => {
  for (const drill of corpus) {
    const hand = holeKey(heroOf(drill))
    t.truthy(hand && drill.seat, `seed ${drill.seed}`)
    const seat = seatById(drill.seat ?? 'utg')
    t.is(drill.answer, opensHand(seat, hand ?? '') ? 'raise' : 'fold', `seed ${drill.seed}`)
    t.true(gradeDrill(drill, drill.answer).correct)
    t.false(gradeDrill(drill, drill.answer === 'raise' ? 'fold' : 'raise').correct)
  }
})

// The guides say these in prose. If the chart moves, the guide's sentence and
// this pack move together or this fails, which is the point: the pack is not
// allowed to teach a hand differently from a free page.
test('the pack agrees with what the position and starting-hand guides say', (t) => {
  // /learn/position: "J9s is a fold under the gun and a routine open on the
  // button. So is A9o, so is 87s."
  for (const hand of ['J9s', 'A9o', '87s']) {
    t.is(openAnswer(seatById('utg'), hand), 'fold', `${hand} under the gun`)
    t.is(openAnswer(seatById('btn'), hand), 'raise', `${hand} on the button`)
  }
  // /learn/starting-hands: KJo, QJo and JTo sit "later than they feel".
  for (const hand of ['KJo', 'QJo', 'JTo']) {
    t.is(openAnswer(seatById('utg'), hand), 'fold', `${hand} under the gun`)
  }
  // The guide's widget, every panel of it: the same function, every hand.
  for (const hand of COMPARED_HANDS) {
    for (const seat of COMPARED_SEATS) {
      t.is(openAnswer(seat, hand) === 'raise', opensHand(seat, hand), `${hand} ${seat.id}`)
    }
  }
  // And the share each seat raises is the share the guides quote.
  const share = (id: 'utg' | 'mp' | 'co' | 'btn') => {
    const seat = seatById(id)
    const opened = Object.keys(HAND_BANDS).filter((hand) => opensHand(seat, hand))
    return opened
  }
  t.deepEqual(share('utg').sort(), [...BAND_LISTS.any].sort())
  t.is(
    share('btn').length,
    BAND_LISTS.any.length + BAND_LISTS.middle.length + BAND_LISTS.late.length,
  )
  t.true(
    cumulativeShare('late') > cumulativeShare('any') * 2.5,
    'the guide says it roughly triples',
  )
})

test('the blinds are never asked, and every seat that opens is', (t) => {
  const seen = new Set(corpus.map((drill) => drill.seat))
  t.deepEqual([...seen].sort(), [...OPENING_SEATS].sort())
  t.false(seen.has('sb') || seen.has('bb'))
  // The chart gives the blinds no opening band at all.
  for (const seat of SEATS.filter((s) => s.opens === null)) t.true(['sb', 'bb'].includes(seat.id))
})

test('the sentence names the hand and ends in the answer', (t) => {
  for (const drill of corpus) {
    const hand = holeKey(heroOf(drill)) ?? ''
    t.true(drill.explanation.startsWith(hand), drill.explanation)
    t.regex(
      drill.explanation,
      drill.answer === 'raise' ? /so .*it is a raise\.$/ : /so it is a fold\.$/,
      drill.explanation,
    )
    t.is(drill.explanation, openVerdict(drill.seat as (typeof OPENING_SEATS)[number], hand))
  }
  // A fold from a seat that is too early says how many are still to act.
  t.is(
    openVerdict('utg', 'KJo'),
    'KJo only opens from the middle seat onwards, and you are under the gun with five still to act behind you, so it is a fold.',
  )
  t.is(
    openVerdict('btn', 'J9s'),
    'J9s opens from the middle seat onwards, and you are on the button, so it is a raise.',
  )
  t.is(
    openVerdict('btn', 'Q8o'),
    'Q8o is not on the chart from any seat, the button included, so it is a fold.',
  )
})

test('the rags are thrown away, and a hand next to the chart is kept', (t) => {
  t.true((reasons['one-sided'] ?? 0) > 0, 'nothing was ever thrown away, so the filter is off')
  for (const drill of corpus) {
    const hand = holeKey(heroOf(drill)) ?? ''
    t.not(hand, '72o', 'the worst hand in the game is not a question')
  }
  t.true(
    corpus.some((d) => d.hands?.[0].detail === 'K8o' || d.hands?.[0].detail === '65o'),
    'the near misses the chart is learned from are never asked',
  )
})

// The river pack's first playthrough scored nine in ten by pressing Call every
// time. These are the numbers that stop that happening here, measured.
test('neither button wins on its own: the stream and the pack', (t) => {
  const raises = corpus.filter((d) => d.answer === 'raise').length / corpus.length
  // Measured at 42% over 12,632 spots (2026-09-23). Always-fold scores the rest.
  t.true(raises > 0.35 && raises < 0.5, `raise share ${raises.toFixed(2)}`)

  // A pack: five raises and five folds, dealt for real at the aims a player
  // actually has. Always-raise and always-fold each score what the plan says.
  const rng = mulberry32(99)
  let seed = 1
  const nextSeed = () => seed++ * 7_919
  let uneven = 0
  for (const aim of [EASIEST_OPEN, 860, HARDEST_OPEN]) {
    for (let p = 0; p < 20; p++) {
      const plan = planPack<'raise' | 'fold'>('raise', 'fold', rng)
      t.is(plan.length, PACK_SIZE)
      t.is(plan.filter((a) => a === 'raise').length, PACK_SIZE / 2)
      const dealt = plan.map((want) => dealPlanned(KIND, want, aim, nextSeed))
      const raised = dealt.filter((d) => d.answer === 'raise').length
      if (raised !== PACK_SIZE / 2) uneven++
      t.true(raised >= 4 && raised <= 6, `aim ${aim}: ${raised} raises in a pack`)
    }
  }
  t.true(uneven <= 2, `${uneven} of 60 packs came out uneven`)
})

test('the ladder sits beside the reading kinds, and the aim climbs it', (t) => {
  const ladder = spotLadder(KIND)
  t.is(ladder?.length, 3)
  t.is(kindFloor(KIND), EASIEST_OPEN)
  const shapes = new Set(ladder?.map((s) => s.settledBy))
  for (const drill of corpus) t.true(shapes.has(drill.settledBy), drill.settledBy)
  for (const shape of shapes)
    t.true(
      corpus.some((d) => d.settledBy === shape),
      `${shape} never dealt`,
    )
  t.is(kindDifficulty(KIND), 2)
  const mean = (aim: number) =>
    Array.from({ length: 40 }, (_, i) => nextDrill(KIND, 500 + i * 131, aim).difficulty).reduce(
      (a, b) => a + b,
    ) / 40
  t.true(mean(aimFor(EASIEST_OPEN, 1_000, 0)) < mean(HARDEST_OPEN))
})

test('a spot is the same spot every time it is dealt', (t) => {
  for (const seed of [corpus[0].seed, corpus[9].seed, 4_242]) {
    t.deepEqual(generateOpenOrFold(seed), generateOpenOrFold(seed))
    t.deepEqual(drillAt(KIND, seed), generateOpenOrFold(seed))
  }
})

// Rule #8: a paid kind has to say so in the commit that registers it.
test('the open-or-fold pack is registered as the membership’s, under its stable id', (t) => {
  const kind = drillKind(OPEN_PACK_ID)
  t.is(OPEN_PACK_ID, KIND, 'the report and the Position lesson link here; the id may not move')
  t.true(kind.membersOnly, 'a paid kind shipped without its flag is free forever')
  t.false(canPlayDrill(kind, false))
  t.true(canPlayDrill(kind, true))
  t.is(kind.boardCards, 0, 'it is asked before the flop')
  t.is(DRILL_KINDS.at(-1)?.id, 'calling-the-river', 'the hardest kind still ends the ladder')
})
