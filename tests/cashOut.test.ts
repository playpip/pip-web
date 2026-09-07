// Standing up: what a table stack is worth back in the Roll.
//
// The buy-in leaves the Roll at sit-down and the stack comes back at cash-out,
// so those two have to be in the same chips. At the two venues that deal a
// stack unequal to their buy-in they were not (technology#89): The Study paid
// 1,000 chips for sitting down and standing straight back up, and the
// All-Nighter charged 600 for the same nothing.
//
// The invariant every venue has to hold: sit down, stand up, play no hands, and
// the Roll is exactly where it started.

import test from 'ava'
import { ALL_VENUES, cashOutValue, venueById, type Venue } from '@/config/venues'

const stackOf = (v: Venue) => v.startingStack ?? v.buyIn
const venue = (id: string) => {
  const v = venueById(id)
  if (!v) throw new Error(`no venue ${id}`)
  return v
}

test('sitting down and standing up again costs nothing, at every venue', (t) => {
  for (const v of ALL_VENUES) {
    // A freeroll is the exception, and a deliberate one: the stack is the
    // house's, so only the prize pays.
    const expected = v.freeroll ? 0 : v.buyIn
    t.is(cashOutValue(v, stackOf(v)), expected, `${v.id} is not Roll-neutral on a sit-and-stand`)
  }
})

test('an empty stack cashes out nothing, at every venue', (t) => {
  for (const v of ALL_VENUES) t.is(cashOutValue(v, 0), 0, v.id)
})

test('the deep table converts back at the rate you bought in', (t) => {
  const study = venue('study') // 1,000 buys a 2,000 stack
  t.is(cashOutValue(study, 2_000), 1_000)
  t.is(cashOutValue(study, 4_000), 2_000) // doubled up: doubled the buy-in
  t.is(cashOutValue(study, 1_000), 500) // lost half the stack: lost half the buy-in
})

test('the shallow table converts back the same way', (t) => {
  const allnighter = venue('allnighter') // 1,500 buys a 900 stack
  t.is(cashOutValue(allnighter, 900), 1_500)
  t.is(cashOutValue(allnighter, 1_800), 3_000)
  // The case the leave dialog used to report as -100: 1,400 chips in front of
  // you at a table you bought into for 1,500.
  t.is(cashOutValue(allnighter, 1_400), 2_333)
})

test('the freeroll pays nothing however the stack ended up', (t) => {
  const kitchen = venue('kitchen')
  t.is(cashOutValue(kitchen, 50), 0)
  t.is(cashOutValue(kitchen, 5_000), 0)
})

test('a cash table pays its chips back at face value', (t) => {
  // The Rail deals a stack equal to the buy-in, so there is no rate and rebuys
  // (which the dialog counts in `cashInvested`) cannot skew one.
  for (const v of ALL_VENUES.filter((x) => x.cash)) {
    t.is(cashOutValue(v, stackOf(v) * 3), stackOf(v) * 3, v.id)
    t.is(cashOutValue(v, 17), 17, v.id)
  }
})
