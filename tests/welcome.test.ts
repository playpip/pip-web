// The Welcome Table: a new player's first game. Short, free, on the house's
// chips, and played once (components/onboarding/firstSeat, welcome flow).

import test from 'ava'
import { WELCOME_TABLE, cashOutValue, houseStack, prizeFor, venueById } from '@/config/venues'
import { playedWelcome } from '@/components/onboarding/firstSeat'

test('the Welcome Table is a short heads-up game on the house', (t) => {
  t.is(WELCOME_TABLE.seats, 2)
  t.is(WELCOME_TABLE.buyIn, 0)
  t.is((WELCOME_TABLE.startingStack ?? 0) / WELCOME_TABLE.bigBlind, 8, '8 big blinds')
  t.is(WELCOME_TABLE.handsPerLevel, 3)
  t.true(houseStack(WELCOME_TABLE))
  t.is(cashOutValue(WELCOME_TABLE, 300), 0, 'leaving cashes out nothing')
  t.is(prizeFor(WELCOME_TABLE, 1), WELCOME_TABLE.prize)
  t.is(prizeFor(WELCOME_TABLE, 2), 0)
})

test('the Welcome Table has a route', (t) => {
  t.is(venueById('welcome'), WELCOME_TABLE)
})

test('it counts as played once it has been sat at', (t) => {
  t.false(playedWelcome({}))
  t.false(playedWelcome({ welcome: { entered: 0 } }))
  t.true(playedWelcome({ welcome: { entered: 1 } }))
  t.false(playedWelcome({ garage: { entered: 3 } }), 'other tables do not count')
})
