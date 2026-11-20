import { readFileSync } from 'node:fs'
import test from 'ava'

const store = readFileSync(new URL('../src/lib/membership/store.ts', import.meta.url), 'utf-8')

/** The body of one exported function, up to the next top-level declaration. */
const body = (name: string) => {
  const start = store.indexOf(`export async function ${name}(`)
  const end = store.indexOf('\n}\n', start)
  return store.slice(start, end)
}

test('a store purchase counts the same funnel steps a Stripe checkout does', (t) => {
  const buy = body('buyInStore')
  const opened = buy.indexOf("trackOnce('checkout-opened')")
  const asked = buy.indexOf("type: 'purchase'")
  const completed = buy.indexOf("trackOnce('checkout-completed')")
  const active = buy.indexOf("trackOnce('membership-active')")
  t.true(opened > -1 && opened < asked, 'opened is counted before the sheet')
  t.true(completed > asked, 'completed is counted after the store answers')
  t.true(active > completed, 'active is counted once the row arrives')
  t.regex(buy, /if \(failed\) return failed[\s\S]*checkout-completed/)
})

test('a restore counts nothing, since nothing was bought', (t) => {
  t.notRegex(body('restoreFromStore'), /trackOnce/)
})

const join = readFileSync(
  new URL('../src/components/membership/Join.tsx', import.meta.url),
  'utf-8',
)

test('a restore the store confirmed never says there was nothing to restore', (t) => {
  t.regex(body('restoreFromStore'), /return \{ ok: true, member: false, found: true \}/)
  t.regex(join, /if \(bought \|\| result\.found\)/, 'a found restore waits, it is not "nothing"')
  t.regex(join, /found your membership\. This page will change by itself/)
})

test('a slow store purchase or restore keeps checking for the row', (t) => {
  const late = body('keepWaitingForRow')
  t.regex(late, /awaitMembership\(LATE_CHECKS, wanted\)/)
  t.regex(
    late,
    /if \(member && bought\) trackOnce\('membership-active'\)/,
    'only a purchase counts',
  )
  t.regex(
    join,
    /keepWaitingForRow\(\(\) => live, late\.bought\)/,
    'the wait stops when the screen closes',
  )
  t.regex(join, /act\(\(\) => buyInStore\(plan\), true\)/, 'a purchase is the one that counts')
  t.regex(join, /act\(restoreFromStore, false\)/, 'a restore counts nothing')
})
