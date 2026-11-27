// Each person's copy of a finished multiplayer hand, for their games
// (docs/games.md) and the Pip Rating's inbox (docs/rating.md). Pure; the room
// server sends what this builds (rooms/src/games.ts).
//
// **Only the cards that person saw.** Each copy is made from the hand as
// `redactHand` gives it to that seat: their own cards and the ones a showdown
// turned over. It is then the same `ReviewHand` the review keeps on the device
// (./review), graded the same way, so a game opened from a profile is the
// review the table offered.

import { ratedVenue } from '@/config/venues'
import type { RatedDecision } from '@/lib/rating/local'
import { ratedDecisionsOf } from '@/lib/rating/hand'
import type { ReviewHand } from '@/lib/review/types'
import { roomVenue, type RoomState } from './room'
import { reviewedHand, roomHandRecord, roomTitle } from './roomHand'
import { redactHand } from './view'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What `games.kind` calls a room. */
export function gameKind(room: Pick<RoomState, 'kind' | 'listed'>): 'private' | 'open' | 'slow' {
  if (room.kind === 'slow') return 'slow'
  return room.kind === 'quick' || room.listed ? 'open' : 'private'
}

/** Whether `next` is the save that finished a hand: the result is new. */
export function handJustFinished(before: RoomState | null, next: RoomState): boolean {
  if (!next.hand?.result || next.startedAt === null) return false
  if (!before?.hand?.result) return true
  return before.handIndex !== next.handIndex
}

export interface SeatEntry {
  user: string
  game: Record<string, unknown>
  hand: ReviewHand
  rated: { at: number; decisions: RatedDecision[] } | null
}

/** Each person's copy of the hand that just finished. Pure, for the tests. */
export function seatEntries(room: RoomState, now: number): SeatEntry[] {
  const hand = room.hand
  if (!hand?.result || room.startedAt === null) return []
  const venue = roomVenue(room.venueId)
  const players = room.players.map((p) => ({ id: p.id, avatar: p.avatar }))
  const out: SeatEntry[] = []
  for (const p of room.players) {
    // A dev token's account is no Supabase user.
    if (!p.userId || p.bot || !UUID.test(p.userId)) continue
    const record = roomHandRecord(redactHand(hand, p.id), room.handIndex, {
      you: p.id,
      players,
    })
    const game: Record<string, unknown> = {
      key: `room:${room.code}:${room.startedAt}`,
      kind: gameKind(room),
      venueId: room.venueId,
      title: roomTitle(room.kind, room.venueId),
      accent: venue?.accent ?? '#7C8CF0',
      startedAt: room.startedAt,
    }
    if (p.place !== null) {
      game.endedAt = now
      game.outcome =
        p.place === 1
          ? { kind: 'won', seats: room.players.length }
          : { kind: 'busted', place: p.place, seats: room.players.length }
    }
    // Not in the hand: already out, and their ending went with the hand that put them there.
    if (!record) continue
    const reviewed = reviewedHand(record)
    const decisions = venue && ratedVenue(venue) ? ratedDecisionsOf(record, reviewed.decisions) : []
    out.push({
      user: p.userId,
      game,
      hand: reviewed,
      rated: decisions.length > 0 ? { at: now, decisions } : null,
    })
  }
  return out
}
