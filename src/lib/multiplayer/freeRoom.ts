// What anybody with an account can host without the membership.
//
// - One live private room a UTC week, Monday to Sunday (Will, 2026-11-18;
//   one a day from 2026-10-23). A weekly poker night was the main reason to
//   host as a member, and one a day gave it away.
// - One quick match a UTC day (Will, 2026-10-25).
// - One slow game they host open at a time (Will, 2026-10-25). A slow game
//   runs for days, so "one a day" would be a week of them at once.
//
// A member hosts as many as they like. The room and the quick match are counted
// on the room server (the `Player` object keeps the day each was last spent), so they
// hold on every device and cannot be reset from the browser. The slow one is
// counted from that same object's index of the player's slow games. The table
// itself is the same one a member opens: nothing at it says who paid.
//
// Separate from the free member table (`taste.ts`) and from each other:
// spending one never spends another.

import type { RoomKind } from './room'

/** The UTC day a moment falls on, as `YYYY-MM-DD`. The daily ones reset at midnight UTC. */
export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

/** Whether today's free one is already spent, given the day it was last spent. */
export function spentToday(spentDay: string | null, now: number): boolean {
  return spentDay === utcDay(now)
}

/** The Monday that starts the UTC week a moment falls in, as `YYYY-MM-DD`. */
export function utcWeek(now: number): string {
  const d = new Date(now)
  const sinceMonday = (d.getUTCDay() + 6) % 7
  return utcDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday))
}

/** Whether this week's free one is already spent, given the day it was last spent. */
export function spentThisWeek(spentDay: string | null, now: number): boolean {
  return spentDay !== null && spentDay >= utcWeek(now) && spentDay <= utcDay(now)
}

/** Whether the free room or quick match is spent: the room by the week, the match by the day. */
export function freeSpent(kind: 'room' | 'quick', spentDay: string | null, now: number): boolean {
  return kind === 'room' ? spentThisWeek(spentDay, now) : spentToday(spentDay, now)
}

/** Slow games somebody without the membership may host at once. */
export const FREE_SLOW_GAMES = 1

/** What is left of somebody's free hosting: `true` means they can still have it. */
export interface FreeLeft {
  room: boolean
  quick: boolean
  slow: boolean
}

/** The refusal for each kind once its free one is used. */
export const FREE_USED = {
  private: 'free-room-used',
  quick: 'free-quick-used',
  slow: 'free-slow-used',
} as const satisfies Record<RoomKind, string>

export type FreeUsed = (typeof FREE_USED)[RoomKind]

/**
 * Whether somebody may host a table of this kind, and on what: `member` (no
 * count), `free` (spends the free one), or the refusal.
 */
export function hostingAllowance(opts: {
  member: boolean
  kind: RoomKind
  left: FreeLeft
}): 'member' | 'free' | FreeUsed {
  if (opts.member) return 'member'
  const has = opts.kind === 'private' ? opts.left.room : opts.left[opts.kind]
  return has ? 'free' : FREE_USED[opts.kind]
}
