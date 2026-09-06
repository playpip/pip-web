import test from 'ava'
import {
  BET_SIZES,
  DRAWS,
  RULE_OF_FOUR_CROSSOVER,
  RULE_OF_TWO_DECK,
  RULE_OF_TWO_SHARE,
  UNSEEN_AFTER_FLOP,
  breakevenFolds,
  byRiverChance,
  cardsText,
  chargingBet,
  multiple,
  oneCardChance,
  pct,
  potMultiple,
  requiredEquity,
} from '@/config/potOdds'

// The arithmetic /learn/pot-odds and /learn/bet-sizing print. All of it is
// exact, so the tests are exact too: no tolerances, no rounding slack. The
// worked spots, which need the evaluator rather than a fraction, are in
// guideClaims.test.ts with the rest of the claims made in prose.

const at = (id: string) => BET_SIZES.find((size) => size.id === id)!.fraction

test('the price a bet sets is the bet over the pot after the call', (t) => {
  t.is(pct(requiredEquity(at('quarter'))), '16.7')
  t.is(pct(requiredEquity(at('third'))), '20')
  t.is(pct(requiredEquity(at('half'))), '25')
  t.is(pct(requiredEquity(at('twothirds'))), '28.6')
  t.is(pct(requiredEquity(at('threequarters'))), '30')
  t.is(pct(requiredEquity(at('pot'))), '33.3')
  t.is(pct(requiredEquity(at('overbet'))), '40')
})

// The mistake the guide names: dividing by the pot as it stands makes every
// price look better than it is. Worth pinning the direction of the error.
test('the price is never the naive bet-over-pot figure', (t) => {
  for (const size of BET_SIZES) {
    const naive = size.fraction / (1 + size.fraction)
    t.true(requiredEquity(size.fraction) < naive, size.id)
  }
})

test('a bluff has to work more often the bigger it is', (t) => {
  t.is(pct(breakevenFolds(at('third'))), '25')
  t.is(pct(breakevenFolds(at('half'))), '33.3')
  t.is(pct(breakevenFolds(at('twothirds'))), '40')
  t.is(pct(breakevenFolds(at('pot'))), '50')
  t.is(pct(breakevenFolds(at('overbet'))), '66.7')
  for (let i = 1; i < BET_SIZES.length; i++) {
    t.true(breakevenFolds(BET_SIZES[i].fraction) > breakevenFolds(BET_SIZES[i - 1].fraction))
  }
})

test('outs convert to one card and to both, by combination count', (t) => {
  const rows = Object.fromEntries(
    DRAWS.map((draw) => [
      draw.outs,
      [pct(oneCardChance(draw.outs)), pct(byRiverChance(draw.outs))],
    ]),
  )
  t.deepEqual(rows[4], ['8.5', '16.5'])
  t.deepEqual(rows[6], ['12.8', '24.1'])
  t.deepEqual(rows[8], ['17', '31.5'])
  t.deepEqual(rows[9], ['19.1', '35'])
  t.deepEqual(rows[15], ['31.9', '54.1'])
})

// The page says the rule of 4 is close enough at small counts and drifts high
// as they grow. Both halves of that, because "always wrong" would be wrong: at
// four outs the shortcut is actually a shade low, and the page now names the
// count it crosses over at, so the crossover is pinned below rather than left
// as a range in this comment.
test('the rule of 4 drifts high, and further with every out', (t) => {
  const drift = (outs: number) => outs * 4 - byRiverChance(outs) * 100
  for (let outs = 5; outs <= 15; outs++) t.true(drift(outs) > drift(outs - 1), `${outs} outs`)
  // "Close enough at small numbers": under a point either way up to six outs.
  for (let outs = 1; outs <= 6; outs++) t.true(Math.abs(drift(outs)) < 1, `${outs} outs`)
  t.true(drift(4) < 0)
  t.true(drift(8) > 0)
  t.is(Math.round(drift(15)), 6)
})

test('the rule of 2 is a shade low, always', (t) => {
  for (const draw of DRAWS) {
    const shortcut = draw.outs * 2
    const truth = oneCardChance(draw.outs) * 100
    t.true(shortcut < truth, `${draw.outs} outs`)
    // Low by the same 6.4% every time: 2 per out against 100/47.
    t.true(truth / shortcut < 1.07, `${draw.outs} outs, and not by much`)
  }
})

// The page says the rule of 2 is low by the same proportion at every count, and
// prints one figure for it. The claim is "without exception", so the test is
// every count the deck allows rather than the five in DRAWS.
test('the rule of 2 is low by one fixed proportion, at every out count', (t) => {
  t.is(RULE_OF_TWO_SHARE, UNSEEN_AFTER_FLOP / RULE_OF_TWO_DECK)
  t.is(pct(1 - RULE_OF_TWO_SHARE), '6')
  for (let outs = 1; outs <= UNSEEN_AFTER_FLOP; outs++) {
    const shortcut = oneCardChance(outs) * 100 * RULE_OF_TWO_SHARE
    t.is(Math.round(shortcut * 1e9), Math.round(outs * 2 * 1e9), `${outs} outs`)
  }
})

// The other half of the same sentence, and the number the page names: the rule
// of 4 reads low against byRiverChance below the crossover and high from it up.
// Checked over the whole deck so "up to" and "from" are exhaustive, not a spot
// check at the two counts the prose happens to mention.
test('the rule of 4 crosses from low to high at seven outs', (t) => {
  t.is(RULE_OF_FOUR_CROSSOVER, 7)
  for (let outs = 1; outs < UNSEEN_AFTER_FLOP; outs++) {
    const drift = outs * 4 - byRiverChance(outs) * 100
    if (outs < RULE_OF_FOUR_CROSSOVER) t.true(drift < 0, `${outs} outs reads low`)
    else t.true(drift > 0, `${outs} outs reads high`)
  }
})

test('the charging bet is the size that makes a one-card call break even', (t) => {
  for (const draw of DRAWS) {
    const size = chargingBet(draw.outs)
    t.is(Math.round(requiredEquity(size) * 1e10), Math.round(oneCardChance(draw.outs) * 1e10))
  }
  t.is(multiple(chargingBet(4), 3), '0.103')
  t.is(multiple(chargingBet(8), 3), '0.258')
  t.is(multiple(chargingBet(9), 3), '0.31')
  t.is(multiple(chargingBet(15), 3), '0.882')
})

test('a called bet grows the pot, and it compounds over three streets', (t) => {
  const overThree = (id: string) => potMultiple(at(id)) ** 3
  t.is(multiple(potMultiple(at('third'))), '1.67')
  t.is(multiple(overThree('third'), 1), '4.6')
  t.is(multiple(overThree('half'), 1), '8')
  t.is(multiple(overThree('twothirds'), 1), '12.7')
  t.is(multiple(overThree('pot'), 1), '27')
  t.is(Math.round(overThree('pot') * 10), 270)
})

test('there are 47 unseen cards from the flop', (t) => {
  t.is(UNSEEN_AFTER_FLOP, 52 - 2 - 3)
})

test('percentages print the way the copy reads them', (t) => {
  t.is(pct(0.25), '25')
  t.is(pct(0.3333333), '33.3')
  t.is(pct(0.0833333), '8.3')
  t.is(multiple(2), '2')
  t.is(multiple(2.3333), '2.33')
})

test('cards render as the guides write them', (t) => {
  t.is(cardsText(['8s', '7s']), '8♠7♠')
  t.is(cardsText(['9s', '4s', '2h']), '9♠4♠2♥')
  t.is(cardsText(['Ac', 'Ad']), 'A♣A♦')
})
