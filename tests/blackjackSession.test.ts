// The stored blackjack session, which is chips on a client-written blob.
//
// The profile is written by the browser, so everything read back out of it is
// a claim rather than a fact. A session that says "I have 900,000 chips at a
// table called `free-money`" has to come back as nothing, and it has to do it
// without throwing, because the player on the other end of a corrupt blob has
// done nothing wrong and should land on the shelf rather than on an error.

import test from 'ava'
import { HOUSE_RULES } from '@/lib/blackjack/rules'
import { betLadder, isOfferedStack, minimumBet, resumeBlackjack } from '@/lib/blackjack/session'
import { BLACKJACK_STACKS } from '@/lib/blackjack/rules'

test('a real session comes back with its table attached', (t) => {
  const open = resumeBlackjack({ table: 'brutal', stack: 1_234, boughtIn: 2_000 })
  t.is(open?.rules.id, 'brutal')
  t.is(open?.stack, 1_234)
  t.is(open?.boughtIn, 2_000)
})

test('a session at a table that does not exist is not a session', (t) => {
  t.is(resumeBlackjack({ table: 'free-money', stack: 900_000, boughtIn: 1 }), null)
  t.is(resumeBlackjack({ table: '', stack: 100, boughtIn: 100 }), null)
})

test('a stack that is not a number is not a stack', (t) => {
  for (const stack of [Number.NaN, Number.POSITIVE_INFINITY, -50, '900000', null, undefined]) {
    t.is(resumeBlackjack({ table: 'standard', stack, boughtIn: 500 }), null, String(stack))
  }
})

test('a session nobody bought into is refused', (t) => {
  // `boughtIn` drives the table minimum, so a zero would divide the bet ladder
  // into nothing and a negative one would invert it.
  t.is(resumeBlackjack({ table: 'standard', stack: 500, boughtIn: 0 }), null)
  t.is(resumeBlackjack({ table: 'standard', stack: 500, boughtIn: -100 }), null)
})

test('nothing at all is not a session', (t) => {
  for (const junk of [null, undefined, 0, 'yes', [], {}]) {
    t.is(resumeBlackjack(junk), null, JSON.stringify(junk) ?? 'undefined')
  }
})

test('a stack with a fraction in it is floored, never rounded up', (t) => {
  // Rounding up invents a chip. It is one chip, and it is still invented.
  t.is(resumeBlackjack({ table: 'standard', stack: 100.9, boughtIn: 500.9 })?.stack, 100)
  t.is(resumeBlackjack({ table: 'standard', stack: 100.9, boughtIn: 500.9 })?.boughtIn, 500)
})

test('only the stacks the shelf offers can be bought in for', (t) => {
  for (const stack of BLACKJACK_STACKS) t.true(isOfferedStack(stack))
  // The hand-typed URL: a stack nobody was offered.
  t.false(isOfferedStack(999_999))
  t.false(isOfferedStack(0))
  t.false(isOfferedStack(-500))
})

test('the table minimum scales with the buy-in and is never zero', (t) => {
  t.is(minimumBet(500), 5)
  t.is(minimumBet(50_000), 500)
  // Every stack gets the same number of minimum bets, which is the point.
  for (const stack of BLACKJACK_STACKS) t.is(Math.round(stack / minimumBet(stack)), 100)
  t.true(minimumBet(1) >= 1, 'a table with a minimum of nothing')
})

test('the bet ladder climbs and starts at the minimum', (t) => {
  for (const stack of BLACKJACK_STACKS) {
    const ladder = betLadder(stack)
    t.is(ladder[0], minimumBet(stack))
    t.deepEqual(
      ladder,
      [...ladder].sort((a, b) => a - b),
      `the ${stack} ladder is out of order`,
    )
    t.true(ladder[ladder.length - 1] <= stack, 'the top bet is more than the whole stack')
  }
})

test('every house has an id the session can be stored under', (t) => {
  for (const house of HOUSE_RULES) {
    t.is(resumeBlackjack({ table: house.id, stack: 10, boughtIn: 500 })?.rules.id, house.id)
  }
})
