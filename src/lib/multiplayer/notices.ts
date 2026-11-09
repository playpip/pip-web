// When a slow game tells you it is your move, and how.
//
// Pure: the player's index (`rooms/src/player.ts`) holds the cards, the prefs
// and the devices, and asks these functions what is due. The rules:
//
// - **Push as soon as it is your move**, to every device you have allowed.
// - **Email if the move is still waiting** a quarter of the way through the
//   clock, or after a few minutes when you have no device to push to. One
//   email lists every game waiting on you, and there is at most one every
//   twelve hours.
// - **Nothing during your quiet hours.** Anything due then waits until they end.
// - **Nothing while you have the table open.**
// - A game ending is a push too, never an email.

import type { SlowCard } from './slowCard'
import { DEFAULT_QUIET, slowDeadline, validTimeZone, type Quiet } from './slow'

export interface PlayPrefs {
  tz: string
  quietFrom: number
  quietTo: number
  push: boolean
  email: boolean
  /** Push when it is your move in a slow game, or one ends. Under `push`, like the two below. */
  slow: boolean
  /** Push when somebody passes you on the Pip Rating board (`nudges.ts`). */
  rating: boolean
  /** Push when your streak is about to end, or has (`nudges.ts`). */
  streak: boolean
}

export const DEFAULT_PREFS: PlayPrefs = {
  tz: 'UTC',
  quietFrom: DEFAULT_QUIET.from,
  quietTo: DEFAULT_QUIET.to,
  push: true,
  email: true,
  slow: true,
  rating: true,
  streak: true,
}

/** With no device to push to, the email waits this long, in case they are on their way. */
export const EMAIL_ONLY_AFTER_MS = 5 * 60 * 1000
/**
 * A push waits this long, so a reply made straight away (both of you at the
 * table) never buzzes a phone, and a move made for you never does either.
 */
export const PUSH_AFTER_MS = 10_000
/** At most one turn email in this long. */
export const EMAIL_GAP_MS = 12 * 60 * 60 * 1000

export interface Notice {
  code: string
  /** The turn (`SlowCard.turnKey`), or `end` for the game finishing. */
  key: string
  pushAt: number | null
  emailAt: number | null
}

export function quietOf(prefs: PlayPrefs): Quiet {
  return { from: prefs.quietFrom, to: prefs.quietTo, tz: prefs.tz }
}

/** The first moment at or after `t` outside the quiet hours. */
export function awake(t: number, prefs: PlayPrefs): number {
  return slowDeadline(t, 0, quietOf(prefs))
}

/**
 * The notice a card calls for, given the one already waiting for this game.
 * Undefined when there is nothing to tell them.
 */
export function planNotice(
  prev: Notice | undefined,
  card: SlowCard,
  prefs: PlayPrefs,
  hasDevices: boolean,
  now: number,
): Notice | undefined {
  if (card.yourTurn && card.turnKey) {
    if (prev?.key === card.turnKey) return prev
    const pushing = prefs.push && prefs.slow && hasDevices
    const moveMs = card.moveHours * 60 * 60 * 1000
    return {
      code: card.code,
      key: card.turnKey,
      pushAt: pushing ? awake(now + PUSH_AFTER_MS, prefs) : null,
      emailAt: prefs.email
        ? awake(now + (pushing ? moveMs / 4 : EMAIL_ONLY_AFTER_MS), prefs)
        : null,
    }
  }
  if (card.phase === 'finished' && card.place !== null) {
    if (prev?.key === 'end') return prev
    return {
      code: card.code,
      key: 'end',
      pushAt: prefs.push && prefs.slow && hasDevices ? awake(now, prefs) : null,
      emailAt: null,
    }
  }
  return undefined
}

/** When the next of these notices is due, or null. */
export function nextDue(notices: readonly Notice[]): number | null {
  let next: number | null = null
  for (const n of notices) {
    for (const at of [n.pushAt, n.emailAt]) {
      if (at !== null && (next === null || at < next)) next = at
    }
  }
  return next
}

/**
 * When a turn email may go: now, unless one went in the last twelve hours, in
 * which case when that gap is up (and they are awake).
 */
export function emailSlot(now: number, lastEmailAt: number | null, prefs: PlayPrefs): number {
  if (lastEmailAt === null || now - lastEmailAt >= EMAIL_GAP_MS) return now
  return awake(lastEmailAt + EMAIL_GAP_MS, prefs)
}

/** A device a player allowed pushes on: a browser's subscription, or the app's Expo token. */
export type PushDevice =
  | { kind: 'web'; endpoint: string; keys: { p256dh: string; auth: string } }
  | { kind: 'expo'; token: string }

export function deviceId(d: PushDevice): string {
  return d.kind === 'web' ? d.endpoint : d.token
}

// --- reading what a client sends -----------------------------------------------

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isMinute = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 24 * 60
const b64url = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max && /^[A-Za-z0-9_-]+=*$/.test(v)

/** Settings → Notifications, as sent. Null unless every field is right. */
export function parsePrefs(v: unknown): PlayPrefs | null {
  if (!isObj(v)) return null
  if (!validTimeZone(v.tz) || !isMinute(v.quietFrom) || !isMinute(v.quietTo)) return null
  if (typeof v.push !== 'boolean' || typeof v.email !== 'boolean') return null
  // A page from before 2026-11-09 sends none of these: on, as for everybody.
  const on = (x: unknown) => (typeof x === 'boolean' ? x : true)
  return {
    tz: v.tz,
    quietFrom: v.quietFrom,
    quietTo: v.quietTo,
    push: v.push,
    email: v.email,
    slow: on(v.slow),
    rating: on(v.rating),
    streak: on(v.streak),
  }
}

/**
 * A device to push to. A browser's endpoint must be an https URL (the push
 * service's), and an app's token must look like Expo's.
 */
export function parseDevice(v: unknown): PushDevice | null {
  if (!isObj(v)) return null
  if (v.kind === 'expo') {
    return typeof v.token === 'string' &&
      /^ExponentPushToken\[[A-Za-z0-9_-]{10,100}\]$/.test(v.token)
      ? { kind: 'expo', token: v.token }
      : null
  }
  if (v.kind !== 'web' || typeof v.endpoint !== 'string' || v.endpoint.length > 1024) return null
  let url: URL
  try {
    url = new URL(v.endpoint)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  const keys = v.keys
  if (!isObj(keys) || !b64url(keys.p256dh, 200) || !b64url(keys.auth, 100)) return null
  return { kind: 'web', endpoint: v.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }
}
