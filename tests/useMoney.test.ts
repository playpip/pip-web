import test from 'ava'
import { formatChips, useMoney } from '@/lib/useMoney'

// formatChips is `Math.round(amount).toLocaleString()`. Called with no locale
// argument, toLocaleString() uses Node's default locale — which resolves to
// en-US in every environment this runs in. CI is Node 22 on ubuntu-latest
// (LANG=C.UTF-8), and Node's bundled ICU falls back to en-US for C / C.UTF-8 /
// an unset locale alike, all of which yield the comma-grouped, '.'-decimal
// output asserted below. So these exact strings are deterministic despite
// toLocaleString() being locale-dependent in general.
//
// Real call sites (pot wins in src/store/game.ts, chip balances in components)
// pass non-negative integers, but formatChips is a pure, total function over
// all numbers, so the rounding / negative / edge cases below document its
// actual behaviour rather than only the values seen in the app today.

test('small non-negative integers are returned as-is', (t) => {
  t.is(formatChips(0), '0')
  t.is(formatChips(7), '7')
  t.is(formatChips(999), '999')
})

test('thousands and above get a grouping separator', (t) => {
  t.is(formatChips(1000), '1,000')
  t.is(formatChips(1200), '1,200')
  t.is(formatChips(12345), '12,345')
  t.is(formatChips(1000000), '1,000,000')
})

test('non-integers are rounded to the nearest chip', (t) => {
  t.is(formatChips(1.4), '1')
  t.is(formatChips(1.6), '2')
  t.is(formatChips(1234.49), '1,234')
  t.is(formatChips(1234.5), '1,235')
})

test('halves round toward +Infinity, following Math.round', (t) => {
  t.is(formatChips(0.5), '1')
  t.is(formatChips(1.5), '2')
  t.is(formatChips(2.5), '3')
})

test('negative amounts keep the sign and are still grouped', (t) => {
  t.is(formatChips(-7), '-7')
  t.is(formatChips(-1200), '-1,200')
  t.is(formatChips(-1234567), '-1,234,567')
})

test('negative halves round toward +Infinity; -0.5 lands on -0', (t) => {
  t.is(formatChips(-1.5), '-1')
  t.is(formatChips(-2.5), '-2')
  // Math.round(-0.5) === -0, and (-0).toLocaleString() keeps the sign.
  t.is(formatChips(-0.5), '-0')
})

test('useMoney returns the same formatter function', (t) => {
  t.is(useMoney(), formatChips)
  t.is(useMoney()(1200), '1,200')
})
