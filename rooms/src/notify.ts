// Sending a slow game's notices: web push, the iOS app's push (through Expo),
// and the turn email (through Resend).
//
// What is sent and when is decided in `src/lib/multiplayer/notices.ts`; this
// file only delivers it. Every sender reports devices that are gone for good,
// so the player's index can forget them.

import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push'
import { timeLeft, opponents, type SlowCard } from '@/lib/multiplayer/slowCard'
import { deviceId, type PushDevice } from '@/lib/multiplayer/notices'
import type { Env } from './env'

export interface PushMessage {
  title: string
  body: string
  /** Opened when the notification is tapped: a path on the site. */
  url: string
  /** One notification per game: a newer one replaces it. */
  tag: string
}

/** Push to every device. Returns the ids of devices that no longer exist. */
export async function pushAll(
  env: Env,
  devices: readonly PushDevice[],
  msg: PushMessage,
): Promise<string[]> {
  const gone: string[] = []
  await Promise.all(
    devices.map(async (d) => {
      try {
        const dead = d.kind === 'web' ? await pushWeb(env, d, msg) : await pushExpo(d, msg)
        if (dead) gone.push(deviceId(d))
      } catch (e) {
        console.error('push failed', { kind: d.kind, error: String(e) })
      }
    }),
  )
  return gone
}

/** True when the browser's subscription has gone (404 or 410). */
async function pushWeb(
  env: Env,
  d: Extract<PushDevice, { kind: 'web' }>,
  msg: PushMessage,
): Promise<boolean> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false
  const subscription: PushSubscription = {
    endpoint: d.endpoint,
    expirationTime: null,
    keys: d.keys,
  }
  const payload = await buildPushPayload(
    {
      data: JSON.stringify(msg),
      options: { ttl: 24 * 60 * 60, urgency: 'normal', topic: topicOf(msg.tag) },
    },
    subscription,
    {
      subject: 'mailto:hello@playpip.io',
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    },
  )
  const res = await fetch(d.endpoint, payload)
  return res.status === 404 || res.status === 410
}

/** A push service's topic is at most 32 URL-safe characters. */
function topicOf(tag: string): string {
  return tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
}

/** True when Expo says the app was uninstalled or the token is no good. */
async function pushExpo(
  d: Extract<PushDevice, { kind: 'expo' }>,
  msg: PushMessage,
): Promise<boolean> {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      to: d.token,
      title: msg.title,
      body: msg.body,
      sound: 'default',
      data: { url: msg.url },
      // iOS groups a game's notifications together.
      threadId: msg.tag,
    }),
  })
  if (!res.ok) return false
  const body = (await res.json()) as { data?: { status?: string; details?: { error?: string } } }
  return body.data?.status === 'error' && body.data.details?.error === 'DeviceNotRegistered'
}

// --- email -------------------------------------------------------------------

const SITE = 'https://playpip.io'
const FROM = 'Pip <hello@mail.playpip.io>'
const REPLY_TO = 'hello@playpip.io'

/** The address on the account, read with the service role. */
export async function emailOf(env: Env, userId: string): Promise<string | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers: serviceHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
  })
  if (!res.ok) return null
  const user = (await res.json()) as { email?: unknown }
  return typeof user.email === 'string' ? user.email : null
}

/** A legacy service-role JWT goes as a bearer too; a `sb_secret_` key only as the apikey. */
export function serviceHeaders(key: string): Record<string, string> {
  return key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key }
}

/** The account's synced profile (`profiles.state`), read with the service role. */
export async function profileStateOf(env: Env, userId: string): Promise<unknown> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=state`,
    { headers: serviceHeaders(env.SUPABASE_SERVICE_ROLE_KEY) },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as { state?: unknown }[]
  return rows[0]?.state ?? null
}

export function gameUrl(code: string): string {
  return `/game/room?code=${code}`
}

/** The turn email: every game waiting on you, one line each. */
export function turnEmail(
  games: readonly SlowCard[],
  now: number,
  offUrl: string,
): { subject: string; html: string; text: string } {
  const first = games[0]
  const subject =
    games.length === 1 ? `Your move vs ${opponents(first)}` : `Your move in ${games.length} games`
  const lines = games.map((g) => ({
    text: `${opponents(g)} · ${g.dueAt !== null ? `${timeLeft(g.dueAt - now)} left` : 'your move'}`,
    url: `${SITE}${gameUrl(g.code)}`,
  }))
  const button = { label: games.length === 1 ? 'Make your move' : 'Open Pip', url: lines[0].url }
  const text = [
    subject,
    '',
    ...lines.map((l) => `${l.text}: ${l.url}`),
    '',
    '--',
    `Stop these emails: ${offUrl}`,
    '',
  ].join('\n')
  const BG = '#0a0a0a'
  const FG = '#ededed'
  const MUTED = '#a1a1a1'
  const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
  const row = (l: { text: string; url: string }) =>
    `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;"><a href="${esc(l.url)}" style="color:${FG};text-decoration:none;">${esc(l.text)}</a></p>`
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};color:${FG};font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td>
<p style="margin:0 0 24px;font-size:18px;font-weight:600;letter-spacing:-0.01em;color:${FG};">pip</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600;color:${FG};">${esc(subject)}</h1>
${lines.map(row).join('\n')}
<p style="margin:24px 0 32px;"><a href="${esc(button.url)}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:${FG};color:#171717;font-size:15px;font-weight:600;text-decoration:none;">${esc(button.label)}</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:${MUTED};"><a href="${esc(offUrl)}" style="color:${MUTED};text-decoration:underline;">Stop these emails</a>, or turn them off in Pip under Settings.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
  return { subject, html, text }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendEmail(
  env: Env,
  to: string,
  mail: { subject: string; html: string; text: string },
  offUrl: string,
): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.log('email (no RESEND_API_KEY)', { to, subject: mail.subject })
    return true
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      reply_to: REPLY_TO,
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: {
        'List-Unsubscribe': `<${offUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  })
  if (!res.ok) console.error('resend refused', { status: res.status })
  return res.ok
}

// --- the off switch in every email --------------------------------------------

async function hmacKey(env: Env): Promise<CryptoKey | null> {
  const secret = env.NOTIFY_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return null
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`turn-email-off:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function b64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** A link that turns turn emails off for this account, signed so nobody can make one for another. */
export async function offLink(env: Env, userId: string): Promise<string> {
  const key = await hmacKey(env)
  const base = env.PUBLIC_URL ?? 'https://rooms.playpip.io'
  const sig = key
    ? b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId)))
    : ''
  return `${base}/notify/off?u=${encodeURIComponent(userId)}&s=${sig}`
}

export async function offLinkValid(env: Env, userId: string, sig: string): Promise<boolean> {
  const key = await hmacKey(env)
  if (!key || !sig) return false
  const expected = b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId)))
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}
