// The session review for multiplayer: every finished hand of a room, kept on
// this device so it can go back on the felt afterwards.
//
// **Only what you were allowed to see.** The room server never sends another
// player's cards unless a showdown turned them over (lib/multiplayer/view), and
// the review is built from those same views. So a multiplayer review shows your
// own cards and the hands that were shown, and nothing else. The solo review
// turns every card face up because the other seats are the house's; here they
// are people, and their mucked cards stay theirs.
//
// **Built on this device, as the views arrive.** A fast room sends each hand as
// it finishes; a slow room also carries its last few finished hands
// (`history`), so a game you only open now and then still fills in. Each hand
// is dealt again with the engine (`rebuild` in ./catchUp) to get the table
// after every move, then written as the same `HandRecord` the single-player
// table keeps, with your seat renamed to the review's `hero`. From there it is
// the solo review: same screen, same grading.
//
// One review per room, the most recent few rooms kept. A room is one game, so
// this is still "the session you played", not a library.

import type { HandState } from '@/lib/poker/engine'
import { MAX_REVIEW_HANDS, type ReviewSession } from '@/lib/review/session'
import { venueById } from '@/config/venues'
import { reviewedHand, roomHandRecord, roomTitle } from './roomHand'
import type { RoomView } from './view'

export { roomHandRecord } from './roomHand'

const KEY = 'pip.roomReviews'
/** Rooms kept. The oldest goes when a new one starts. */
export const MAX_ROOM_REVIEWS = 8

export interface RoomReview extends ReviewSession {
  room: NonNullable<ReviewSession['room']>
  /** Hand numbers already in `hands`, so a hand seen twice is kept once. */
  seen: number[]
}

type Store = Record<string, RoomReview>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function write(store: Store): void {
  // A full store drops its oldest room and tries again, rather than losing the new hand.
  let rooms = Object.values(store)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, MAX_ROOM_REVIEWS)
  while (rooms.length > 0) {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify(Object.fromEntries(rooms.map((r) => [r.room.code, r]))),
      )
      return
    } catch {
      if (rooms.length === 1) return
      rooms = rooms.slice(0, -1)
    }
  }
}

/** One room's review, or null when nothing was kept for it. */
export function loadRoomReview(code: string): RoomReview | null {
  return read()[code] ?? null
}

/** Every room reviewed on this device, newest first. */
export function listRoomReviews(): RoomReview[] {
  return Object.values(read())
    .filter((r) => r.hands.length > 0)
    .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))
}

/**
 * Keep whatever finished hands this view carries that are not kept yet, and
 * close the review once the game is over for you. Safe to call with every view:
 * a hand already kept costs one lookup.
 */
export function captureRoomView(view: RoomView): void {
  if (!view.you || view.phase === 'lobby' || view.startedAt === null) return
  const finished: { index: number; hand: HandState }[] = [...view.history]
  if (view.hand?.result && !finished.some((h) => h.index === view.handIndex)) {
    finished.push({ index: view.handIndex, hand: view.hand })
  }

  const store = read()
  const existing = store[view.code]
  // The same code can be dealt again later as a different game.
  const same = existing && existing.startedAt === view.startedAt
  const venue = venueById(view.venueId)
  const review: RoomReview = same
    ? existing
    : {
        venueId: view.venueId,
        venueName: roomTitle(view.kind, view.venueId),
        accent: venue?.accent ?? '#7C8CF0',
        cash: false,
        startedAt: view.startedAt,
        endedAt: null,
        outcome: null,
        hands: [],
        dropped: 0,
        room: { code: view.code, kind: view.kind },
        seen: [],
      }

  let changed = !same
  const fresh = finished
    .filter((h) => !review.seen.includes(h.index))
    .sort((a, b) => a.index - b.index)
  for (const h of fresh) {
    // Marked seen even when it cannot be rebuilt, so it is not tried on every view.
    review.seen.push(h.index)
    changed = true
    const record = roomHandRecord(h.hand, h.index, view)
    if (!record) continue
    review.hands.push(reviewedHand(record))
  }
  if (fresh.length > 0) {
    // Out of order is possible (a slow game's history arriving after a live
    // hand was kept), so the hands are put back in the order they were dealt.
    review.hands.sort((a, b) => a.record.handNo - b.record.handNo)
    while (review.hands.length > MAX_REVIEW_HANDS) {
      review.hands.shift()
      review.dropped++
    }
    review.seen = review.seen.slice(-MAX_REVIEW_HANDS * 2)
  }

  const me = view.players.find((p) => p.id === view.you)
  const over = view.phase === 'finished' || view.phase === 'closed' || (me?.place ?? null) !== null
  if (over && review.endedAt === null) {
    review.endedAt = Date.now()
    review.outcome =
      me?.place === 1
        ? { kind: 'won', seats: view.players.length }
        : { kind: 'busted', place: me?.place ?? null, seats: view.players.length }
    changed = true
  }

  if (!changed) return
  // Nothing to show yet: not worth a slot that would push an older game out.
  if (review.hands.length === 0 && !existing) return
  store[view.code] = review
  write(store)
}
