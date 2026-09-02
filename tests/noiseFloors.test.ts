import test from 'ava'
import { COST_FLOOR_IN_BB, EDGE_FLOOR, ITERATIONS } from '@/lib/coach'
import { STYLE_MIN_HANDS, derivePlayStyle } from '@/lib/playStyle'
import { cardFromString, mulberry32 } from '@/lib/poker/cards'
import { estimateEquity } from '@/lib/poker/equity'
import { READS_MIN_HANDS, deriveReads, emptySeatStats, type SeatStats } from '@/lib/reads'

// The sample-size floors, pinned to their values.
//
// **Why a test that asserts a constant is 20.** Normally that is a bad test: it
// makes tuning a knob cost a test edit and buys nothing. These two are not
// knobs. Each one is the point at which the product starts making a claim about
// a person — "you are The Maniac", "they play most hands" — and the number is
// the whole of the promise that the claim is drawn from enough hands to mean
// anything. `lib/recap.ts` says it out loud at the top of the file: a short run
// "says less rather than saying something confident and wrong".
//
// Every existing test of these floors is written relative to the constant
// (`STYLE_MIN_HANDS - 1` and `STYLE_MIN_HANDS`), which is the right way to test
// the *gate* and cannot see a change to the value. Measured on 2026-08-25:
// `STYLE_MIN_HANDS` could be changed from 20 to 10 with the entire 475-test
// suite still green, so nothing anywhere held the number. Found while reviewing
// pip-web#89, whose author asked the right question about exactly this.
//
// So: changing one of these is a product decision about how little evidence we
// are willing to speak from. It should cost a deliberate edit here, with the
// new number argued for in the commit, rather than passing as a refactor.

const stats = (over: Partial<SeatStats> = {}): SeatStats => ({ ...emptySeatStats(), ...over })

test('the play-style floor is twenty hands', (t) => {
  t.is(
    STYLE_MIN_HANDS,
    20,
    'STYLE_MIN_HANDS decides how few hands we will name somebody an archetype from. Changing it is a product decision, not a refactor: say why in the commit.',
  )
})

test('the opponent-read floor is eight hands', (t) => {
  t.is(
    READS_MIN_HANDS,
    8,
    'READS_MIN_HANDS decides how few hands we will describe an opponent from. Changing it is a product decision, not a refactor: say why in the commit.',
  )
})

// The floors are not independent of each other, and the ordering is the part
// that is arguable from first principles rather than asserted. A read is a
// hedged sentence about a stranger ("picks their spots"); a style is a named
// archetype for the player themselves, shown on /stats with a rating beside it.
// The stronger claim is the one that has to wait longer.
test('naming an archetype takes more evidence than describing an opponent', (t) => {
  t.true(
    STYLE_MIN_HANDS > READS_MIN_HANDS,
    'the strongest claim the product makes about a player now needs the least evidence',
  )
})

// The pins above are numbers. These two are what the numbers buy, checked
// through the functions rather than through the constants, so that a floor
// moved without moving this file fails twice.
test('one hand short of the floor, neither surface makes a claim', (t) => {
  const style = derivePlayStyle(stats({ handsDealt: 19, vpipHands: 10, raises: 1, calls: 1 }))
  t.false(style.ready, 'an archetype is named from 19 hands')

  t.is(deriveReads(stats({ handsDealt: 7, vpipHands: 4, raises: 2, calls: 2 })), null)
})

test('at the floor, both surfaces speak', (t) => {
  const style = derivePlayStyle(stats({ handsDealt: 20, vpipHands: 10, raises: 1, calls: 1 }))
  t.true(style.ready, 'twenty hands is the floor and it is not speaking')

  t.truthy(deriveReads(stats({ handsDealt: 8, vpipHands: 4, raises: 2, calls: 2 })))
})

// --- the coaching read ------------------------------------------------------
//
// The third floor of the same kind, and the only one with an arithmetic
// constraint on it. `EDGE_FLOOR` is how big an equity gap has to be before the
// read will call a decision right or wrong, and the estimate it is applied to is
// `ITERATIONS` Monte-Carlo runs. If the floor ever sits inside the estimator's
// own noise, the sentence a player reads is a coin flip wearing a percentage,
// and neither constant can be judged without the other.
//
// The bound is derivable rather than measured. One iteration of `estimateEquity`
// returns a share of the pot in [0, 1], so its variance is at most 0.25 and the
// standard error of the mean is at most `0.5 / sqrt(ITERATIONS)`. Nothing about
// the ranges, the opponent count or the board can push it above that.

/** The worst-case standard error of the read's equity estimate, in points. */
const seCeiling = (iterations: number) => (0.5 / Math.sqrt(iterations)) * 100

test('the coaching floors are pinned', (t) => {
  t.is(EDGE_FLOOR, 0.05, 'how big a gap has to be before the read judges a decision at all')
  t.is(ITERATIONS, 1500, 'the sample size the gap is measured with; EDGE_FLOOR depends on it')
  t.is(COST_FLOOR_IN_BB, 1, 'below one big blind of swing the read stays quiet')
})

test('the edge floor sits at least three sigma clear of the estimate it judges', (t) => {
  const sigma = seCeiling(ITERATIONS)
  t.true(
    EDGE_FLOOR * 100 >= 3 * sigma,
    `EDGE_FLOOR is ${(EDGE_FLOOR * 100).toFixed(1)}pts against a worst-case ${sigma.toFixed(2)}pt standard error at ${ITERATIONS} iterations. Lowering the floor or the iterations makes the read speak from noise: move them together, and say why.`,
  )
})

test('the estimator stays inside the bound the floor is derived from', (t) => {
  // A flop the read would actually be asked about: two live opponents who have
  // put money in, and a hand near 50% where the variance is worst.
  const hole = ['Ah', 'Kd'].map(cardFromString)
  const community = ['7c', '2d', '9s'].map(cardFromString)
  const equities = Array.from({ length: 12 }, (_, i) => {
    return estimateEquity({
      hole,
      community,
      opponents: 2,
      opponentSelectivity: [0.5, 0.5],
      iterations: ITERATIONS,
      rng: mulberry32(1000 + i),
    }).equity
  })

  const mean = equities.reduce((a, b) => a + b, 0) / equities.length
  const sd =
    Math.sqrt(equities.reduce((a, b) => a + (b - mean) ** 2, 0) / (equities.length - 1)) * 100

  t.true(
    sd <= seCeiling(ITERATIONS),
    `the read's equity estimate varies by ${sd.toFixed(2)}pts across seeds, above the ${seCeiling(ITERATIONS).toFixed(2)}pt ceiling the [0, 1] bound guarantees. estimateEquity has stopped returning a share of one pot per iteration, and the edge floor above is no longer derived from anything.`,
  )
})
