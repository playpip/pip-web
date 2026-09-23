import test from 'ava'
import { CURRENCIES, MEMBERSHIP_PRICE, MEMBERSHIP_PRICES, formatPrice } from '@/config/membership'
import { detectCurrency } from '@/lib/membership/currency'

// Four prices for one membership, and the ways that goes wrong are the ways
// `the price says the same thing twice` in membership.test.ts guards for the
// pound, multiplied: a display string edited without its minor units, a yearly
// price that stopped being a saving, and a number typed rather than converted.

test('every currency says the same thing twice', (t) => {
  for (const code of CURRENCIES) {
    const p = MEMBERSHIP_PRICES[code]
    t.is(p.currency, code)
    t.is(
      formatPrice(p.monthlyMinor, code),
      p.monthly,
      `${code} monthly display disagrees with its minor units`,
    )
    t.is(
      formatPrice(p.annualMinor, code),
      p.annual,
      `${code} yearly display disagrees with its minor units`,
    )
  }
})

test('the pound is the base, and it is the pound in membership.test.ts', (t) => {
  t.is(MEMBERSHIP_PRICES.GBP.monthlyMinor, MEMBERSHIP_PRICE.monthlyPence)
  t.is(MEMBERSHIP_PRICES.GBP.annualMinor, MEMBERSHIP_PRICE.annualPence)
  t.is(MEMBERSHIP_PRICES.GBP.ratePerGbp, 1)
})

test('yearly is a saving in every currency', (t) => {
  for (const code of CURRENCIES) {
    const p = MEMBERSHIP_PRICES[code]
    t.true(p.annualMinor < p.monthlyMinor * 12, `${code}: the yearly price is not a saving`)
  }
})

// The rule is "convert, then round": monthly to the nearest .99 (whole yuan for
// CNY), yearly to the nearest whole unit. So every price sits within a unit of
// the pound's price at the rate it was set from — a price outside that was
// typed, not converted.
test('every price is the pound converted and rounded, not a number somebody typed', (t) => {
  for (const code of CURRENCIES) {
    const p = MEMBERSHIP_PRICES[code]
    const monthly = (MEMBERSHIP_PRICE.monthlyPence / 100) * p.ratePerGbp
    const annual = (MEMBERSHIP_PRICE.annualPence / 100) * p.ratePerGbp
    t.true(
      Math.abs(p.monthlyMinor / 100 - monthly) <= 1,
      `${code} monthly is not the pound converted`,
    )
    t.true(Math.abs(p.annualMinor / 100 - annual) <= 1, `${code} yearly is not the pound converted`)
    t.true(Number.isInteger(p.annualMinor / 100), `${code} yearly is not a whole unit`)
  }
})

test('the page opens in the currency the browser points at', (t) => {
  t.is(detectCurrency(['en-GB'], 'Europe/London'), 'GBP')
  t.is(detectCurrency(['en-US'], 'America/New_York'), 'USD')
  t.is(detectCurrency(['de-DE', 'en'], 'Europe/Berlin'), 'EUR')
  t.is(detectCurrency(['zh-CN'], 'Asia/Shanghai'), 'CNY')
  t.is(detectCurrency(['zh-Hans-CN'], 'Asia/Shanghai'), 'CNY')
  t.is(detectCurrency(['fr'], 'Europe/Paris'), 'EUR', 'a bare language falls back to the time zone')
  t.is(detectCurrency(['en'], 'Europe/London'), 'GBP')
})

test('an unrecognised region is dollars, and Hong Kong is not mainland China', (t) => {
  t.is(detectCurrency(['en-IN'], 'Asia/Kolkata'), 'USD')
  t.is(detectCurrency(['zh-HK'], 'Asia/Hong_Kong'), 'USD')
  t.is(detectCurrency([], 'UTC'), 'USD')
})

// en-US is the default language of a great many browsers outside the US, so a
// region nobody has a price for defers to the time zone before giving up.
test('a default en-US browser in Europe sees euros', (t) => {
  t.is(detectCurrency(['en-US'], 'Europe/Madrid'), 'EUR')
})
