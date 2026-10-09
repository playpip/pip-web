import { readFileSync } from 'node:fs'
import test from 'ava'
import {
  decide,
  pipUsers,
  rowFor,
  type Subscriber,
} from '../supabase/functions/revenuecat-webhook/rows'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const NOW = Date.parse('2026-10-09T12:00:00Z')

const holding = (
  expires: string | null,
  extra: Partial<Subscriber['subscriptions'][string]> = {},
) =>
  ({
    entitlements: { member: { expires_date: expires, product_identifier: 'pip_monthly' } },
    subscriptions: {
      pip_monthly: {
        store: 'app_store',
        expires_date: expires,
        unsubscribe_detected_at: null,
        billing_issues_detected_at: null,
        ...extra,
      },
    },
  }) satisfies Subscriber

const nothing: Subscriber = { entitlements: {}, subscriptions: {} }

test('a transfer names both accounts, though it carries no app_user_id', (t) => {
  // RevenueCat's TRANSFER payload: only transferred_from and transferred_to.
  const ids = pipUsers({
    type: 'TRANSFER',
    transferred_from: [A, '$RCAnonymousID:abc'],
    transferred_to: [B],
  })
  t.deepEqual(ids.sort(), [A, B].sort())
})

test('an ordinary event names its Pip account once, and nothing anonymous', (t) => {
  t.deepEqual(
    pipUsers({
      type: 'RENEWAL',
      app_user_id: A,
      original_app_user_id: '$RCAnonymousID:abc',
      aliases: [A, '$RCAnonymousID:abc'],
    }),
    [A],
  )
  t.deepEqual(pipUsers({ type: 'RENEWAL', app_user_id: '$RCAnonymousID:abc' }), [])
})

test('the account a membership was transferred away from stops being a member', (t) => {
  const write = decide(rowFor(A, nothing, NOW), { source: 'app_store', status: 'active' }, NOW)
  t.is(write.kind, 'lapse')
  if (write.kind === 'lapse') t.is(write.status, 'canceled')
})

test('the account it was transferred to becomes one', (t) => {
  const write = decide(rowFor(B, holding('2026-11-09T12:00:00Z'), NOW), null, NOW)
  t.is(write.kind, 'upsert')
  if (write.kind === 'upsert') {
    t.is(write.row.user_id, B)
    t.is(write.row.status, 'active')
    t.is(write.row.source, 'app_store')
  }
})

test('nothing in the store leaves a web membership and an empty account alone', (t) => {
  t.is(decide(null, { source: 'stripe', status: 'active' }, NOW).kind, 'none')
  t.is(decide(null, null, NOW).kind, 'none')
  t.is(decide(null, { source: 'play_store', status: 'canceled' }, NOW).kind, 'none')
})

test('a lapsed store membership never overwrites a live web one', (t) => {
  const lapsed = rowFor(A, holding('2026-10-01T00:00:00Z'), NOW)
  t.is(lapsed?.status, 'canceled')
  t.is(decide(lapsed, { source: 'stripe', status: 'active' }, NOW).kind, 'none')
  t.is(decide(lapsed, { source: 'app_store', status: 'active' }, NOW).kind, 'upsert')
})

test('a lapse with a billing problem on record is past_due, not cancelled', (t) => {
  const row = rowFor(A, holding('2026-10-01T00:00:00Z', { billing_issues_detected_at: 'x' }), NOW)
  t.is(row?.status, 'past_due')
})

test('the function syncs every account the event names', (t) => {
  const src = readFileSync(
    new URL('../supabase/functions/revenuecat-webhook/index.ts', import.meta.url),
    'utf-8',
  )
  t.regex(src, /for \(const userId of pipUsers\(event\)|const userIds = pipUsers\(event\)/)
  t.regex(src, /for \(const userId of userIds\)/)
  t.notRegex(src, /\.find\(pipUser\)/)
})
