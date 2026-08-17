import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'
import { DRILL_KINDS, type DrillKind, canPlayDrill } from '@/config/drills'
import {
  type MembershipRow,
  NOT_A_MEMBER,
  parseCache,
  readEntitlement,
} from '@/lib/membership/entitlement'

// Entitlement is the one piece of this app where being wrong costs somebody
// money or gives away the thing being sold. It is also the piece with no
// browser and no Stripe account to test against, so what is checked here is the
// part that can be: the rules, the migration's shape, and the two mistakes that
// would quietly undo the whole model — the client writing this table, and a
// paid drill kind shipping without saying it is paid.

const NOW = Date.UTC(2026, 7, 17, 9, 0, 0)
const HOUR = 3_600_000

const row = (over: Partial<MembershipRow> = {}): MembershipRow => ({
  user_id: 'u1',
  status: 'active',
  current_period_end: new Date(NOW + 24 * HOUR).toISOString(),
  cancel_at_period_end: false,
  ...over,
})

const server = (r: MembershipRow | null) => readEntitlement(r, { now: NOW, trusted: true })
const cached = (r: MembershipRow | null) => readEntitlement(r, { now: NOW, trusted: false })

test('no row is not a member, whichever side it came from', (t) => {
  t.deepEqual(server(null), NOT_A_MEMBER)
  t.deepEqual(cached(null), NOT_A_MEMBER)
  t.false(NOT_A_MEMBER.member)
})

// The statuses, from the server. Stripe has more of them than this and the
// point of storing the status raw is that we do not have to guess at the ones
// we have not met: anything not on the list does not entitle.
test('only a live subscription entitles', (t) => {
  for (const status of ['active', 'trialing']) {
    t.true(server(row({ status })).member, status)
  }
  for (const status of ['past_due', 'unpaid', 'canceled', 'incomplete', 'paused', 'nonsense']) {
    t.false(server(row({ status })).member, status)
  }
})

// `past_due` is the one worth pinning rather than listing. Stripe holds a
// subscription there for days while it retries a failed renewal, and the period
// that was paid for has already ended, so entitling it would be giving away the
// retry window every month.
test('a failed renewal stops entitling straight away', (t) => {
  const failed = server(row({ status: 'past_due' }))
  t.false(failed.member)
  t.is(failed.status, 'past_due', 'the reason survives, so a Settings row can say which it is')
})

test('cancelling plays out the period that was paid for', (t) => {
  const leaving = server(row({ cancel_at_period_end: true }))
  t.true(leaving.member, 'cancelled is not the same as over')
  t.true(leaving.cancelAtPeriodEnd)
})

// The cache is what keeps a member on a plane a member. It is also the one
// input to this file that a player can edit, so it is trusted for less: the
// status has to entitle *and* the period has to still be running.
test('a cached row is honoured until the period it paid for runs out', (t) => {
  t.true(cached(row({ current_period_end: new Date(NOW + HOUR).toISOString() })).member)
  t.false(cached(row({ current_period_end: new Date(NOW - HOUR).toISOString() })).member)
  t.false(cached(row({ current_period_end: null })).member, 'undatable, so uncheckable')
  t.false(cached(row({ current_period_end: 'not a date' })).member)
  // The same row straight from the server does entitle: it was just written by
  // the webhook, so its status is the current fact and there is nothing to
  // check it against.
  t.true(server(row({ current_period_end: null })).member)
})

test('a cache belonging to somebody else is not a cache', (t) => {
  const blob = JSON.stringify({ userId: 'u1', row: row() })
  t.truthy(parseCache(blob, 'u1'))
  t.is(parseCache(blob, 'u2'), null, 'a second account on a shared device inherits nothing')
  t.is(parseCache(null, 'u1'), null)
  t.is(parseCache('{oh dear', 'u1'), null, 'a hand-edited cache must not stop the app booting')
  t.is(parseCache('{"userId":"u1"}', 'u1'), null)
  t.is(parseCache('{"userId":"u1","row":{}}', 'u1'), null)
})

test('a parsed cache carries nothing it was not given', (t) => {
  const parsed = parseCache(
    JSON.stringify({ userId: 'u1', row: { status: 'active', extra: 'ignored' } }),
    'u1',
  )
  t.deepEqual(parsed, {
    user_id: 'u1',
    status: 'active',
    current_period_end: null,
    cancel_at_period_end: false,
  })
  t.false(cached(parsed).member, 'a bare status in a cache entitles nobody')
})

// --- the two ways this model gets undone -----------------------------------

const src = new URL('../src', import.meta.url)

/** Every source file under src/, flattened. */
function sources(dir = src, prefix = 'src'): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${prefix}/${entry.name}`
    if (entry.isDirectory()) {
      out.push(...sources(new URL(`${dir.href}/${entry.name}`), path))
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push({ path, text: readFileSync(new URL(`${dir.href}/${entry.name}`), 'utf-8') })
    }
  }
  return out
}

// 1. The client may read this table and nothing else. The webhook writes it
//    with the service role, which bypasses RLS; the policy grants select alone.
//    A single `.upsert()` here would make the membership free to anybody who
//    can open a console, and it would look like an ordinary line of code.
test('nothing in the app writes the memberships table', (t) => {
  let read = 0
  for (const { path, text } of sources()) {
    if (!text.includes('memberships')) continue
    for (const call of text.match(/\.from\(\s*'memberships'\s*\)[\s\S]{0,120}/g) ?? []) {
      t.regex(call, /^\.from\(\s*'memberships'\s*\)\s*\.select\(/, `${path}: not a read`)
      read++
    }
    t.notRegex(
      text,
      /\.from\(\s*'memberships'\s*\)\s*\.(insert|update|upsert|delete)\b/,
      `${path}: writes entitlement from the client`,
    )
  }
  t.is(read, 1, 'entitlement should be read in exactly one place, the store')
})

const migration = readFileSync(
  new URL('../supabase/migrations/20260817090000_memberships.sql', import.meta.url),
  'utf-8',
)
// Comments out, so a note explaining why there is no insert policy cannot read
// as an insert policy.
const sql = migration.replace(/^\s*--.*$/gm, ' ')

test('the memberships table is readable by its owner and writable by nobody', (t) => {
  t.regex(sql, /alter table public\.memberships enable row level security/i)

  const policies = sql.match(/create policy[\s\S]*?;/gi) ?? []
  t.is(policies.length, 1, 'exactly one policy, or entitlement is not what it says it is')
  const only = policies.join('')
  t.regex(only, /for select/i)
  t.regex(only, /auth\.uid\(\) = user_id/)
  // `with check` is the pre-image of a write. On a select-only policy it has no
  // business existing, and its arrival would mean a write policy arrived too.
  t.notRegex(only, /with check/i)
  t.notRegex(sql, /for (insert|update|delete|all)/i, 'a write policy has appeared')

  // Deleting the account takes the membership row with it, which is what keeps
  // delete_own_account() honest without it having to know Stripe exists.
  t.regex(sql, /references auth\.users on delete cascade/i)
})

// 2. Rule #8: we never charge later for something that shipped free. So a paid
//    kind has to say so in the same commit that registers it, and the way that
//    goes wrong is not a decision anybody makes, it is a kind added without the
//    flag. This is the check that catches it.
test('the free kind is free and stays free', (t) => {
  const free = DRILL_KINDS.find((kind) => kind.id === 'which-hand-wins')
  t.truthy(free, 'the free kind has been unregistered')
  t.falsy(free?.membersOnly, '"which hand wins" is free forever by ruling (technology#38)')
  t.true(canPlayDrill(free as DrillKind, false))
})

test('a kind is free or it is the membership’s, and the room and the screen agree', (t) => {
  const paid: DrillKind = { ...(DRILL_KINDS[0] as DrillKind), id: 'x' as never, membersOnly: true }
  t.false(canPlayDrill(paid, false), 'a stranger can open a paid kind')
  t.true(canPlayDrill(paid, true))
  // And the free case, both ways round: being a member never takes anything away.
  for (const kind of DRILL_KINDS) {
    t.true(canPlayDrill(kind, true), `${kind.id}: a member is refused`)
    t.is(canPlayDrill(kind, false), !kind.membersOnly, `${kind.id}`)
  }
})
