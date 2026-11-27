// One finished room hand as the review's `HandRecord`, from one seat (docs/review.md
// → Multiplayer games). Pure: the device builds its review with it
// (./review) and the room server builds everybody's games with it
// (rooms/src/games.ts), so the two are the same hand.

import type { AvatarSpec } from '@/lib/avatar'
import { heroDecision, scoreDecisions } from '@/lib/coach'
import type { HandActionEvent, HandEvent, HandRecord } from '@/lib/handRecord'
import { type HandState, legalActions, potSize } from '@/lib/poker/engine'
import { gradeDecision, isGraded } from '@/lib/review/grade'
import { HERO_ID } from '@/lib/review/handState'
import type { ReviewHand } from '@/lib/review/types'
import { venueById } from '@/config/venues'
import { rebuild } from './catchUp'
import type { RoomKind } from './room'

/** Decisions priced per hand, as the single-player table does. */
const MAX_REVIEWED_DECISIONS = 8

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
  view: { you: string | null; players: readonly { id: string; avatar: AvatarSpec }[] },
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
export function reviewedHand(record: HandRecord): ReviewHand {
  const scored = scoreDecisions(record, { max: MAX_REVIEWED_DECISIONS }).filter(isGraded)
  return { record, decisions: scored.map((s) => gradeDecision(s, record.bigBlind)) }
}
