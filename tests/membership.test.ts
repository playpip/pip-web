import test from 'ava'
import {
  HOW_TO_CANCEL,
  MEMBERSHIP_FEATURES,
  MEMBERSHIP_PRICE,
  MEMBERSHIP_PROMISES,
  checkoutReady,
  included,
  sellableFeatures,
} from '@/config/membership'

// What is checked here is not arithmetic, it is honesty.
//
// `/membership` is the first page this project has ever built whose job is to
// persuade, and the failure it is prone to has a name in this repo already: the
// ROADMAP said the membership was not built when part of it was, then said one
// drill was behind it when it was two. Both were written by somebody who meant
// it at the time. A sales page has the same shape and a worse consequence,
// because somebody pays.
//
// So the list of what you get is data, the page renders a filtered view of it,
// and the filter is tested. A feature that does not exist cannot reach the page
// by being written enthusiastically.

test('a feature nobody can use yet is never advertised', (t) => {
  for (const feature of sellableFeatures()) {
    t.true(feature.shipped, `${feature.id} is sellable without being shipped`)
  }
  const unshipped = MEMBERSHIP_FEATURES.filter((f) => !f.shipped)
  t.false(
    sellableFeatures().some((f) => unshipped.includes(f)),
    'an unshipped feature reached the sellable list',
  )
})

// The point of the list is that it carries both, so the page can say "here is
// what you get today" without the roadmap half quietly disappearing from the
// file and reappearing as marketing. If everything is shipped, this test is the
// one that should be deleted, deliberately, by somebody who has read it.
test('the list still carries the things that are not built', (t) => {
  t.true(
    MEMBERSHIP_FEATURES.some((f) => !f.shipped),
    'every feature is shipped — if that is true, say so on the page on purpose',
  )
  t.true(
    MEMBERSHIP_FEATURES.every((f) => f.title && f.blurb),
    'a feature with nothing to say',
  )
})

// Drills shipped and are gated today. If this fails, either the drills became
// free or the list stopped mentioning them, and both are decisions rather than
// slips.
test('the drills are on the list and they are real', (t) => {
  const drills = MEMBERSHIP_FEATURES.find((f) => f.id === 'drills')
  t.truthy(drills, 'the one thing the membership actually contains is not listed')
  t.true(drills?.shipped, 'the gated drills are live in the app')
})

// One price, written once. The pence and the display string are two
// representations of one number and the way they break is that somebody edits
// the copy and not the integer Stripe is charging against.
test('the price says the same thing twice', (t) => {
  t.is(MEMBERSHIP_PRICE.monthlyPence, 599)
  t.is(MEMBERSHIP_PRICE.annualPence, 4900)
  t.is(MEMBERSHIP_PRICE.monthly, '£5.99')
  t.is(MEMBERSHIP_PRICE.annual, '£49')
  t.is(MEMBERSHIP_PRICE.currency, 'GBP')
  t.true(
    MEMBERSHIP_PRICE.annualPence < MEMBERSHIP_PRICE.monthlyPence * 12,
    'the annual price is not a saving',
  )
})

// Nobody can buy anything until the Stripe ids are configured, and the join
// button reads this rather than rendering hopefully. A checkout that cannot
// complete is worse than no button.
test('checkout is closed until Stripe is configured', (t) => {
  t.is(
    checkoutReady(),
    Boolean(
      process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY && process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL,
    ),
  )
})

// The two promises are said out loud on the page rather than kept in docs,
// because a rule the customer can read is a rule we can be held to. Pinned here
// so that removing one is a test edit somebody has to justify.
test('the two promises are still made', (t) => {
  t.is(MEMBERSHIP_PROMISES.length, 2)
  t.regex(MEMBERSHIP_PROMISES[0], /free/i)
  t.regex(MEMBERSHIP_PROMISES[1], /nothing you can buy changes a hand/i)
  t.regex(HOW_TO_CANCEL, /cancel/i)
})

// The gate itself. One line, and the only thing worth pinning is the direction
// of the default: no flag means everybody, and that is what stops a new venue
// or cosmetic being paid by accident.
test('the gate lets everyone through unless something says otherwise', (t) => {
  t.true(included({}, false), 'an unflagged thing is not free')
  t.true(included({}, true))
  t.true(included({ membersOnly: false }, false))
  t.false(included({ membersOnly: true }, false), 'a stranger opened a paid thing')
  t.true(included({ membersOnly: true }, true), 'a member was refused what they paid for')
})
