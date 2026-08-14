import test from 'ava'
import {
  BET_SIZES,
  CHARGED_DRAWS,
  DRAWS,
  PRICE_TAP_SIZES,
  TWO_PRICE_SIZES,
  WORKED_SPOTS,
  betSizes,
  breakevenFolds,
  chargingBet,
  oneCardChance,
  requiredEquity,
} from '@/config/potOdds'
import {
  COMPARED_HANDS,
  COMPARED_SEATS,
  SEATS,
  SEATS_AT_A_TABLE,
  opensHand,
  playersBehind,
  postflopPlace,
  preflopPlace,
} from '@/config/positions'
import { BAND_ORDER, HAND_BANDS } from '@/config/startingHands'
import { cardFromString, cardToString, createDeck } from '@/lib/poker/cards'
import { evaluateHand } from '@/lib/poker/handEval'

// The six guide interactions draw their numbers rather than print them, and a
// bar is not readable by a test. What is testable is the data underneath: that
// every figure a widget shows is derived from the same arithmetic the page's
// prose uses, and that the verdicts the widgets state out loud are the ones the
// arithmetic gives.
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

// --- WhatItCosts -----------------------------------------------------------

/**
 * The widget's whole claim is that the lit slice of the bar IS the price: it
 * draws your call as a share of the final pot, and prints requiredEquity()
 * above it. Those are the same number or the picture is a lie, so it is pinned
 * as the identity rather than as six rounded percentages.
 */
test('the call as a share of the final pot is the price the widget prints', (t) => {
  for (const size of betSizes(PRICE_TAP_SIZES)) {
    const pot = 100
    const bet = pot * size.fraction
    // The widget divides chips (33 into 166) where requiredEquity() divides
    // fractions, so a third of a pot lands a float's width apart. The claim is
    // that the bar and the percentage are the same number, not that two routes
    // to it round identically, so the tolerance is that width and no more.
    t.true(
      Math.abs(bet / (pot + 2 * bet) - requiredEquity(size.fraction)) < 1e-12,
      `${size.id}: ${bet / (pot + 2 * bet)} vs ${requiredEquity(size.fraction)}`,
    )
  }
})

test('every size the taps offer is one the table above them prices', (t) => {
  for (const id of PRICE_TAP_SIZES) {
    t.truthy(
      BET_SIZES.find((size) => size.id === id),
      id,
    )
  }
  // Six distinct sizes, ascending, which is the order the table prints and the
  // order the taps are laid out in.
  t.is(new Set(PRICE_TAP_SIZES).size, PRICE_TAP_SIZES.length)
  const fractions = betSizes(PRICE_TAP_SIZES).map((size) => size.fraction)
  for (let i = 1; i < fractions.length; i++) {
    t.true(fractions[i] > fractions[i - 1])
  }
  // The widget opens on the half-pot bet, so it has to be one of the six.
  t.true(PRICE_TAP_SIZES.includes('half'))
})

// --- SameHandThreeSeats ----------------------------------------------------

/**
 * Three seats that give three different answers, or the widget is showing the
 * same panel three times. The middle seat has to differ from both ends for at
 * least one hand, otherwise two of the three panels are decoration.
 */
test('the three compared seats open three different bands', (t) => {
  t.deepEqual(
    COMPARED_SEATS.map((seat) => seat.id),
    ['utg', 'mp', 'btn'],
  )
  t.deepEqual(
    COMPARED_SEATS.map((seat) => seat.opens),
    ['any', 'middle', 'late'],
  )
})

/**
 * The verdicts the widget draws, spelled out. Four hands change across the
 * three seats and aces do not, which is the reason aces are in the list: a set
 * of examples that all move teaches that position decides everything.
 */
test('the verdicts move with the seat, except for aces', (t) => {
  const verdicts = (hand: string) => COMPARED_SEATS.map((seat) => opensHand(seat, hand))
  t.deepEqual(verdicts('J9s'), [false, true, true])
  t.deepEqual(verdicts('KJo'), [false, true, true])
  t.deepEqual(verdicts('76s'), [false, true, true])
  t.deepEqual(verdicts('A9o'), [false, false, true])
  t.deepEqual(verdicts('AA'), [true, true, true])
  for (const hand of COMPARED_HANDS) {
    t.truthy(HAND_BANDS[hand], `${hand} is not on the chart`)
  }
})

/**
 * The verdict is the chart's, not the widget's. Every hand on the chart has to
 * come out the same way through opensHand() as it does by reading the band off
 * the grid, or the two pages can disagree about a hand.
 */
test('a seat opens exactly its own band and the bands above it', (t) => {
  for (const seat of SEATS) {
    for (const hand of Object.keys(HAND_BANDS)) {
      const expected =
        seat.opens !== null &&
        BAND_ORDER.indexOf(HAND_BANDS[hand]) <= BAND_ORDER.indexOf(seat.opens)
      t.is(opensHand(seat, hand), expected, `${seat.id} / ${hand}`)
    }
    // A hand that is not on the chart is a fold from everywhere, blinds too.
    t.false(opensHand(seat, '72o'), seat.id)
  }
})

// --- WhatItChargesADraw ----------------------------------------------------

/**
 * The one the spec asked to be pinned by counting cards rather than adding two
 * numbers up. Every one of the 47 unseen cards is played as a turn and run
 * through the evaluator: an out is a card that makes the draw, which for these
 * four is a straight or better. Fifteen outs on J♠T♠ / 9♠8♠2♦ is nine spades
 * plus the queens and sevens less the two already counted, and 9 + 8 = 17 is
 * the wrong answer that looks right on paper.
 */
const AT_LEAST_A_STRAIGHT = evaluateHand(
  [cardFromString('9c'), cardFromString('8d')],
  [cardFromString('7h'), cardFromString('6s'), cardFromString('5c')],
).categoryRank

function countOuts(draw: { hero: readonly string[]; board: readonly string[] }): number {
  const hero = draw.hero.map(cardFromString)
  const board = draw.board.map(cardFromString)
  const seen = new Set(
    [...draw.hero, ...draw.board].map((code) => cardToString(cardFromString(code))),
  )
  return createDeck()
    .filter((card) => !seen.has(cardToString(card)))
    .filter((turn) => evaluateHand(hero, [...board, turn]).categoryRank >= AT_LEAST_A_STRAIGHT)
    .length
}

test('every drawn board really holds the number of outs the widget prints', (t) => {
  for (const draw of CHARGED_DRAWS) {
    const all = [...draw.hero, ...draw.board]
    t.is(new Set(all).size, all.length, `${draw.id} deals a card twice`)
    t.is(all.length, 5, draw.id)
    t.is(countOuts(draw), draw.outs, draw.id)
  }
  // The row the widget is worth building for, named so it cannot quietly leave.
  t.is(CHARGED_DRAWS.find((draw) => draw.id === 'combo')!.outs, 15)
})

test('the drawn draws are the outs table’s own rows, in its order', (t) => {
  const drawn = CHARGED_DRAWS.map((draw) => draw.id)
  t.deepEqual(
    drawn,
    DRAWS.map((draw) => draw.id).filter((id) => drawn.includes(id)),
  )
  for (const draw of CHARGED_DRAWS) {
    const row = DRAWS.find((known) => known.id === draw.id)!
    t.is(draw.outs, row.outs)
    t.is(draw.label, row.label)
  }
})

/**
 * The bar is the pot and the fill is the bet, so a threshold over 1 would draw
 * a full bar and say something the arithmetic does not: three of the four fit
 * inside the pot and the fifteen-out row nearly fills it, which is the shape
 * the section above the widget describes in words.
 */
test('the charging bet fits inside the pot for every drawn draw', (t) => {
  for (const draw of CHARGED_DRAWS) {
    const threshold = chargingBet(draw.outs)
    t.true(threshold > 0 && threshold < 1, `${draw.id}: ${threshold}`)
  }
  const combo = chargingBet(CHARGED_DRAWS.find((draw) => draw.id === 'combo')!.outs)
  t.true(combo > 0.85, `${combo}`)
  const flush = chargingBet(CHARGED_DRAWS.find((draw) => draw.id === 'flush')!.outs)
  t.true(flush < 1 / 3, `${flush}`)
})
