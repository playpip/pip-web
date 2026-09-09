import test from 'ava'

import { DRILL_KINDS } from '@/config/drills'
import { requiredEquity } from '@/config/potOdds'
import {
  BAND,
  FAIR_QUESTION,
  ITERATIONS,
  MARGIN,
  type PlayedHand,
  afterStreet,
  generatePlayedHand,
  nextPlayedHand,
} from '@/lib/drills'
import { gradeDrill } from '@/lib/drills/index'
import { mulberry32 } from '@/lib/poker/cards'
import { estimateEquity } from '@/lib/poker/equity'

// The "play it out" mode of pot odds (RULED technology#86). Everything here is
// about one thing: it is the first paid grade that comes off a **sampled**
// number, and the three kinds that shipped before it all count instead.
//
// So the tests are not "does the generator run". They are:
//
// 1. the margin is wide enough that the band cannot reach across it,
// 2. a verdict does not move when the simulation is re-run under a fresh rng,
// 3. the mode registers nothing, so no kind became free by accident.
//
// The corpus is generated once and shared: a seed costs three `estimateEquity`
// calls at ITERATIONS, so generating one per test would put minutes on the gate
// for no extra coverage.

const SEEDS = 14

const corpus: PlayedHand[] = []
const rejected: string[] = []
for (let seed = 1; seed <= SEEDS; seed++) {
  const { hand, rejected: why } = generatePlayedHand(seed)
  if (hand) corpus.push(hand)
  else if (why) rejected.push(why)
}
const graded = corpus.flatMap((hand) =>
  hand.streets.filter((s) => s.drill !== null).map((s) => ({ hand, street: s })),
)

test('the corpus is big enough to say anything', (t) => {
  // Asserted before any rate below, because a rate over an empty loop passes.
  t.is(corpus.length + rejected.length, SEEDS)
  t.true(corpus.length >= 6, `only ${corpus.length} hands from ${SEEDS} seeds`)
  t.true(graded.length >= 8, `only ${graded.length} graded streets`)
})

test('the margin beats the band, so the estimate cannot reach across it', (t) => {
  // The ruling's requirement, and the reason ITERATIONS is not a performance
  // knob. `0.5 / sqrt(n)` is a bound on the standard error, not a fit: one
  // iteration returns a share of one pot in [0, 1] whatever the ranges do, so
  // this cannot be wrong in our favour.
  t.true(BAND < MARGIN, `band ${BAND} is not inside margin ${MARGIN}`)
  t.true(
    MARGIN - BAND >= FAIR_QUESTION,
    `a spot accepted at ${MARGIN} points could be as thin as ${(MARGIN - BAND).toFixed(2)}, ` +
      `which is under the ${FAIR_QUESTION} that makes a question fair. Raise ITERATIONS or MARGIN.`,
  )
  // And the margin is wider than the face-up kinds', which is the whole reason
  // this mode exists as a separate set of constants.
  t.true(MARGIN > FAIR_QUESTION)
})

test('a verdict does not move when the simulation is re-run', (t) => {
  // The measurement the margin is for. Re-estimate each graded street under rng
  // seeds the generator never saw and check the call/fold verdict against the
  // one baked at generation time.
  const REDRAWS = 4
  let checked = 0
  let flipped = 0
  for (const { hand, street } of graded) {
    const drill = street.drill
    if (!drill?.stakes) continue
    const { pot, toCall } = drill.stakes
    const required = toCall / (pot + toCall)
    for (let r = 0; r < REDRAWS; r++) {
      const { equity } = estimateEquity({
        hole: hand.hole,
        community: street.board,
        opponents: 1,
        opponentSelectivity: [0.5],
        iterations: ITERATIONS,
        rng: mulberry32(0x51ed_5eed + r * 7919),
      })
      checked++
      if ((equity > required ? 'call' : 'fold') !== drill.answer) flipped++
    }
  }
  t.true(checked >= 32, `only ${checked} re-readings`)
  t.is(flipped, 0, `${flipped} of ${checked} verdicts moved under a fresh rng`)
})

test('the price on the screen is the price it is graded against', (t) => {
  // The one place this mode departs from the face-up kind: the pot grows by two
  // called bets a street, so it stops being a multiple of 60 and `required` is
  // taken from the rounded chips rather than the nominal fraction. That is only
  // safe if the two definitions still agree, so this holds them together.
  t.true(graded.length > 0)
  for (const { street } of graded) {
    const stakes = street.drill?.stakes
    if (!stakes) continue
    const { pot, toCall } = stakes
    const potBefore = pot - toCall
    const required = toCall / (potBefore + 2 * toCall)
    t.true(Number.isInteger(toCall), 'a bet is a whole number of chips')
    t.true(toCall > 0 && potBefore > 0)
    // requiredEquity's own arithmetic, applied to the fraction actually bet.
    t.true(Math.abs(required - requiredEquity(toCall / potBefore)) < 1e-12)
  }
})

test('every graded street sits inside the margin it was accepted for', (t) => {
  t.true(graded.length > 0)
  for (const { street } of graded) {
    const drill = street.drill
    if (!drill?.stakes) continue
    // The sentence carries the estimate the grade was made from, so reading the
    // gap back off the spot means reading the same number the grader used.
    const said = drill.explanation.match(/win about ([\d.]+)%.*needs ([\d.]+)%/)
    t.truthy(said, `no two numbers in: ${drill.explanation}`)
    const [equity, required] = [Number(said?.[1]), Number(said?.[2])]
    const gap = Math.abs(equity - required)
    t.true(gap >= MARGIN - 0.05, `gap ${gap.toFixed(2)} is under the margin`)
    t.true(gap <= 20 + 0.05, `gap ${gap.toFixed(2)} is a look, not a question`)
    t.is(drill.answer, equity > required ? 'call' : 'fold')
  }
})

test('the mode registers nothing, so nothing became free by accident', (t) => {
  // The ruling: a mode of pot odds, not a fifth kind. If this ever fails, some
  // future change has registered a kind, and a kind that ships without
  // `membersOnly` in the same commit is free forever under rule #8.
  t.is(DRILL_KINDS.length, 4)
  t.deepEqual(DRILL_KINDS.map((kind) => kind.id).sort(), [
    'count-your-outs',
    'hand-strength',
    'pot-odds',
    'which-hand-wins',
  ])
  // Every street it grades is a pot-odds street, which is what makes it inherit
  // that kind's `membersOnly` rather than needing its own.
  t.true(graded.length > 0)
  for (const { street } of graded) t.is(street.drill?.kind, 'pot-odds')
  t.true(DRILL_KINDS.find((kind) => kind.id === 'pot-odds')?.membersOnly === true)
})

test('a hand is the same hand every time it is dealt', (t) => {
  // The contract the four kinds hold and the reason a spot carries its seed.
  for (const seed of [3, 11, 29]) {
    t.deepEqual(generatePlayedHand(seed), generatePlayedHand(seed))
  }
})

test('a hand that is kept has a decision in it', (t) => {
  t.true(corpus.length > 0)
  for (const hand of corpus) {
    t.is(hand.streets.length, 3, 'the board runs out whether or not it is asked')
    t.true(
      hand.streets.some((s) => s.drill !== null),
      'a hand with nothing to answer is not a hand to play out',
    )
    t.deepEqual(
      hand.streets.map((s) => s.board.length),
      [3, 4, 5],
    )
  }
})

test('the pot grows by both bets and by nothing else', (t) => {
  t.true(corpus.length > 0)
  for (const hand of corpus) {
    let pot: number | null = null
    for (const street of hand.streets) {
      const stakes = street.drill?.stakes
      if (stakes) {
        const before = stakes.pot - stakes.toCall
        if (pot !== null) t.is(before, pot, 'a street starts on the pot the last one left')
        t.is(street.potAfter, before + 2 * stakes.toCall, 'theirs and the call')
      } else if (pot !== null) {
        t.is(street.potAfter, pot, 'a street with no question is checked through')
      }
      pot = street.potAfter
    }
  }
})

test('the answers are not all one way', (t) => {
  // Priced at random, four spots in five would be folds, and the rating would
  // read who had noticed the habit rather than who can count. Each street is
  // only asked where the pot could carry a bet making it either answer, and a
  // coin picks which. Same guarantee the face-up kind gives.
  const answers = graded.map(({ street }) => street.drill?.answer)
  t.true(answers.length >= 8)
  t.true(answers.includes('call'))
  t.true(answers.includes('fold'))
})

test('a street grades through the one grader', (t) => {
  const street = graded[0]?.street
  t.truthy(street?.drill)
  const drill = street?.drill
  if (!drill) return
  t.true(gradeDrill(drill, drill.answer).correct)
  t.false(gradeDrill(drill, drill.answer === 'call' ? 'fold' : 'call').correct)
  t.is(gradeDrill(drill, 'call').explanation, drill.explanation)
})

test('the sentence hedges, because the number it is reading is sampled', (t) => {
  // The face-up kind's sentence deliberately says no "about": it counted all 44
  // cards, and hedging an exact number is the dishonest thing in the other
  // direction. This one is reading a simulation and has to say so.
  t.true(graded.length > 0)
  for (const { street } of graded) {
    t.regex(street.drill?.explanation ?? '', /win about /)
    t.notRegex(street.drill?.explanation ?? '', /should have|wrong/)
  }
})

test('nextPlayedHand finds one and it is reproducible from its seed', (t) => {
  const hand = nextPlayedHand(101)
  t.true(hand.streets.some((s) => s.drill !== null))
  t.deepEqual(generatePlayedHand(hand.seed).hand, hand)
})

// --- the rule the screen walks a hand by ------------------------------------
//
// The mode is a screen and CI has no browser, so the rule that decides how far
// a hand gets is in the engine where a test can hold it. What it protects is
// not a nicety: the script prices every later street off a pot that both bets
// went into, so a hand carried on past a fold would be charging for chips that
// are not in the middle.

test('the hand runs while you call, and folding ends it', (t) => {
  const hand = nextPlayedHand(101)
  t.is(hand.streets.length, 3)

  // Calling walks to the next street, from wherever you are.
  t.is(afterStreet(hand, 0, 'call'), 1)
  t.is(afterStreet(hand, 1, 'call'), 2)
  // The river is the last one, so calling it ends the hand rather than
  // reaching for a fourth street that is not there.
  t.is(afterStreet(hand, 2, 'call'), 'over')

  // Folding ends it wherever it happens, and whether or not it was the answer:
  // it is what folding is, not a scoring rule.
  for (const index of [0, 1, 2]) t.is(afterStreet(hand, index, 'fold'), 'over')

  // A street with no price in it is checked through, and the hand carries on.
  t.is(afterStreet(hand, 0, null), 1)
  t.is(afterStreet(hand, 2, null), 'over')
})

test('every street says what the hero holds, asked or not', (t) => {
  // The screen prints it on each street, including the ones that are checked
  // through: a flop pair that turns into two pair is the reason the next price
  // is a different question, and a street with no drill has nothing else to
  // read it off.
  t.true(corpus.length > 0)
  let phrases = 0
  for (const hand of corpus) {
    for (const street of hand.streets) {
      if (street.drill) {
        // The same phrase the drill's own panel carries, so the two cannot
        // disagree about what you are holding on the street they both describe.
        t.is(street.detail, street.drill.hands?.[0]?.detail)
      }
      if (street.detail) {
        phrases++
        t.regex(street.detail, /^[A-Z]/, 'a phrase in the middle of a sentence, capitalised')
      }
    }
  }
  t.true(phrases > 0, 'no street held anything, so this proved nothing')
})
