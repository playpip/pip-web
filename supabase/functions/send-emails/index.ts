// Send whatever opt-in email is due right now. Called hourly by pg_cron.
//
// POST with header `x-cron-secret: <CRON_SECRET>` → a JSON report of what was
// sent. Body `{ "dry": true }` reports who is due and sends nothing; a dry run
// may also pass `"now": "<ISO time>"` to ask "who would be due then".
//
// Deployed with JWT verification off (supabase/config.toml), because pg_cron
// holds no player's token. The shared secret is the lock instead: without it
// this endpoint would be a public "email every player" button.
//
// Who gets what is decided in ../_shared/email.ts, which is pure and tested
// (tests/email.test.ts). This file is only the plumbing around it:
//
//   1. read every `email_prefs` row with a switch on, and those players'
//      synced profiles;
//   2. ask `dueKind` what each one is due;
//   3. per kind, in batches of up to 100: **claim** the day by stamping
//      `last_sent_<kind>` where it is not already today's, send the claimed
//      ones through Resend's batch API, and put the stamps back if Resend
//      refuses. The claim is what makes a re-run, or two runs at once, send
//      nothing twice.
//
// Secrets (`supabase secrets set`, never committed): CRON_SECRET,
// RESEND_API_KEY, and optionally EMAIL_ALLOWLIST (comma-separated addresses;
// when set, nobody else is sent anything, which is how to test against the live
// project with one inbox). See docs/email.md.

import { admin, env, UNSUBSCRIBE_FUNCTION_URL } from '../_shared/service.ts'
import {
  FROM,
  SENT_COLUMN,
  dayKey,
  dueKind,
  type Facts,
  type Kind,
  listUnsubscribeHeaders,
  type PrefsRow,
  readFacts,
  render,
  sameSecret,
  snapshotOf,
  unsubscribePageUrl,
} from '../_shared/email.ts'

const CRON_SECRET = env('CRON_SECRET')
const RESEND_API_KEY = env('RESEND_API_KEY')
const ALLOWLIST = (() => {
  const raw = Deno.env.get('EMAIL_ALLOWLIST')?.trim()
  if (!raw) return null
  return new Set(
    raw
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean),
  )
})()

/** Resend's batch endpoint takes at most 100 emails a request. */
const BATCH = 100
const PAGE = 1000
const PROFILE_CHUNK = 100
const KINDS: Kind[] = ['welcome', 'reminder', 'digest']

const PREFS_COLUMNS =
  'user_id, weekly_digest, daily_reminder, unsubscribe_token, created_at, last_sent_welcome, last_sent_reminder, last_sent_digest, digest_snapshot'

interface Due {
  row: PrefsRow
  facts: Facts | null
  kind: Kind
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** `fn` over `items`, at most `limit` at a time, in order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/** Every row with at least one switch on. */
async function optedIn(): Promise<PrefsRow[]> {
  const rows: PrefsRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('email_prefs')
      .select(PREFS_COLUMNS)
      .or('weekly_digest.eq.true,daily_reminder.eq.true')
      .order('user_id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...((data ?? []) as PrefsRow[]))
    if (!data || data.length < PAGE) return rows
  }
}

/** What each player's synced profile says. A player with no profile is absent. */
async function factsFor(ids: string[]): Promise<Map<string, Facts>> {
  const out = new Map<string, Facts>()
  for (const chunk of chunks(ids, PROFILE_CHUNK)) {
    const { data, error } = await admin
      .from('profiles')
      .select('user_id, state')
      .in('user_id', chunk)
    if (error) throw error
    for (const row of data ?? []) out.set(row.user_id as string, readFacts(row.state))
  }
  return out
}

/** The account's email address, from Auth. Null for a deleted or address-less user. */
async function addressOf(userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user?.email) return null
  return data.user.email
}

/**
 * Stamp today's send on every row in `ids` that has not had this kind today,
 * and return the ids that were stamped. Only those are sent to.
 */
async function claim(kind: Kind, ids: string[], now: Date): Promise<Set<string>> {
  const column = SENT_COLUMN[kind]
  const { data, error } = await admin
    .from('email_prefs')
    .update({ [column]: now.toISOString() })
    .in('user_id', ids)
    .or(`${column}.is.null,${column}.lt.${dayKey(now)}`)
    .select('user_id')
  if (error) throw error
  return new Set((data ?? []).map((r) => r.user_id as string))
}

/** Undo a claim, for sends that did not happen. */
async function release(kind: Kind, rows: PrefsRow[]): Promise<void> {
  const column = SENT_COLUMN[kind]
  await mapLimit(rows, 10, async (row) => {
    const { error } = await admin
      .from('email_prefs')
      .update({ [column]: row[column] })
      .eq('user_id', row.user_id)
    if (error) console.error(`send-emails: releasing ${kind} for ${row.user_id} failed:`, error)
  })
}

async function idempotencyKey(kind: Kind, now: Date, ids: string[]): Promise<string> {
  const bytes = new TextEncoder().encode([...ids].sort().join(','))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const hex = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `pip-${kind}-${dayKey(now)}-${hex.slice(0, 32)}`
}

interface Message {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  headers: Record<string, string>
  tags: { name: string; value: string }[]
}

/** One request to Resend's batch API. True when Resend accepted all of it. */
async function sendBatch(messages: Message[], key: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify(messages),
  })
  if (res.ok) return true
  // The status and Resend's own words, never the addresses.
  console.error(`send-emails: Resend answered ${res.status}: ${(await res.text()).slice(0, 500)}`)
  return false
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!sameSecret(req.headers.get('x-cron-secret'), CRON_SECRET)) {
    return json({ error: 'forbidden' }, 401)
  }

  const body = (await req.json().catch(() => ({}))) as { dry?: unknown; now?: unknown }
  const dry = body.dry === true
  // A pretend clock only on a dry run. A real send at a pretend hour would
  // email the wrong people, and stamp the wrong day as done.
  const now =
    dry && typeof body.now === 'string' && !Number.isNaN(Date.parse(body.now))
      ? new Date(body.now)
      : new Date()

  let rows: PrefsRow[]
  let facts: Map<string, Facts>
  try {
    rows = await optedIn()
    facts = await factsFor(rows.map((r) => r.user_id))
  } catch (err) {
    console.error('send-emails: reading prefs or profiles failed:', err)
    return json({ error: 'read-failed' }, 500)
  }

  const due: Due[] = []
  for (const row of rows) {
    const f = facts.get(row.user_id) ?? null
    const kind = dueKind(row, f, now)
    if (kind) due.push({ row, facts: f, kind })
  }

  const dueCounts = Object.fromEntries(
    KINDS.map((k) => [k, due.filter((d) => d.kind === k).length]),
  )
  if (dry) {
    return json({
      dry: true,
      now: now.toISOString(),
      considered: rows.length,
      due: dueCounts,
      players: due.map((d) => ({ user_id: d.row.user_id, kind: d.kind })),
    })
  }

  const report = { considered: rows.length, due: dueCounts, sent: 0, skipped: 0, failed: 0 }

  for (const kind of KINDS) {
    for (const batch of chunks(
      due.filter((d) => d.kind === kind),
      BATCH,
    )) {
      let claimed: Set<string>
      try {
        claimed = await claim(
          kind,
          batch.map((d) => d.row.user_id),
          now,
        )
      } catch (err) {
        console.error(`send-emails: claiming ${kind} failed:`, err)
        report.failed += batch.length
        continue
      }

      const mine = batch.filter((d) => claimed.has(d.row.user_id))
      const addresses = await mapLimit(mine, 10, (d) => addressOf(d.row.user_id))

      const sending: Due[] = []
      const messages: Message[] = []
      const unsent: PrefsRow[] = []
      mine.forEach((d, i) => {
        const to = addresses[i]
        if (!to || (ALLOWLIST && !ALLOWLIST.has(to.toLowerCase()))) {
          unsent.push(d.row)
          return
        }
        const token = d.row.unsubscribe_token
        const email = render({
          kind,
          now,
          facts: d.facts,
          prefs: d.row,
          unsubscribeUrl: unsubscribePageUrl(token),
        })
        sending.push(d)
        messages.push({
          from: FROM,
          to: [to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: listUnsubscribeHeaders(UNSUBSCRIBE_FUNCTION_URL, token),
          tags: [{ name: 'kind', value: kind }],
        })
      })

      // Skipped players get their stamp back, so lifting the allowlist (or an
      // address arriving) lets them be sent to later the same day.
      if (unsent.length) await release(kind, unsent)
      report.skipped += unsent.length + (batch.length - mine.length)
      if (!messages.length) continue

      const key = await idempotencyKey(
        kind,
        now,
        sending.map((d) => d.row.user_id),
      )
      const ok = await sendBatch(messages, key).catch((err) => {
        console.error('send-emails: Resend request failed:', err)
        return false
      })
      if (!ok) {
        await release(
          kind,
          sending.map((d) => d.row),
        )
        report.failed += sending.length
        continue
      }
      report.sent += sending.length

      // The next summary subtracts from what this one (or the welcome) saw.
      if (kind !== 'reminder') {
        await mapLimit(
          sending.filter((d) => d.facts),
          10,
          async (d) => {
            const { error } = await admin
              .from('email_prefs')
              .update({ digest_snapshot: snapshotOf(d.facts as Facts, now) })
              .eq('user_id', d.row.user_id)
            if (error) console.error(`send-emails: snapshot for ${d.row.user_id} failed:`, error)
          },
        )
      }
    }
  }

  console.log(`send-emails: ${JSON.stringify(report)}`)
  return json(report)
})
