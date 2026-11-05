import test from 'ava'
import { cardFromString } from '@/lib/poker/cards'
import { OPEN_COST, gradeFirstIn } from '@/lib/rating/preflop'

// The first move when it folds round to you (lib/rating/preflop): the opening
// chart deep, the shove chart at fifteen big blinds or fewer.

const BB = 100
const hand = (a: string, b: string) => [cardFromString(a), cardFromString(b)]
/** A first-in spot: players behind, effective stack in big blinds. */
const spot = (behind: number, effectiveBb: number) => ({
  behind,
  effectiveBb,
  totalChips: effectiveBb * BB,
})

const ACES = hand('As', 'Ah')
const JUNK = hand('7c', '2d')
const LATE = hand('Ks', '8s') // on the chart from the cutoff and the button only

test('deep: raising a chart hand from its seat costs nothing', (t) => {
  const g = gradeFirstIn(ACES, spot(5, 100), { type: 'raise', amount: 250 }, BB)
  t.deepEqual(g && { kind: g.kind, loss: g.loss }, { kind: 'preflop-open', loss: 0 })
  t.is(gradeFirstIn(LATE, spot(2, 100), { type: 'raise', amount: 250 }, BB)?.loss, 0)
})

test('deep: opening junk costs more the earlier the seat', (t) => {
  const utg = gradeFirstIn(JUNK, spot(5, 100), { type: 'raise', amount: 250 }, BB)?.loss ?? 0
  const btn = gradeFirstIn(JUNK, spot(2, 100), { type: 'raise', amount: 250 }, BB)?.loss ?? 0
  t.true(utg > btn && btn > 0)
  t.is(utg, OPEN_COST.loosePerBand * 3)
})

test('deep: folding a premium costs the most, and folding junk is not counted', (t) => {
  t.is(gradeFirstIn(ACES, spot(5, 100), { type: 'fold' }, BB)?.loss, OPEN_COST.premiumFold)
  t.is(gradeFirstIn(JUNK, spot(5, 100), { type: 'fold' }, BB), null)
  // A late hand folded under the gun is right, and counted as right.
  t.is(gradeFirstIn(LATE, spot(5, 100), { type: 'fold' }, BB)?.loss, 0)
  t.is(gradeFirstIn(LATE, spot(2, 100), { type: 'fold' }, BB)?.loss, OPEN_COST.tightBase)
})

test('deep: limping is graded too', (t) => {
  t.is(gradeFirstIn(ACES, spot(5, 100), { type: 'call' }, BB)?.loss, OPEN_COST.limpInRange)
  t.true((gradeFirstIn(JUNK, spot(5, 100), { type: 'call' }, BB)?.loss ?? 0) > 0)
})

test('short: the shove chart prices shoves and folds exactly', (t) => {
  const shove = { type: 'raise', amount: 10 * BB }
  const shoved = gradeFirstIn(ACES, spot(2, 10), shove, BB)
  t.is(shoved?.kind, 'preflop-shove')
  t.is(shoved?.loss, 0)
  // Folding aces at ten blinds gives up most of a shove's value.
  t.true((gradeFirstIn(ACES, spot(2, 10), { type: 'fold' }, BB)?.loss ?? 0) > 1)
  // Junk shoved into five players at fifteen blinds is a mistake; folding it is free and not counted.
  t.true((gradeFirstIn(JUNK, spot(5, 15), { type: 'raise', amount: 15 * BB }, BB)?.loss ?? 0) > 0)
  t.is(gradeFirstIn(JUNK, spot(5, 15), { type: 'fold' }, BB), null)
})

test('nothing is graded where neither chart answers', (t) => {
  // Between the charts.
  t.is(gradeFirstIn(ACES, spot(5, 20), { type: 'fold' }, BB), null)
  // The small blind deep: the chart opens from four seats.
  t.is(gradeFirstIn(ACES, spot(1, 100), { type: 'raise', amount: 250 }, BB), null)
  // A short-stacked min-raise: the shove chart has no value for it.
  t.is(gradeFirstIn(ACES, spot(3, 10), { type: 'raise', amount: 2 * BB }, BB), null)
})

test('every grade stays inside what the server accepts', (t) => {
  for (const s of [spot(5, 3), spot(1, 15), spot(5, 100), spot(2, 40)])
    for (const cards of [ACES, JUNK, LATE])
      for (const move of [{ type: 'fold' }, { type: 'call' }, { type: 'raise', amount: 9e9 }]) {
        const g = gradeFirstIn(cards, s, move, BB)
        if (!g) continue
        t.true(g.stake >= 1 && g.stake <= 200)
        t.true(g.loss >= 0 && g.loss <= g.stake && g.loss <= 20)
      }
})
