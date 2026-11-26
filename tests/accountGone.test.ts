import test from 'ava'
import {
  ACCOUNT_CHECK_EVERY_MS,
  accountCheckDue,
  accountIsGone,
} from '@/lib/multiplayer/accountGone'

const now = Date.parse('2026-11-26T12:00:00Z')

test('only a 404 naming user_not_found means the account is gone', (t) => {
  t.true(accountIsGone(404, { code: 404, error_code: 'user_not_found', msg: 'User not found' }))
})

test('anything short of that keeps the player, so an outage never forgets anyone', (t) => {
  // A wrong URL, a proxy or an old server: a 404 that does not say who.
  t.false(accountIsGone(404, null))
  t.false(accountIsGone(404, 'Not Found'))
  t.false(accountIsGone(404, { msg: 'User not found' }))
  t.false(accountIsGone(404, { error_code: 'not_found' }))
  // A bad key, rate limits, outages.
  t.false(accountIsGone(401, { error_code: 'user_not_found' }))
  t.false(accountIsGone(403, { error_code: 'user_not_found' }))
  t.false(accountIsGone(429, null))
  t.false(accountIsGone(500, { error_code: 'user_not_found' }))
  t.false(accountIsGone(503, null))
  // The account is there.
  t.false(accountIsGone(200, { id: 'u1', email: 'a@b.c' }))
})

test('the check is asked at most once a day, and straight away the first time', (t) => {
  t.true(accountCheckDue(null, now))
  t.false(accountCheckDue(now, now))
  t.false(accountCheckDue(now - ACCOUNT_CHECK_EVERY_MS + 1, now))
  t.true(accountCheckDue(now - ACCOUNT_CHECK_EVERY_MS, now))
  t.is(ACCOUNT_CHECK_EVERY_MS, 24 * 60 * 60 * 1000)
})
