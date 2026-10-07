// The pure half of Pip's email: who is due what, and what it says.
//
// **No Deno, no npm, no network in this file.** It is imported by the
// `send-emails` and `unsubscribe` Edge Functions (Deno) and by
// tests/email.test.ts (Node, AVA via tsx), so it may only use what both
// runtimes have. Anything that touches the database, the clock or Resend lives
// in the functions themselves. See docs/email.md.
//
// The rules the code keeps:
//
//   * Opt-in only. A row in `email_prefs` with a switch on is the only reason
//     anybody gets anything.
//   * At most one email per player per UTC day, whatever the kinds.
//   * Never invent a number. Every figure in an email is read from the synced
//     profile, or from the snapshot the last email stored. When a figure cannot
//     be read, the line that would hold it is left out.

export const SITE_URL = 'https://playpip.io'
export const PLAY_URL = `${SITE_URL}/play/daily`
/** The domain verified in Resend is the `mail.` subdomain; replies go to the inbox on the root. */
export const FROM = 'Pip <hello@mail.playpip.io>'
export const REPLY_TO = 'hello@playpip.io'

/** The Daily reminder goes out from this hour (UTC), six hours before it closes. */
export const REMINDER_HOUR_UTC = 18
/** The weekly summary goes out on Mondays from this hour (UTC). */
export const DIGEST_HOUR_UTC = 9
/** `Date.getUTCDay()` for Monday. */
export const DIGEST_WEEKDAY = 1
/** A welcome is only sent for rows created this recently, so an old row never gets one. */
export const WELCOME_WINDOW_MS = 2 * 86_400_000

const DAY_MS = 86_400_000
/** Daily #1 was 16 July 2026 (UTC). Must match DAILY_EPOCH_UTC in src/lib/daily.ts. */
const DAILY_EPOCH_UTC = Date.UTC(2026, 6, 16)

// --- dates ---------------------------------------------------------------

/** The UTC day key, e.g. "2026-10-07". */
export function dayKey(at: Date): string {
  return at.toISOString().slice(0, 10)
}

/** The day key `days` after (or before, when negative) `key`. */
export function addDays(key: string, days: number): string {
  return dayKey(new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS))
}

/** Which Daily a day key is. Same sum as `dailyNumber` in src/lib/daily.ts. */
export function dailyNumber(key: string): number {
  return Math.floor((Date.parse(`${key}T00:00:00Z`) - DAILY_EPOCH_UTC) / DAY_MS) + 1
}

/** The day key of a stored timestamp, or null. */
function sentOn(at: string | null | undefined): string | null {
  if (!at) return null
  const t = Date.parse(at)
  return Number.isNaN(t) ? null : dayKey(new Date(t))
}

// --- reading the synced profile ------------------------------------------

/** The streak (days in a row with a hand played), as far as the profile says one. */
export interface Streak {
  current: number
  best: number | null
}

/** Lifetime counters from `state.stats`. */
export interface Counters {
  hands: number
  tournaments: number
  wins: number
}

/** What an email may say about a player. Every field is optional on purpose. */
export interface Facts {
  roll: number | null
  /** UTC day key of the last day they played a hand (`state.streak.lastDate`). */
  lastPlayed: string | null
  streak: Streak | null
  counters: Counters | null
}

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const count = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null

/** The streak, from `state.streak` (`src/lib/streak.ts`). Null means no streak line. */
export function readStreak(state: unknown): Streak | null {
  if (!isObj(state) || !isObj(state.streak)) return null
  const current = count(state.streak.current)
  if (current === null) return null
  return { current, best: count(state.streak.best) }
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** Everything an email may use, from a `profiles.state` blob. Never throws. */
export function readFacts(state: unknown): Facts {
  if (!isObj(state)) return { roll: null, lastPlayed: null, streak: null, counters: null }
  const last = isObj(state.streak) ? state.streak.lastDate : null
  const lastPlayed = typeof last === 'string' && DAY_KEY.test(last) ? last : null
  const stats = isObj(state.stats) ? state.stats : null
  const hands = stats ? count(stats.handsPlayed) : null
  const tournaments = stats ? count(stats.tournamentsEntered) : null
  const wins = stats ? count(stats.tournamentsWon) : null
  return {
    roll: count(state.roll),
    lastPlayed,
    streak: readStreak(state),
    counters:
      hands !== null && tournaments !== null && wins !== null ? { hands, tournaments, wins } : null,
  }
}

/**
 * The streak only if it is still alive on `today`: the last hand was today or
 * yesterday. A streak stored on a profile nobody has opened for a week is a
 * number from the past, and saying it would be saying something untrue.
 */
export function liveStreak(facts: Facts, today: string): number | null {
  if (!facts.streak || facts.streak.current < 1 || !facts.lastPlayed) return null
  if (facts.lastPlayed !== today && facts.lastPlayed !== addDays(today, -1)) return null
  return facts.streak.current
}

// --- who is due what -----------------------------------------------------

export type Kind = 'welcome' | 'reminder' | 'digest'

/** The `email_prefs` columns the sender reads. */
export interface PrefsRow {
  user_id: string
  weekly_digest: boolean
  daily_reminder: boolean
  unsubscribe_token: string
  created_at: string
  last_sent_welcome: string | null
  last_sent_reminder: string | null
  last_sent_digest: string | null
  digest_snapshot: unknown
}

/** The column that records when each kind was last sent. */
export const SENT_COLUMN = {
  welcome: 'last_sent_welcome',
  reminder: 'last_sent_reminder',
  digest: 'last_sent_digest',
} as const satisfies Record<Kind, keyof PrefsRow>

/** Played a hand yesterday and none yet today: the streak ends at midnight UTC. */
export function streakAtRisk(facts: Facts, today: string): boolean {
  return facts.lastPlayed === addDays(today, -1) && (facts.streak?.current ?? 0) > 0
}

/**
 * What, if anything, this player is due at `now`. Null for nothing.
 *
 * `facts` is null when the player has no synced profile, which rules out the
 * reminder and the summary (there is nothing true to say) but not the welcome.
 * One email per UTC day at most: anything already sent today ends the question.
 */
export function dueKind(row: PrefsRow, facts: Facts | null, now: Date): Kind | null {
  if (!row.weekly_digest && !row.daily_reminder) return null
  const today = dayKey(now)
  const sentToday = [row.last_sent_welcome, row.last_sent_reminder, row.last_sent_digest].some(
    (at) => sentOn(at) === today,
  )
  if (sentToday) return null

  const created = Date.parse(row.created_at)
  if (
    !row.last_sent_welcome &&
    !Number.isNaN(created) &&
    now.getTime() - created < WELCOME_WINDOW_MS
  ) {
    return 'welcome'
  }
  if (!facts) return null

  if (row.daily_reminder && now.getUTCHours() >= REMINDER_HOUR_UTC && streakAtRisk(facts, today)) {
    return 'reminder'
  }
  if (
    row.weekly_digest &&
    now.getUTCDay() === DIGEST_WEEKDAY &&
    now.getUTCHours() >= DIGEST_HOUR_UTC
  ) {
    return 'digest'
  }
  return null
}

// --- the weekly numbers --------------------------------------------------

/** What the last summary (or welcome) saw, stored so the next one can subtract. */
export interface Snapshot {
  at: string
  roll: number | null
  counters: Counters | null
}

export function snapshotOf(facts: Facts, now: Date): Snapshot {
  return { at: now.toISOString(), roll: facts.roll, counters: facts.counters }
}

function readSnapshot(raw: unknown): Snapshot | null {
  if (!isObj(raw) || typeof raw.at !== 'string' || Number.isNaN(Date.parse(raw.at))) return null
  const c = isObj(raw.counters) ? raw.counters : null
  const hands = c ? count(c.hands) : null
  const tournaments = c ? count(c.tournaments) : null
  const wins = c ? count(c.wins) : null
  return {
    at: raw.at,
    roll: count(raw.roll),
    counters:
      hands !== null && tournaments !== null && wins !== null ? { hands, tournaments, wins } : null,
  }
}

/** Played since the snapshot, and the Roll's change. Each part null when unknown. */
export interface Week {
  /** "This week" or "Since 7 October". */
  label: string
  played: Counters | null
  rollChange: number | null
}

/**
 * The difference between now and the stored snapshot, or null when there is
 * no snapshot to subtract from.
 *
 * A counter that went down means the profile was reset in between, and a
 * difference across a reset is not a number of anything, so the played line
 * goes. The Roll moves both ways and is kept either way.
 */
export function weekOf(facts: Facts, rawSnapshot: unknown, now: Date): Week | null {
  const snap = readSnapshot(rawSnapshot)
  if (!snap) return null
  const age = now.getTime() - Date.parse(snap.at)
  const label =
    age <= 8 * DAY_MS
      ? 'This week'
      : `Since ${new Date(snap.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`

  let played: Counters | null = null
  if (facts.counters && snap.counters) {
    const hands = facts.counters.hands - snap.counters.hands
    const tournaments = facts.counters.tournaments - snap.counters.tournaments
    const wins = facts.counters.wins - snap.counters.wins
    if (hands >= 0 && tournaments >= 0 && wins >= 0) played = { hands, tournaments, wins }
  }
  const rollChange = facts.roll !== null && snap.roll !== null ? facts.roll - snap.roll : null
  return { label, played, rollChange }
}

// --- rendering -----------------------------------------------------------

export interface Rendered {
  subject: string
  html: string
  text: string
}

export interface RenderContext {
  kind: Kind
  now: Date
  facts: Facts | null
  /** The row's prefs, so the welcome can say what was turned on. */
  prefs: Pick<PrefsRow, 'weekly_digest' | 'daily_reminder' | 'digest_snapshot'>
  /** The page link in the footer (playpip.io/unsubscribe?token=…). */
  unsubscribeUrl: string
}

export function chips(n: number): string {
  return `${Math.round(n).toLocaleString('en-GB')} ${Math.abs(n) === 1 ? 'chip' : 'chips'}`
}

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** The body as data: short paragraphs, then one button. Rendered twice below. */
interface Body {
  subject: string
  heading: string
  lines: string[]
  button: { label: string; url: string } | null
  why: string
}

function reminderBody(ctx: RenderContext): Body {
  const today = dayKey(ctx.now)
  const no = dailyNumber(today)
  const streak = (ctx.facts ? liveStreak(ctx.facts, today) : null) ?? 1
  const lines = [
    `Your streak is ${plural(streak, 'day', 'days')}. Play one hand before midnight UTC to keep it.`,
    `Any table counts. Today's Daily, #${no}, is free.`,
  ]
  return {
    subject: `Your ${streak}-day streak ends at midnight UTC`,
    heading: `Keep your ${streak}-day streak`,
    lines,
    button: { label: `Play Daily #${no}`, url: PLAY_URL },
    why: 'You turned on streak reminders in Pip.',
  }
}

function digestBody(ctx: RenderContext): Body {
  const today = dayKey(ctx.now)
  const facts = ctx.facts
  const lines: string[] = []
  if (facts?.roll != null) lines.push(`Your Roll: ${chips(facts.roll)}.`)

  const week = facts ? weekOf(facts, ctx.prefs.digest_snapshot, ctx.now) : null
  if (week?.played) {
    const { hands, tournaments, wins } = week.played
    lines.push(
      hands === 0 && tournaments === 0
        ? `${week.label}: no hands played.`
        : `${week.label}: ${plural(hands, 'hand', 'hands')}, ${plural(tournaments, 'tournament', 'tournaments')}, ${plural(wins, 'win', 'wins')}.`,
    )
  }
  if (week && week.rollChange !== null) {
    const c = week.rollChange
    lines.push(
      c === 0
        ? 'Your Roll did not change.'
        : `Your Roll went ${c > 0 ? 'up' : 'down'} ${chips(Math.abs(c))}.`,
    )
  }
  const streak = facts ? liveStreak(facts, today) : null
  if (streak !== null) lines.push(`Streak: ${plural(streak, 'day', 'days')}.`)

  const no = dailyNumber(today)
  lines.push(`Today's Daily is #${no}.`)
  return {
    subject: 'Your week on Pip',
    heading: 'Your week on Pip',
    lines,
    button: { label: "Play today's Daily", url: PLAY_URL },
    why: 'You turned on the weekly summary in Pip.',
  }
}

function welcomeBody(ctx: RenderContext): Body {
  const lines = ['Email from Pip is on. You will get:']
  if (ctx.prefs.daily_reminder) {
    lines.push(`A reminder at ${REMINDER_HOUR_UTC}:00 UTC on a day your streak is about to end.`)
  }
  if (ctx.prefs.weekly_digest) {
    lines.push('A summary every Monday: your Roll, what you played that week, and your streak.')
  }
  lines.push(
    'At most one email a day. Turn either off in Settings → Manage account, or use the link below to stop all of them.',
  )
  return {
    subject: 'Email from Pip is on',
    heading: 'Email from Pip is on',
    lines,
    button: { label: 'Open Pip', url: PLAY_URL },
    why: 'You turned on email in Pip.',
  }
}

const BODIES: Record<Kind, (ctx: RenderContext) => Body> = {
  welcome: welcomeBody,
  reminder: reminderBody,
  digest: digestBody,
}

/** Subject, HTML and plain text for one email. Pure: same input, same bytes. */
export function render(ctx: RenderContext): Rendered {
  const body = BODIES[ctx.kind](ctx)
  return {
    subject: body.subject,
    html: toHtml(body, ctx.unsubscribeUrl),
    text: toText(body, ctx.unsubscribeUrl),
  }
}

function toText(body: Body, unsubscribeUrl: string): string {
  return [
    body.heading,
    '',
    ...body.lines.flatMap((line) => [line, '']),
    ...(body.button ? [`${body.button.label}: ${body.button.url}`, ''] : []),
    '--',
    body.why,
    `Unsubscribe: ${unsubscribeUrl}`,
    'Or turn it off in Pip, under Settings → Manage account.',
    '',
  ].join('\n')
}

// Inline styles only: mail clients drop <style> blocks unpredictably. Black and
// grey, like the app, with `color-scheme: dark` so clients that would invert a
// light email leave this one alone.
const BG = '#0a0a0a'
const FG = '#ededed'
const MUTED = '#a1a1a1'
const BUTTON_BG = '#ededed'
const BUTTON_FG = '#171717'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

function toHtml(body: Body, unsubscribeUrl: string): string {
  const p = (text: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${FG};">${escapeHtml(text)}</p>`
  const button = body.button
    ? `<p style="margin:24px 0 32px;"><a href="${escapeHtml(body.button.url)}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:${BUTTON_BG};color:${BUTTON_FG};font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(body.button.label)}</a></p>`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(body.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};color:${FG};font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td>
<p style="margin:0 0 24px;font-size:18px;font-weight:600;letter-spacing:-0.01em;color:${FG};">pip</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600;color:${FG};">${escapeHtml(body.heading)}</h1>
${body.lines.map(p).join('\n')}
${button}
<p style="margin:0;font-size:13px;line-height:1.5;color:${MUTED};">${escapeHtml(body.why)} <a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>, or turn it off in Pip under Settings → Manage account.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

// --- unsubscribe ---------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A well-formed unsubscribe token, lower-cased, or null. */
export function parseToken(raw: string | null | undefined): string | null {
  const t = raw?.trim() ?? ''
  return UUID.test(t) ? t.toLowerCase() : null
}

/** The page link in the email body. A static page on the site, with a button. */
export function unsubscribePageUrl(token: string): string {
  return `${SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`
}

/**
 * RFC 8058 one-click unsubscribe. Mail providers POST
 * `List-Unsubscribe=One-Click` to the URL in angle brackets, with no cookies
 * and no page, so it points straight at the Edge Function.
 */
export function listUnsubscribeHeaders(functionUrl: string, token: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${functionUrl}?token=${encodeURIComponent(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

/** Compare a presented secret with the expected one without an early exit. */
export function sameSecret(presented: string | null | undefined, expected: string): boolean {
  if (!presented || !expected) return false
  let diff = presented.length ^ expected.length
  for (let i = 0; i < expected.length; i++) {
    diff |= (presented.charCodeAt(i % (presented.length || 1)) ?? 0) ^ expected.charCodeAt(i)
  }
  return diff === 0
}
