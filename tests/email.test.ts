import { readFileSync } from 'node:fs'
import test from 'ava'
import { dailyNumber as appDailyNumber } from '@/lib/daily'
// The pure half of the email Edge Functions. Deno imports it as `email.ts`;
// here it is imported without the extension, which tsx resolves the same way.
import {
  DIGEST_HOUR_UTC,
  type Facts,
  type PrefsRow,
  REMINDER_HOUR_UTC,
  addDays,
  dailyNumber,
  dueKind,
  listUnsubscribeHeaders,
  liveStreak,
  parseToken,
  readFacts,
  readStreak,
  render,
  sameSecret,
  snapshotOf,
  streakAtRisk,
  weekOf,
} from '../supabase/functions/_shared/email'

const TOKEN = '3f2b8c1e-9d4a-4e6b-8a7c-1d2e3f4a5b6c'
/** Wednesday 7 October 2026. */
const WED = '2026-10-07'
/** Monday 12 October 2026. */
const MON = '2026-10-12'
const at = (day: string, hour: number) => new Date(`${day}T${String(hour).padStart(2, '0')}:05:00Z`)

const row = (over: Partial<PrefsRow> = {}): PrefsRow => ({
  user_id: 'u1',
  weekly_digest: true,
  daily_reminder: true,
  unsubscribe_token: TOKEN,
  created_at: '2026-09-01T00:00:00Z',
  last_sent_welcome: '2026-09-01T01:00:00Z',
  last_sent_reminder: null,
  last_sent_digest: null,
  digest_snapshot: null,
  ...over,
})

const facts = (over: Partial<Facts> = {}): Facts => ({
  roll: 12_400,
  lastPlayed: null,
  streak: { current: 3, best: 3 },
  counters: { hands: 500, tournaments: 40, wins: 6 },
  ...over,
})

// --- dates ---------------------------------------------------------------

test('the Daily number matches the app’s, so an email never names the wrong deal', (t) => {
  for (const day of ['2026-07-16', '2026-07-17', WED, '2027-01-01', '2028-02-29']) {
    t.is(dailyNumber(day), appDailyNumber(day), day)
  }
  t.is(dailyNumber('2026-07-16'), 1)
})

test('addDays crosses months and years', (t) => {
  t.is(addDays('2026-10-01', -1), '2026-09-30')
  t.is(addDays('2026-12-31', 1), '2027-01-01')
})

// --- reading the profile -------------------------------------------------

test('readFacts takes what the profile holds and nothing it does not', (t) => {
  const f = readFacts({
    roll: 9_000,
    streak: { current: 4, best: 9, lastDate: '2026-10-06' },
    stats: { handsPlayed: 10, tournamentsEntered: 2, tournamentsWon: 1, handsWon: 4 },
  })
  t.deepEqual(f, {
    roll: 9_000,
    lastPlayed: '2026-10-06',
    streak: { current: 4, best: 9 },
    counters: { hands: 10, tournaments: 2, wins: 1 },
  })
})

test('readFacts never throws on a strange blob', (t) => {
  for (const state of [null, undefined, 3, 'x', [], { roll: 'lots' }, { daily: { date: 7 } }]) {
    const f = readFacts(state)
    t.is(f.roll, null)
    t.is(f.lastPlayed, null)
  }
  t.is(readFacts({ stats: { handsPlayed: 1 } }).counters, null, 'half the counters is none')
  t.is(readFacts({ roll: -5 }).roll, null)
})

test("readStreak reads the profile's streak", (t) => {
  t.deepEqual(readStreak({ streak: { current: 4, best: 9, lastDate: WED } }), {
    current: 4,
    best: 9,
  })
  t.deepEqual(readStreak({ streak: { current: 3 } }), { current: 3, best: null })
})

test('no streak in the profile means no streak, never a guessed one', (t) => {
  t.is(readStreak({}), null)
  t.is(readStreak({ streak: { lastDate: WED } }), null)
  t.is(readStreak({ streak: 'long' }), null)
  t.is(readStreak(null), null)
})

test('a streak is only said while it is alive', (t) => {
  const s = { current: 5, best: 5 }
  t.is(liveStreak(facts({ streak: s, lastPlayed: WED }), WED), 5)
  t.is(liveStreak(facts({ streak: s, lastPlayed: '2026-10-06' }), WED), 5)
  t.is(liveStreak(facts({ streak: s, lastPlayed: '2026-10-05' }), WED), null, 'already broken')
  t.is(liveStreak(facts({ streak: { current: 0, best: 3 }, lastPlayed: WED }), WED), null)
})

// --- who is due what -----------------------------------------------------

test('at risk means a hand yesterday and none yet today', (t) => {
  t.true(streakAtRisk(facts({ lastPlayed: '2026-10-06' }), WED))
  t.false(streakAtRisk(facts({ lastPlayed: WED }), WED), 'already played today')
  t.false(streakAtRisk(facts({ lastPlayed: '2026-10-05' }), WED), 'missed yesterday')
  t.false(streakAtRisk(facts({ lastPlayed: null }), WED), 'never played')
  t.false(streakAtRisk(facts({ lastPlayed: '2026-10-06', streak: null }), WED), 'no streak')
})

test('the reminder goes once, from the evening, to someone who asked', (t) => {
  const f = facts({ lastPlayed: '2026-10-06' })
  t.is(dueKind(row(), f, at(WED, REMINDER_HOUR_UTC)), 'reminder')
  t.is(dueKind(row(), f, at(WED, REMINDER_HOUR_UTC - 1)), null, 'too early')
  t.is(dueKind(row({ daily_reminder: false }), f, at(WED, 20)), null, 'not asked for')
  t.is(
    dueKind(row({ last_sent_reminder: `${WED}T18:05:00Z` }), f, at(WED, 19)),
    null,
    'already sent today',
  )
  t.is(
    dueKind(row({ last_sent_reminder: '2026-10-06T18:05:00Z' }), f, at(WED, 19)),
    'reminder',
    'yesterday’s send does not count',
  )
  t.is(dueKind(row(), facts({ lastPlayed: WED }), at(WED, 20)), null, 'played today')
})

test('the summary goes on Monday from the morning, once', (t) => {
  t.is(dueKind(row(), facts(), at(MON, DIGEST_HOUR_UTC)), 'digest')
  t.is(dueKind(row(), facts(), at(MON, DIGEST_HOUR_UTC - 1)), null)
  t.is(dueKind(row(), facts(), at(WED, 12)), null, 'not Monday')
  t.is(dueKind(row({ weekly_digest: false }), facts(), at(MON, 12)), null)
  t.is(dueKind(row({ last_sent_digest: `${MON}T09:05:00Z` }), facts(), at(MON, 12)), null)
})

test('one email a day at most, whatever the kinds', (t) => {
  const f = facts({ lastPlayed: '2026-10-11' })
  // Monday morning sent the summary; Monday evening's reminder waits.
  t.is(dueKind(row({ last_sent_digest: `${MON}T09:05:00Z` }), f, at(MON, 19)), null)
  // A welcome today holds everything else until tomorrow.
  t.is(
    dueKind(
      row({ created_at: `${MON}T08:00:00Z`, last_sent_welcome: `${MON}T08:05:00Z` }),
      f,
      at(MON, 19),
    ),
    null,
  )
})

test('a welcome follows a fresh opt-in, and only a fresh one', (t) => {
  const fresh = row({ created_at: `${WED}T10:00:00Z`, last_sent_welcome: null })
  t.is(dueKind(fresh, null, at(WED, 11)), 'welcome', 'no profile is fine for a welcome')
  t.is(dueKind({ ...fresh, created_at: '2026-09-01T00:00:00Z' }, null, at(WED, 11)), null)
  t.is(
    dueKind({ ...fresh, weekly_digest: false, daily_reminder: false }, null, at(WED, 11)),
    null,
    'both switches off',
  )
})

test('no synced profile, nothing to say', (t) => {
  t.is(dueKind(row(), null, at(MON, 12)), null)
  t.is(dueKind(row(), null, at(WED, 20)), null)
})

// --- the weekly numbers --------------------------------------------------

test('the week is the difference from the last snapshot', (t) => {
  const then = new Date('2026-10-05T09:05:00Z')
  const snap = snapshotOf(facts({ roll: 10_000 }), then)
  const now = facts({ roll: 12_400, counters: { hands: 640, tournaments: 46, wins: 8 } })
  t.deepEqual(weekOf(now, snap, at(MON, 9)), {
    label: 'This week',
    played: { hands: 140, tournaments: 6, wins: 2 },
    rollChange: 2_400,
  })
})

test('a reset in between drops the counts rather than reporting negatives', (t) => {
  const snap = snapshotOf(facts(), new Date('2026-10-05T09:05:00Z'))
  const week = weekOf(
    facts({ roll: 1_000, counters: { hands: 3, tournaments: 0, wins: 0 } }),
    snap,
    at(MON, 9),
  )
  t.is(week?.played, null)
  t.is(week?.rollChange, 1_000 - 12_400)
})

test('no snapshot, no week', (t) => {
  t.is(weekOf(facts(), null, at(MON, 9)), null)
  t.is(weekOf(facts(), { at: 'never' }, at(MON, 9)), null)
})

test('an older snapshot is labelled with its date', (t) => {
  const snap = snapshotOf(facts(), new Date('2026-09-21T09:05:00Z'))
  t.is(weekOf(facts(), snap, at(MON, 9))?.label, 'Since 21 September')
})

// --- rendering -----------------------------------------------------------

const prefs = { weekly_digest: true, daily_reminder: true, digest_snapshot: null }
const unsubscribeUrl = `https://playpip.io/unsubscribe?token=${TOKEN}`

test('the reminder names today’s Daily and links to the Daily', (t) => {
  const email = render({
    kind: 'reminder',
    now: at(WED, 18),
    facts: facts({ lastPlayed: '2026-10-06', streak: { current: 5, best: 5 } }),
    prefs,
    unsubscribeUrl,
  })
  t.is(email.subject, 'Your 5-day streak ends at midnight UTC')
  t.regex(email.text, /Your streak is 5 days\./)
  t.regex(email.html, /href="https:\/\/playpip\.io\/play\/daily"/)
  t.true(email.text.includes(unsubscribeUrl))
  t.true(email.html.includes(unsubscribeUrl))
})

test('the summary says only what it can read', (t) => {
  const first = render({ kind: 'digest', now: at(MON, 9), facts: facts(), prefs, unsubscribeUrl })
  t.regex(first.text, /Your Roll: 12,400 chips\./)
  t.notRegex(first.text, /This week/, 'no snapshot, so no weekly numbers')
  t.notRegex(first.text, /streak/i)
  t.regex(first.text, new RegExp(`Today's Daily is #${appDailyNumber(MON)}\\.`))

  const later = render({
    kind: 'digest',
    now: at(MON, 9),
    facts: facts({
      roll: 12_400,
      counters: { hands: 501, tournaments: 41, wins: 6 },
      lastPlayed: MON,
      streak: { current: 3, best: 7 },
    }),
    prefs: {
      ...prefs,
      digest_snapshot: snapshotOf(facts({ roll: 12_500 }), new Date('2026-10-05T09:05:00Z')),
    },
    unsubscribeUrl,
  })
  t.regex(later.text, /This week: 1 hand, 1 tournament, 0 wins\./)
  t.regex(later.text, /Your Roll went down 100 chips\./)
  t.regex(later.text, /Streak: 3 days\./)
})

test('no currency symbol ever sits next to a chip count', (t) => {
  const email = render({ kind: 'digest', now: at(MON, 9), facts: facts(), prefs, unsubscribeUrl })
  t.notRegex(email.text, /[$£€¥]/)
  t.notRegex(email.html, /[$£€¥]/)
})

test('the welcome lists only what was turned on', (t) => {
  const one = render({
    kind: 'welcome',
    now: at(WED, 10),
    facts: null,
    prefs: { ...prefs, weekly_digest: false },
    unsubscribeUrl,
  })
  t.regex(one.text, /A reminder at 18:00 UTC/)
  t.notRegex(one.text, /summary/)
})

test('every email is dark, has a plain-text twin, and says how to stop it', (t) => {
  for (const kind of ['welcome', 'reminder', 'digest'] as const) {
    const email = render({
      kind,
      now: at(MON, 19),
      facts: facts({ lastPlayed: '2026-10-11' }),
      prefs,
      unsubscribeUrl,
    })
    t.regex(email.html, /<meta name="color-scheme" content="dark">/, kind)
    t.regex(email.text, /Unsubscribe: https:\/\/playpip\.io\/unsubscribe\?token=/, kind)
    t.notRegex(email.text, /<[a-z]/i, `${kind}: HTML in the plain text`)
    t.true(email.subject.length > 0 && email.subject.length < 60, kind)
  }
})

// --- unsubscribe ---------------------------------------------------------

test('one-click unsubscribe headers follow RFC 8058', (t) => {
  const h = listUnsubscribeHeaders('https://x.supabase.co/functions/v1/unsubscribe', TOKEN)
  t.is(h['List-Unsubscribe'], `<https://x.supabase.co/functions/v1/unsubscribe?token=${TOKEN}>`)
  t.is(h['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
})

test('only a uuid is a token', (t) => {
  t.is(parseToken(TOKEN.toUpperCase()), TOKEN)
  t.is(parseToken(` ${TOKEN} `), TOKEN)
  for (const bad of [null, undefined, '', 'abc', `${TOKEN}x`, "' or 1=1 --"]) {
    t.is(parseToken(bad), null, String(bad))
  }
})

test('the cron secret must match exactly', (t) => {
  t.true(sameSecret('s3cret-value', 's3cret-value'))
  t.false(sameSecret('s3cret-valu', 's3cret-value'))
  t.false(sameSecret('s3cret-valuex', 's3cret-value'))
  t.false(sameSecret('', 's3cret-value'))
  t.false(sameSecret(null, 's3cret-value'))
  t.false(sameSecret('anything', ''))
})

// --- the plumbing, read as source ----------------------------------------
//
// The functions are Deno and cannot run here. What can be checked is the
// handful of lines whose absence would make them unsafe.

const code = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

test('send-emails refuses anyone without the cron secret', (t) => {
  const send = code('supabase/functions/send-emails/index.ts')
  const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf-8')
  t.regex(config, /\[functions\.send-emails\]\s*verify_jwt = false/)
  t.regex(config, /\[functions\.unsubscribe\]\s*verify_jwt = false/)
  const check = send.indexOf("sameSecret(req.headers.get('x-cron-secret'), CRON_SECRET)")
  t.true(check > 0, 'the secret is not checked')
  t.true(check < send.indexOf('await optedIn()'), 'something is read before the secret is checked')
})

test('send-emails claims the day before it sends, and only sends what it claimed', (t) => {
  const send = code('supabase/functions/send-emails/index.ts')
  const claimAt = send.indexOf('await claim(')
  const sendAt = send.indexOf('await sendBatch(')
  t.true(claimAt > 0 && sendAt > claimAt)
  t.regex(send, /batch\.filter\(\(d\) => claimed\.has\(d\.row\.user_id\)\)/)
  t.regex(send, /'Idempotency-Key': key/)
  t.regex(send, /headers: listUnsubscribeHeaders\(/, 'an email without one-click unsubscribe')
})

test('unsubscribe can only switch email off', (t) => {
  const unsub = code('supabase/functions/unsubscribe/index.ts')
  t.regex(unsub, /\.update\(\{ weekly_digest: false, daily_reminder: false \}\)/)
  t.notRegex(unsub, /: true/, 'something in unsubscribe turns a switch on')
  t.regex(unsub, /\.eq\('unsubscribe_token', token\)/)
})

// --- the table -----------------------------------------------------------

test('email_prefs: own row only, switches only, gone with the account', (t) => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20261007090000_email_prefs.sql', import.meta.url),
    'utf-8',
  ).replace(/^\s*--.*$/gm, ' ')
  t.regex(sql, /user_id\s+uuid primary key references auth\.users on delete cascade/)
  t.regex(sql, /alter table public\.email_prefs enable row level security/)
  t.regex(sql, /weekly_digest\s+boolean not null default false/, 'opt-in means off by default')
  t.regex(sql, /daily_reminder\s+boolean not null default false/, 'opt-in means off by default')
  // A player who could write their own last_sent_* could be emailed twice;
  // one who could write the snapshot could make the summary say anything.
  t.regex(sql, /revoke insert, update, delete on public\.email_prefs from authenticated/)
  t.regex(
    sql,
    /grant update \(user_id, weekly_digest, daily_reminder\) on public\.email_prefs to authenticated/,
  )
  t.regex(
    sql,
    /grant insert \(user_id, weekly_digest, daily_reminder\) on public\.email_prefs to authenticated/,
  )
  t.regex(sql, /revoke all on public\.email_prefs from anon/)
})
