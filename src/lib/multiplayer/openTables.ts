// The open tables list on Multiplayer (Will, 2026-11-23).
//
// A host can open a table to anybody instead of only to the friends they send
// the code to. Such a room (`listed`) sits on this list while it waits for the
// deal with a chair free; dealt, full or closed, it comes off. Anybody signed
// in can sit down at one through the ordinary join screen, and joining is free.
//
// The room server keeps the list in one object (`rooms/src/lobby.ts`); every
// listed room tells it what it looks like after each change (`openTableOf`).
// This file is the pure part: what an entry holds, which ones a player is
// shown, and in what order.

import type { AvatarSpec } from '@/lib/avatar'
import { IDLE_EXPIRE_MS, type RoomKind, type RoomState, SLOW_IDLE_EXPIRE_MS } from './room'
import type { MoveHours } from './slow'

/** One open table, as anybody browsing the list sees it. */
export interface OpenTable {
  code: string
  kind: Extract<RoomKind, 'private' | 'slow'>
  venueId: string
  buyIn: number
  forRoll: boolean
  /** People sitting down, the host included. */
  people: number
  /** Regulars the host has seated. */
  bots: number
  maxSeats: number
  host: { name: string; avatar: AvatarSpec; ring: string | null }
  /** Slow games only. */
  moveHours?: MoveHours
  /** When it went on the list. The list object sets it the first time. */
  openedAt: number
}

/** What the list object keeps beside an entry, never sent to a browser. */
export interface OpenTableEntry extends OpenTable {
  hostUserId: string
  /** Accounts that cannot sit down here: removed by the host, or blocked by them. */
  shut: string[]
}

/** The most tables one player is shown at once. */
export const OPEN_TABLES_SHOWN = 30

/**
 * What a room looks like on the list, or null when it should not be on it:
 * not listed, already dealt, full, closed, or without a host.
 */
export function openTableOf(room: RoomState): Omit<OpenTableEntry, 'openedAt'> | null {
  if (!room.listed || room.phase !== 'lobby' || room.kind === 'quick') return null
  if (room.players.length >= room.maxSeats) return null
  const host = room.players.find((p) => p.userId !== null && p.userId === room.hostUserId)
  if (!host?.userId) return null
  const people = room.players.filter((p) => !p.bot).length
  return {
    code: room.code,
    kind: room.kind,
    venueId: room.venueId,
    buyIn: room.buyIn,
    forRoll: room.settings.forRoll,
    people,
    bots: room.players.length - people,
    maxSeats: room.maxSeats,
    host: { name: host.name, avatar: host.avatar, ring: host.ring },
    ...(room.kind === 'slow' && room.settings.moveHours
      ? { moveHours: room.settings.moveHours }
      : {}),
    hostUserId: host.userId,
    shut: [...room.banned, ...(room.blocks[host.userId] ?? [])],
  }
}

/** Whether an entry has outlived its room: a room nobody deals is cleared on its own clock. */
export function openTableStale(entry: OpenTable, now: number): boolean {
  const life = entry.kind === 'slow' ? SLOW_IDLE_EXPIRE_MS : IDLE_EXPIRE_MS
  return now - entry.openedAt > life
}

/**
 * The tables one player is shown: none they cannot sit down at, live tables
 * before slow games (somebody is sitting at a live one right now), then the
 * most people waiting, then the newest. Their own table is left in, so they
 * can find their way back to it.
 */
export function openTablesFor(
  entries: readonly OpenTableEntry[],
  userId: string,
  now: number,
): (OpenTable & { yours: boolean })[] {
  return entries
    .filter((e) => !openTableStale(e, now) && !e.shut.includes(userId))
    .sort(
      (a, b) =>
        Number(a.kind === 'slow') - Number(b.kind === 'slow') ||
        b.people - a.people ||
        b.openedAt - a.openedAt,
    )
    .slice(0, OPEN_TABLES_SHOWN)
    .map(({ hostUserId, shut: _shut, ...table }) => ({ ...table, yours: hostUserId === userId }))
}
