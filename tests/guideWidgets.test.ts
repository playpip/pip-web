import test from 'ava'
import {
  BET_SIZES,
  TWO_PRICE_SIZES,
  WORKED_SPOTS,
  breakevenFolds,
  oneCardChance,
  requiredEquity,
} from '@/config/potOdds'
import {
  SEATS,
  SEATS_AT_A_TABLE,
  playersBehind,
  postflopPlace,
  preflopPlace,
} from '@/config/positions'

// The three guide interactions (ThePrice, TheOrder, TwoPrices) draw their
// numbers rather than print them, and a bar is not readable by a test. What is
// testable is the data underneath: that every figure a widget shows is derived
// from the same arithmetic the page's prose uses, and that the verdicts the
// widgets state out loud are the ones the arithmetic gives.
//
// tests/potOdds.test.ts pins the arithmetic itself and tests/positions.test.ts
// pins the betting order against a real hand through the engine. This file
// covers only what the widgets add on top.

// --- ThePrice --------------------------------------------------------------

/**
 * The widget says call or fold against the ONE-CARD bar, which is the whole
 * point of the section it sits in. Pinned spot by spot: if a bet size or an out
 * count is ever edited, a verdict silently flipping is the failure this catches.
 */
test('every worked spot is a fold for one card, at the bet it faces', (t) => {
  for (const spot of WORKED_SPOTS) {
    const price = requiredEquity(spot.betFraction)
    t.true(
      oneCardChance(spot.outs) < price,
      `${spot.id}: one card is ${oneCardChance(spot.outs)}, price is ${price}`,
    )
  }
})

/**
 * ...and in four of the five, the by-river number clears that same price, which
 * is the contradiction the widget draws and deliberately leaves unresolved. The
 * gutshot is the exception: four outs do not get there even with both cards, so
 * nothing on that spot claims otherwise.
 */
test('the by-river figure clears the price everywhere except the gutshot', (t) => {
  const clears = WORKED_SPOTS.filter(
    (spot) => spot.equity / 100 > requiredEquity(spot.betFraction),
  ).map((spot) => spot.id)
  t.deepEqual(clears, ['flush-vs-overpair', 'flush-vs-set', 'monster-draw', 'open-ended'])
})

test('a spot is priced from its bet, never from a typed percentage', (t) => {
  for (const spot of WORKED_SPOTS) {
    // Fractions of a pot of 100, so the widget can show whole chips.
    t.true(Number.isInteger(100 * spot.betFraction), spot.id)
    t.true(spot.betFraction > 0)
    t.true(spot.note.length > 0, spot.id)
  }
})

// --- TwoPrices -------------------------------------------------------------

test('every size the widget offers is one the guide already prices', (t) => {
  for (const size of TWO_PRICE_SIZES) {
    t.truthy(
      BET_SIZES.find((known) => known.id === size.id),
      size.id,
    )
    t.true(size.note.length > 0, size.id)
  }
  // Ascending, the same order the table above the widget prints.
  const order = BET_SIZES.map((size) => size.id).filter((id) =>
    TWO_PRICE_SIZES.some((size) => size.id === id),
  )
  t.deepEqual(
    TWO_PRICE_SIZES.map((size) => size.id),
    order,
  )
})

/**
 * The pair is a trade, and the widget is only worth building if it is. Betting
 * more charges them more AND asks more of the bluff, so both figures rise
 * together: the cost of the size is always the second one.
 */
test('the two figures both rise with the size, and the fold price is always the higher', (t) => {
  const fractions = TWO_PRICE_SIZES.map(
    (size) => BET_SIZES.find((known) => known.id === size.id)!.fraction,
  )
  for (const fraction of fractions) {
    t.true(breakevenFolds(fraction) > requiredEquity(fraction))
  }
  for (let i = 1; i < fractions.length; i++) {
    t.true(requiredEquity(fractions[i]) > requiredEquity(fractions[i - 1]))
    t.true(breakevenFolds(fractions[i]) > breakevenFolds(fractions[i - 1]))
  }
})

// --- TheOrder --------------------------------------------------------------

/**
 * The ring is drawn by looking each seat's offset up in a table of six
 * positions. Six distinct offsets, 0 to 5, or two seats land on top of each
 * other and one of them is invisible.
 */
test('the six seats have six distinct offsets, so the ring has no gaps', (t) => {
  const offsets = SEATS.map((seat) => seat.offset).sort((a, b) => a - b)
  t.deepEqual(offsets, [0, 1, 2, 3, 4, 5])
  t.is(SEATS.length, SEATS_AT_A_TABLE)
  t.deepEqual(
    SEATS.map((seat) => seat.short),
    ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'],
  )
})

/**
 * The moment the widget exists for: select the button, flip the toggle, and it
 * walks from fourth to last while the blinds go from last and second-to-last to
 * first and second. If this ever stops being true the widget has no point.
 */
test('flipping the toggle moves the button to last and the blinds to first', (t) => {
  const seat = (id: string) => SEATS.find((s) => s.id === id)!
  t.is(preflopPlace(seat('btn')), 4)
  t.is(postflopPlace(seat('btn')), SEATS_AT_A_TABLE)
  t.is(preflopPlace(seat('sb')), 5)
  t.is(postflopPlace(seat('sb')), 1)
  t.is(preflopPlace(seat('bb')), SEATS_AT_A_TABLE)
  t.is(postflopPlace(seat('bb')), 2)
})

/**
 * The line the widget shows for a seat that is neither the button nor a blind
 * makes a claim: every one of them slides exactly two places later after the
 * flop. It holds because the two blinds jump to the front.
 */
test('every non-blind seat acts two places later once the flop is out', (t) => {
  for (const seat of SEATS.filter((s) => s.opens !== null)) {
    t.is(postflopPlace(seat) - preflopPlace(seat), 2, seat.id)
  }
  for (const seat of SEATS.filter((s) => s.opens === null)) {
    t.is(postflopPlace(seat) - preflopPlace(seat), -4, seat.id)
  }
})

test('the seat panel counts the players still to act preflop', (t) => {
  for (const seat of SEATS) {
    t.is(playersBehind(seat), SEATS_AT_A_TABLE - preflopPlace(seat), seat.id)
  }
})
