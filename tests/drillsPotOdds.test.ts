import test from 'ava'
import { DRILL_KINDS, canPlayDrill, drillKind } from '@/config/drills'
import { requiredEquity } from '@/config/potOdds'
import {
  EASIEST_PRICE,
  HARDEST_PRICE,
  MAX_ATTEMPTS,
  type PriceShape,
  drillAt,
  gradeDrill,
  nextDrill,
  priceDifficulty,
} from '@/lib/drills'
import { spotLadder, standingLine } from '@/lib/drills/standing'
import type { Drill, RejectReason } from '@/lib/drills/types'
import { createDeck, cardToString } from '@/lib/poker/cards'
import { determineWinners } from '@/lib/poker/handEval'

// "Pot odds" is the second kind that comes with the membership, and the first
// one whose question is about money. So the tests are the same two halves as
// the counting kind's — the answer is right, and the gate is real — plus a
// third that is new here: the two numbers the grade compares have to be the
// numbers the player was shown. A drill that grades a call against a price it
// did not print is worse than one that grades it wrong, because nothing on the
// screen would say so.
//
// Everything is exact. The equity is 44 showdowns and the price is a fraction,
// so there is no sampling anywhere in this kind and a flaky test here is a
// wrong test.

const KIND = 'pot-odds'

/** Every accepted spot in a range of seeds. */
function accepted(from: number, count: number): Drill[] {
  const drills: Drill[] = []
  for (let seed = from; seed < from + count; seed++) {
    const { drill } = drillAt(KIND, seed)
    if (drill) drills.push(drill)
  }
  return drills
}

const hand = (drill: Drill, label: string) =>
  drill.hands?.find((h) => h.label === label)?.cards ?? []

const hero = (drill: Drill) => hand(drill, 'You')
const villain = (drill: Drill) => hand(drill, 'They have')

/**
 * What the hand is worth, worked out again from the cards the spot dealt.
 *
 * Deliberately not the generator's own enumeration: it rebuilds the deck, takes
 * out the eight cards on the screen, deals each of the rest and reads the
 * showdown. If this ever disagrees with the drill, somebody paying for this is
 * being marked wrong for being right.
 */
function equityOf(drill: Drill): { wins: number; chops: number; equity: number } {
  const seen = new Set([...drill.board, ...hero(drill), ...villain(drill)].map(cardToString))
  const rest = createDeck().filter((card) => !seen.has(cardToString(card)))
  const contenders = [
    { id: 'hero', hole: hero(drill) },
    { id: 'villain', hole: villain(drill) },
  ]
  let wins = 0
  let chops = 0
  for (const card of rest) {
    const { winners } = determineWinners(contenders, [...drill.board, card])
    if (winners.length > 1) chops++
    else if (winners[0] === 'hero') wins++
  }
  return { wins, chops, equity: wins / rest.length }
}

/** The price the pot laid, read off the two numbers the player was shown. */
const priceOf = (drill: Drill): number => {
  const { pot, toCall } = drill.stakes ?? { pot: 0, toCall: 0 }
  return toCall / (pot + toCall)
}

test('the same seed is the same spot, forever', (t) => {
  for (const seed of [1, 13, 1_000, 4_294_967_295]) {
    t.deepEqual(drillAt(KIND, seed), drillAt(KIND, seed), `seed ${seed}`)
  }
})

// The pinned spots: both answers, all three shapes, and the two halves of the
// sentence. If the arithmetic or the wording moves, it says so here rather than
// on a paying player's screen.
const PINNED: {
  seed: number
  answer: string
  settledBy: PriceShape
  stakes: { pot: number; toCall: number }
  explanation: string
}[] = [
  {
    seed: 7,
    answer: 'fold',
    settledBy: 'close-price',
    stakes: { pot: 200, toCall: 80 },
    explanation:
      '9 of the 44 cards left win it for you, which is 20.5%, and calling 80 to win 200 needs 28.6%. Not enough, so it is a fold.',
  },
  {
    seed: 13,
    answer: 'call',
    settledBy: 'clear-price',
    stakes: { pot: 700, toCall: 100 },
    explanation:
      '11 of the 44 cards left win it for you, which is 25%, and calling 100 to win 700 needs 12.5%. Enough, so it is a call.',
  },
  {
    seed: 28,
    answer: 'call',
    settledBy: 'thin-price',
    stakes: { pot: 504, toCall: 144 },
    explanation:
      '12 of the 44 cards left win it for you, which is 27.3%, and calling 144 to win 504 needs 22.2%. Enough, so it is a call.',
  },
  {
    seed: 375,
    answer: 'fold',
    settledBy: 'thin-price',
    stakes: { pot: 3_600, toCall: 2_400 },
    explanation:
      '15 of the 44 cards left win it for you, which is 34.1%, and calling 2,400 to win 3,600 needs 40%. Not enough, so it is a fold.',
  },
]

test('fixed seeds price and grade the same way every run', (t) => {
  for (const pin of PINNED) {
    const { drill } = drillAt(KIND, pin.seed)
    if (!drill) {
      t.fail(`seed ${pin.seed} no longer generates a spot`)
      continue
    }
    t.is(drill.answer, pin.answer, `seed ${pin.seed}: answer`)
    t.is(drill.settledBy, pin.settledBy, `seed ${pin.seed}: shape`)
    t.deepEqual(drill.stakes, pin.stakes, `seed ${pin.seed}: stakes`)
    t.is(drill.explanation, pin.explanation, `seed ${pin.seed}: explanation`)
    t.true(gradeDrill(drill, pin.answer).correct, `seed ${pin.seed}: grade`)
  }
})

// The one that matters most, and the reason this kind is enumerated rather than
// simulated: the answer is re-derived from the cards on the screen and the
// numbers under them, by code that shares nothing with the generator.
test('every answer agrees with the cards and the price it was shown at', (t) => {
  const drills = accepted(1, 2_000)
  t.true(drills.length > 150, `sample too small to mean anything: ${drills.length}`)
  for (const drill of drills) {
    const { wins, chops, equity } = equityOf(drill)
    t.is(chops, 0, `seed ${drill.seed}: a spot that can chop was asked anyway`)
    t.is(drill.answer, equity > priceOf(drill) ? 'call' : 'fold', `seed ${drill.seed}`)
    // The count in the sentence is the count that settled it, not a second one.
    t.is(Number(drill.explanation.split(' ')[0]), wins, `seed ${drill.seed}: ${drill.explanation}`)
  }
})

// The price is arithmetic on two whole numbers of chips, and it is the same
// arithmetic /learn/pot-odds prints its table from. If those two ever come
// apart, a member is being taught one thing and graded by another.
test('the price the spot charges is the price the guide teaches', (t) => {
  for (const drill of accepted(1, 1_500)) {
    const stakes = drill.stakes
    if (!stakes) {
      t.fail(`seed ${drill.seed}: a pricing spot with no price on it`)
      continue
    }
    t.is(stakes.toCall, Math.round(stakes.toCall), `seed ${drill.seed}: a fraction of a chip`)
    t.true(stakes.toCall > 0 && stakes.pot > stakes.toCall, `seed ${drill.seed}: ${stakes.pot}`)
    // The bet as a fraction of the pot before it, put back through the guide's
    // own function. Exact, because every pot is a multiple of 60.
    const potBefore = stakes.pot - stakes.toCall
    t.true(
      Math.abs(priceOf(drill) - requiredEquity(stakes.toCall / potBefore)) < 1e-9,
      `seed ${drill.seed}: the drill and the guide price ${stakes.toCall} into ${potBefore} differently`,
    )
  }
})

// Half the spots are calls and half are folds, by construction rather than by
// luck (see the note on generatePotOdds). This is the test that stops the
// rating quietly becoming a reading of who noticed that folding everything
// works, which is what a natural sample of turn spots would reward.
test('answering the same thing every time scores what a coin scores', (t) => {
  const drills = accepted(1, 6_000)
  const calls = drills.filter((drill) => drill.answer === 'call').length
  const share = calls / drills.length
  t.true(share > 0.45 && share < 0.55, `${(share * 100).toFixed(1)}% of spots are calls`)
})

// Every accepted spot is far enough from the price to be fair and near enough
// to be a question. Both halves are load-bearing: under the margin the player
// is right either way, over the gap they never had to count.
test('no spot is too close to ask, and none is too far to be worth asking', (t) => {
  for (const drill of accepted(1, 2_000)) {
    const gap = Math.abs(equityOf(drill).equity - priceOf(drill)) * 100
    t.true(gap >= 4, `seed ${drill.seed}: ${gap.toFixed(1)} points apart, which is a coin flip`)
    t.true(gap <= 20, `seed ${drill.seed}: ${gap.toFixed(1)} points apart, which needs no counting`)
    // The shape carried on the spot is that same gap, banded. One reading.
    const expected: PriceShape = gap < 7 ? 'thin-price' : gap < 11 ? 'close-price' : 'clear-price'
    t.is(drill.settledBy, expected, `seed ${drill.seed}: ${gap.toFixed(1)} points`)
  }
})

test('the filter throws away the spots that are not questions', (t) => {
  // Exhaustive, so a new reason anywhere in the vocabulary stops this file
  // compiling and somebody has to decide whether this kind can emit it.
  const counts: Record<RejectReason, number> = {
    'one-sided': 0,
    unexplainable: 0,
    'already-ahead': 0,
    'chop-possible': 0,
    'drawing-dead': 0,
    ambiguous: 0,
  }
  let kept = 0
  for (let seed = 1; seed <= 4_000; seed++) {
    const { drill, rejected } = drillAt(KIND, seed)
    if (drill) kept++
    else if (rejected) counts[rejected]++
  }

  t.true(kept > 250, `the filter is throwing away too much: ${kept} kept of 4,000`)
  t.true(counts['already-ahead'] > 100, 'the hero is never already ahead, which cannot be right')
  t.true(counts['chop-possible'] > 10, 'no spot has ever been rejected for chopping')
  t.true(counts['drawing-dead'] > 10, 'no spot has ever been rejected for being drawing dead')
  t.true(counts.ambiguous > 10, 'no spot has ever been too close to the price to be fair')
  t.true(counts['one-sided'] > 10, 'no spot has ever been rejected for being unaskable')
  // Not a tuning knob here either: this kind's sentence is a count and two
  // percentages, so there is no hand it can fail to explain.
  t.is(counts.unexplainable, 0, "unexplainable is not this kind's vocabulary")
})

test('the grader accepts the answer and nothing else', (t) => {
  for (const drill of accepted(30_000, 1_000)) {
    t.deepEqual(
      drill.choices.map((choice) => choice.id),
      ['call', 'fold'],
      `seed ${drill.seed}: the two answers, in the order they are drawn`,
    )
    for (const choice of drill.choices) {
      const grade = gradeDrill(drill, choice.id)
      t.is(grade.correct, choice.id === drill.answer, `seed ${drill.seed}: ${choice.id}`)
      t.is(choice.winning, choice.id === drill.answer, `seed ${drill.seed}: ${choice.id} marked`)
      t.is(choice.cards.length, 0, `seed ${drill.seed}: an answer that is not a hand has cards`)
      t.is(grade.explanation, drill.explanation)
      t.is(grade.difficulty, drill.difficulty)
    }
  }
})

test('every spot deals eight distinct cards, both hands face up on the turn', (t) => {
  for (const drill of accepted(1, 1_500)) {
    t.is(drill.board.length, 4, `seed ${drill.seed}: board`)
    t.is(hero(drill).length, 2, `seed ${drill.seed}: your hand`)
    t.is(villain(drill).length, 2, `seed ${drill.seed}: their hand`)
    const all = [...drill.board, ...hero(drill), ...villain(drill)].map(cardToString)
    t.is(new Set(all).size, 8, `seed ${drill.seed}: a card is dealt twice`)
    // What each hand is right now is named from the start: you cannot price a
    // call against a hand you have not been told about.
    for (const shown of drill.hands ?? []) {
      t.true((shown.detail ?? '').length > 0, `seed ${drill.seed}: ${shown.label} unnamed`)
    }
  }
})

test('every spot carries a difficulty, and it is the one its shape is worth', (t) => {
  const seen = new Set<string>()
  for (const drill of accepted(1, 3_000)) {
    seen.add(drill.settledBy)
    t.is(drill.difficulty, priceDifficulty(drill.settledBy as PriceShape), `seed ${drill.seed}`)
    t.true(
      drill.difficulty >= EASIEST_PRICE && drill.difficulty <= HARDEST_PRICE,
      `seed ${drill.seed}: ${drill.difficulty}`,
    )
  }
  // All three shapes turn up in a normal sample. If one stopped, the ladder the
  // rating is read against would be describing spots that no longer exist.
  t.deepEqual([...seen].sort(), ['clear-price', 'close-price', 'thin-price'])
})

test('the stream always finds a spot, and quickly enough to deal on mount', (t) => {
  let worst = 0
  for (let seed = 1; seed <= 1_000; seed++) {
    let attempts = 1
    while (!drillAt(KIND, seed + attempts - 1).drill) attempts++
    worst = Math.max(worst, attempts)
    t.is(nextDrill(KIND, seed).seed, seed + attempts - 1)
  }
  // This kind rejects far more than the other two — most turn spots are not a
  // question about a price — so the number is worth stating rather than
  // assuming. Each attempt is 44 showdowns, and the screen deals one of these
  // on mount and after every answer.
  t.true(worst < 100, `worst run of rejections was ${worst}`)
  t.true(MAX_ATTEMPTS > worst * 4)
})

test('the ladder reads up, and says something honest at both ends', (t) => {
  const ladder = spotLadder(KIND)
  if (!ladder) {
    t.fail('a kind with three shapes has no ladder')
    return
  }
  t.is(ladder.length, 3)
  for (let i = 1; i < ladder.length; i++) {
    t.true(ladder[i].rating > ladder[i - 1].rating, `${ladder[i].settledBy} is not harder`)
    t.true(ladder[i].label.length > 0)
  }
  // Below the whole ladder there is nothing to claim, and above it there is
  // nothing left to be behind on. Neither sentence is a target.
  t.is(standingLine(KIND, 800), `Next up: ${ladder[0].label}.`)
  t.regex(standingLine(KIND, 2_000) ?? '', /every shape these spots come in/)
  t.regex(standingLine(KIND, 1_200) ?? '', /^Better than even on clear prices\. Next up:/)
})

// ---------------------------------------------------------------------------
// The gate. The half that is about money rather than poker.
// ---------------------------------------------------------------------------

// technology#55, and rule #8 under it: we never charge later for something that
// shipped free. The flag has to be on a paid kind in the commit that registers
// it, because no later commit can take back a kind that has been given away. By
// name rather than by iterating the registry, for the same reason as the
// counting kind's version of this test.
test("pot odds is registered as the membership's, not as free", (t) => {
  const kind = drillKind(KIND)
  t.true(kind.membersOnly, 'the second paid kind shipped without membersOnly')
  t.false(canPlayDrill(kind, false), 'a non-member can open a kind that comes with the membership')
  t.true(canPlayDrill(kind, true), 'a member cannot open the kind they paid for')
})

test('the membership has more than one kind in it, and the free one is still free', (t) => {
  const paid = DRILL_KINDS.filter((kind) => kind.membersOnly).map((kind) => kind.id)
  t.deepEqual(paid.sort(), ['count-your-outs', 'pot-odds'])
  t.true(canPlayDrill(drillKind('which-hand-wins'), false), 'the free kind is no longer free')
})

// Only the kind that asks about money carries any. A stray price on another
// kind would draw a line of numbers over a spot that is not about them.
test('the pot and the price are on the pricing kind and nowhere else', (t) => {
  for (const kind of DRILL_KINDS) {
    const drill = nextDrill(kind.id, 1)
    if (kind.id === KIND) t.truthy(drill.stakes, `${kind.id}: no price on a pricing spot`)
    else t.is(drill.stakes, undefined, `${kind.id}: carries a price it never asks about`)
  }
})
