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

import { heroDecision, scoreDecisions } from '@/lib/coach'
import { type HandState, legalActions, potSize } from '@/lib/poker/engine'
import { gradeDecision, isGraded } from '@/lib/review/grade'
import { HERO_ID } from '@/lib/review/handState'
import { MAX_REVIEW_HANDS, type ReviewHand, type ReviewSession } from '@/lib/review/session'
import { venueById } from '@/config/venues'
import type { HandActionEvent, HandEvent, HandRecord } from '@/store/game'
import { rebuild } from './catchUp'
import type { RoomKind } from './room'
import type { RoomView } from './view'

const KEY = 'pip.roomReviews'
/** Rooms kept. The oldest goes when a new one starts. */
export const MAX_ROOM_REVIEWS = 8
/** Decisions priced per hand, as the single-player table does. */
const MAX_REVIEWED_DECISIONS = 8

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

/** What to call a room on the review: the kind of game and the stake it was played at. */
export function roomTitle(kind: RoomKind, venueId: string): string {
  const venue = venueById(venueId)?.name
  const label = kind === 'slow' ? 'Slow game' : 'Multiplayer'
  return venue ? `${label} · ${venue}` : label
}

/**
 * A finished room hand as the review's `HandRecord`, from the viewer's seat.
 * Null when the hand cannot be rebuilt faithfully, or the viewer was not in it.
 */
export function roomHandRecord(
  hand: HandState,
  handNo: number,
  view: Pick<RoomView, 'you' | 'players'>,
): HandRecord | null {
  const you = view.you
  if (!you || !hand.result || hand.variant !== 'holdem') return null
  const mine = hand.players.find((p) => p.id === you)
  if (!mine || mine.hole.length < 2) return null
  // Somebody else already wearing the hero's name would be two heroes.
  if (hand.players.some((p) => p.id === HERO_ID)) return null
  const frames = rebuild(hand, you)
  if (!frames || frames.length < 1) return null

  const as = (id: string) => (id === you ? HERO_ID : id)
  const stacksOf = (s: HandState) => Object.fromEntries(s.players.map((p) => [as(p.id), p.stack]))
  const committedOf = (s: HandState) =>
    Object.fromEntries(s.players.map((p) => [as(p.id), p.committedThisStreet]))

  const events: HandEvent[] = []
  for (let i = 0; i < hand.actions.length; i++) {
    const prev = frames[i]
    const next = frames[i + 1]
    const a = hand.actions[i]
    if (!prev || !next) return null
    const actor = prev.players[prev.toActIndex]
    if (!actor) return null
    const legal = legalActions(prev)
    const amount =
      a.type === 'call'
        ? legal?.callAmount
        : a.type === 'bet' || a.type === 'raise'
          ? a.to
          : undefined
    const event: HandActionEvent = {
      kind: 'action',
      playerId: as(actor.id),
      playerName: actor.name,
      type: a.type,
      amount,
      // What you could see as you acted: the same snapshot the solo table
      // takes, off a frame that only ever held your own cards.
      decision: actor.id === you ? heroDecision(prev, you, legal?.callAmount ?? 0) : undefined,
      pot: potSize(next),
      stacks: stacksOf(next),
      committed: committedOf(next),
    }
    events.push(event)
    const dealt = next.community.length - prev.community.length
    if (dealt > 0) {
      const label =
        dealt > 1 && next.community.length === 5 && prev.community.length < 4
          ? 'Runout'
          : next.community.length === 3
            ? 'Flop'
            : next.community.length === 4
              ? 'Turn'
              : 'River'
      events.push({ kind: 'board', label, cards: next.community.slice() })
    }
  }

  const start = frames[0]
  const result = hand.result
  const showdown = result.showdown === true
  // The cards this seat saw: its own, and every hand a showdown turned over.
  const known = hand.players.filter((p) => p.hole.length >= 2)
  const reveals = known
    .filter((p) => p.id === you || (showdown && p.status !== 'folded' && p.status !== 'out'))
    .map((p) => ({
      playerId: as(p.id),
      playerName: p.name,
      cards: p.hole.slice(),
      handName: result.evaluations?.[p.id]?.name,
    }))
  const avatarOf = new Map(view.players.map((p) => [p.id, p.avatar]))
  const win = result.potsAwarded[0]
  const winners = win?.winners.map((id) => hand.players.find((p) => p.id === id)?.name ?? id)
  const handName = showdown && win ? result.evaluations?.[win.winners[0]]?.name : undefined
  const before = start.players.find((p) => p.id === you)
  const startStack = (before?.stack ?? 0) + (before?.committedThisHand ?? 0)

  return {
    handNo,
    smallBlind: hand.smallBlind,
    bigBlind: hand.bigBlind,
    events,
    community: hand.community.slice(),
    reveals,
    seats: hand.players
      .filter((p) => p.status !== 'out')
      .map((p) => ({
        id: as(p.id),
        name: p.name,
        avatar: avatarOf.get(p.id) ?? { seed: p.name || 'pip', backgroundColor: 'e5e7eb' },
      })),
    hole: known.map((p) => ({ playerId: as(p.id), cards: p.hole.slice() })),
    buttonId: hand.players[hand.buttonIndex] ? as(hand.players[hand.buttonIndex].id) : undefined,
    // Only the seats dealt in: `everyLiveHandKnown` reads this as who was in the hand.
    start: {
      stacks: Object.fromEntries(
        start.players.filter((p) => p.status !== 'out').map((p) => [as(p.id), p.stack]),
      ),
      committed: committedOf(start),
      pot: potSize(start),
    },
    summary:
      win && winners
        ? `${winners.join(' & ')} wins ${win.amount.toLocaleString()}${handName ? ` with ${handName}` : ''}`
        : '',
    heroDelta: mine.stack - startStack,
  }
}

/** A recorded hand, with your calls and folds graded the way the solo review grades them. */
function reviewed(record: HandRecord): ReviewHand {
  const scored = scoreDecisions(record, { max: MAX_REVIEWED_DECISIONS }).filter(isGraded)
  return { record, decisions: scored.map((s) => gradeDecision(s, record.bigBlind)) }
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
    review.hands.push(reviewed(record))
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
