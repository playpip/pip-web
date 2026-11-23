// Pushes that are not about a slow game: somebody passing you on the Pip
// Rating board, your streak about to end (Will, 2026-11-09: "as many for
// retention"), and friends: requests, challenges and table invites.
//
// Pure: the player's index (`rooms/src/player.ts`) holds the prefs, the
// devices and the clock, and asks these functions what is due and what to say.
// The rules:
//
// - **Passed on the board:** `submit-rating` notes everyone a submission
//   climbed past; at most one of these every twelve hours, and the newest wins.
// - **Streak:** checked once a day, in the evening UTC (the streak's day is a
//   UTC day), at the latest of a few times outside your quiet hours. Played
//   yesterday and not yet today: it ends at midnight. Missed yesterday after
//   two days or more: it has ended, said once.
// - **Friends:** each one goes as it comes. A live challenge or invite that
//   lands in your quiet hours is dropped (the table is gone by morning); the
//   rest wait them out.
// - **Open tables** (Will, 2026-11-23): somebody opened a table to anyone.
//   A friend's comes under the Friends switch, at most one an hour; anybody
//   else's only with Open tables switched on, at most one every three hours.
//   Dropped in your quiet hours: an open table fills or goes.
// - Every one of them waits out your quiet hours, like a slow game's.

import { daysBetween, streakAtRisk, type PlayStreak } from '@/lib/streak'
import { venueById } from '@/config/venues'
import { formatChips } from '@/lib/useMoney'
import { normaliseRoomCode } from './code'
import { awake, type PlayPrefs } from './notices'

const H = 60 * 60 * 1000

/** At most one "passed you" push in this long. */
export const RATING_GAP_MS = 12 * H

/**
 * When in the UTC day the streak is checked, latest first. The latest one
 * outside your quiet hours is used, so whoever is awake at 20:00 UTC hears
 * with four hours to go, and someone whose night that is hears earlier.
 */
export const STREAK_HOURS_UTC = [20, 18, 16, 13] as const

export interface PushCopy {
  title: string
  body: string
}

/** The UTC day key of `t`. */
export function utcDayKey(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

/** The UTC midnight after `t`. */
export function nextUtcMidnight(t: number): number {
  return Date.parse(`${utcDayKey(t)}T00:00:00Z`) + 24 * H
}

/** Whether nothing may be sent at `t`. */
function quietAt(t: number, prefs: PlayPrefs): boolean {
  return awake(t, prefs) !== t
}

/**
 * The next streak check after `now`: today's if one of its times is still to
 * come and outside the quiet hours, else tomorrow's, else (a player quiet
 * through all of them) tomorrow's latest, which then waits for them to wake.
 */
export function nextStreakCheck(now: number, prefs: PlayPrefs): number {
  const midnight = Date.parse(`${utcDayKey(now)}T00:00:00Z`)
  for (const day of [0, 1]) {
    const base = midnight + day * 24 * H
    for (const hour of STREAK_HOURS_UTC) {
      const t = base + hour * H
      if (t > now && !quietAt(t, prefs)) return t
    }
  }
  return midnight + 24 * H + STREAK_HOURS_UTC[0] * H
}

/** `state.streak` from a synced profile, or null when it has none worth reading. */
export function readPlayStreak(state: unknown): PlayStreak | null {
  if (typeof state !== 'object' || state === null) return null
  const s = (state as { streak?: unknown }).streak
  if (typeof s !== 'object' || s === null) return null
  const { current, best, lastDate } = s as Record<string, unknown>
  if (typeof current !== 'number' || !Number.isFinite(current) || current < 0) return null
  if (typeof lastDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) return null
  return {
    current: Math.floor(current),
    best: typeof best === 'number' && Number.isFinite(best) ? Math.floor(best) : 0,
    lastDate,
  }
}

const days = (n: number) => (n === 1 ? '1 day' : `${n} days`)

/** What the streak calls for at `now`, or null for nothing. */
export function streakCopy(streak: PlayStreak | null, now: number): PushCopy | null {
  if (!streak?.lastDate) return null
  const today = utcDayKey(now)
  const gap = daysBetween(streak.lastDate, today)
  if (streakAtRisk(streak, today)) {
    const left = Math.max(1, Math.ceil((nextUtcMidnight(now) - now) / H))
    const hours = left === 1 ? '1 hour' : `${left} hours`
    return streak.current === 1
      ? { title: 'Keep your streak going', body: 'Play a hand today to make it 2 days.' }
      : {
          title: `Your ${streak.current}-day streak ends in ${hours}`,
          body: 'Play a hand to keep it.',
        }
  }
  if (gap === 2 && streak.current >= 2) {
    return {
      title: `Your streak ended at ${days(streak.current)}`,
      body: 'Play a hand today to start a new one.',
    }
  }
  return null
}

/** Somebody climbed past you on the board. `rank` is where that leaves you. */
export function passedCopy(name: string, rank: number | null): PushCopy {
  return {
    title: `${name} passed you on the Pip Rating`,
    body: rank ? `You’re #${rank} on the board now.` : 'See where you are on the board.',
  }
}

/** Whether a "passed you" push may go at `now`, given when the last one did. */
export function ratingPushAllowed(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= RATING_GAP_MS
}

/** A friend push: what it says, where it opens, and whether it is about a live table. */
interface SocialPush {
  copy: PushCopy
  url: string
  tag: string
  /** A live table: worth nothing once it has gone, so never held for later. */
  live: boolean
}

/**
 * A `social` outbox row's payload (`social_notify` in the social migration), as
 * a push. Null unless every field it needs is right.
 */
export function socialPush(payload: unknown): SocialPush | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  const { name, handle } = p
  if (typeof name !== 'string' || name.length === 0 || name.length > 24) return null
  if (typeof handle !== 'string' || !/^[a-z0-9_]{3,20}$/.test(handle)) return null
  switch (p.kind) {
    case 'friend-request':
      return {
        copy: { title: `${name} sent you a friend request`, body: 'Say yes or no in Friends.' },
        url: '/game/friends',
        tag: `friend-${handle}`,
        live: false,
      }
    case 'friend-accepted':
      return {
        copy: { title: `${name} accepted your friend request`, body: 'Challenge them to a game.' },
        url: `/game/player?h=${handle}`,
        tag: `friend-${handle}`,
        live: false,
      }
    case 'challenge':
    case 'invite': {
      const code = typeof p.code === 'string' ? normaliseRoomCode(p.code) : null
      if (!code) return null
      const slow = p.slow === true
      const copy =
        p.kind === 'challenge'
          ? {
              title: `${name} challenged you`,
              body: slow
                ? 'A slow game, heads-up. Your seat is waiting.'
                : 'Heads-up, live now. Take your seat.',
            }
          : {
              title: `${name} invited you to their table`,
              body: slow ? 'A slow game. Your seat is waiting.' : 'They’re at the table now.',
            }
      return { copy, url: `/game/room?code=${code}`, tag: `room-${code}`, live: !slow }
    }
  }
  return null
}

/** At most one push about a friend's open table in this long. */
export const FRIEND_TABLE_GAP_MS = H
/** And about anybody else's. */
export const TABLE_GAP_MS = 3 * H

/** An open table, as the list object announces it to one player. */
export interface TableNews {
  code: string
  name: string
  venueId: string
  buyIn: number
  forRoll: boolean
  slow: boolean
  seated: number
  maxSeats: number
  /** Whether the host is their friend. */
  friend: boolean
}

/** A `nudge/table` body, checked. Null unless every field it needs is right. */
export function readTableNews(v: unknown): TableNews | null {
  if (typeof v !== 'object' || v === null) return null
  const p = v as Record<string, unknown>
  const code = typeof p.code === 'string' ? normaliseRoomCode(p.code) : null
  const int = (x: unknown) => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0
  if (!code || typeof p.name !== 'string' || p.name.length === 0 || p.name.length > 24) return null
  if (typeof p.venueId !== 'string' || !venueById(p.venueId)) return null
  if (!int(p.buyIn) || !int(p.seated) || !int(p.maxSeats)) return null
  return {
    code,
    name: p.name,
    venueId: p.venueId,
    buyIn: p.buyIn as number,
    forRoll: p.forRoll !== false,
    slow: p.slow === true,
    seated: p.seated as number,
    maxSeats: p.maxSeats as number,
    friend: p.friend === true,
  }
}

/**
 * Whether a table push may go now: switched on for this kind (a friend's
 * under Friends, anybody's under Open tables), outside the quiet hours, and
 * past the gap since the last one of its kind.
 */
export function tablePushAllowed(
  news: Pick<TableNews, 'friend'>,
  prefs: PlayPrefs,
  last: { friend: number | null; any: number | null },
  now: number,
): boolean {
  if (!prefs.push || quietAt(now, prefs)) return false
  if (news.friend && prefs.friends) {
    return last.friend === null || now - last.friend >= FRIEND_TABLE_GAP_MS
  }
  if (!prefs.tables) return false
  return last.any === null || now - last.any >= TABLE_GAP_MS
}

/** What an open table's push says, and where it opens. */
export function tablePush(news: TableNews): { copy: PushCopy; url: string; tag: string } {
  const venue = venueById(news.venueId)?.name ?? 'the ladder'
  const stake = news.forRoll ? `${formatChips(news.buyIn)} buy-in` : 'for fun'
  return {
    copy: {
      title: news.slow ? `${news.name} opened a slow game` : `${news.name} opened a table`,
      body: `${venue}, ${stake}. ${news.seated} of ${news.maxSeats} seated.`,
    },
    url: `/game/room?code=${news.code}`,
    // The same tag as an invite to that table, so a friend told both sees one.
    tag: `room-${news.code}`,
  }
}
