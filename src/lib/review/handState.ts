/**
 * A finished hand, rebuilt into the engine's own `HandState` at any step.
 *
 * **This is what lets the review be the table rather than a drawing of it.**
 * `components/table/parts.tsx` takes a `Player` and a `HandState` and nothing
 * else, so a state built here renders through exactly the same seats, cards,
 * dealer chip, fold stamp and chip pills the live game draws. A second
 * implementation of the felt would look right on the day it shipped and drift
 * from the real one by the end of the month.
 *
 * **Nothing here goes near the game store.** The state is a value, built and
 * thrown away by a screen; the store owns the hand you are actually playing and
 * this must never be handed to it.
 *
 * **Everything is read back, never recomputed.** Stacks, chips in front and the
 * pot all ride on the action events (see `HandActionEvent`); the button is on
 * the record. A hand recorded before those fields existed simply has fewer of
 * them, and the screen draws what it has rather than a plausible
 * reconstruction.
 */

import type { Card } from '@/lib/poker/cards'
import type { HandState, Player, Street } from '@/lib/poker/engine'
import type { HandRecord } from '@/store/game'

export const HERO_ID = 'hero'

export interface ReplayStep {
  hand: HandState
  /** The seat metadata the felt needs: who they are and what they look like. */
  seats: { id: string; name: string; avatar: { seed: string; backgroundColor: string } }[]
  /** Chips in the middle. Null for a record that never kept them. */
  pot: number | null
  /**
   * The last action shown — who the felt highlights. A board event does not
   * clear it, because "who just acted" is still that player while the cards
   * land.
   */
  last: Extract<HandRecord['events'][number], { kind: 'action' }> | null
  /** The event this step actually landed on, action or board. */
  lastEvent: HandRecord['events'][number] | null
  /** Its index in `record.events`, or -1 before the first step. */
  lastIndex: number
  /** True once every event has been played out. */
  done: boolean
}

/** A neutral avatar for a hand recorded before seats were kept. */
const FALLBACK_AVATAR = { seed: 'pip', backgroundColor: 'e5e7eb' }

function seatsOf(record: HandRecord): ReplayStep['seats'] {
  if (record.seats?.length) {
    return record.seats.map((s) => ({ ...s, avatar: s.avatar ?? FALLBACK_AVATAR }))
  }
  // An older hand, or one out of a `/hand` link: whoever spoke in it, plus
  // whoever showed a hand at the end.
  const seen = new Map<string, string>()
  for (const ev of record.events) {
    if (ev.kind === 'action' && !seen.has(ev.playerId)) seen.set(ev.playerId, ev.playerName)
  }
  for (const r of record.reveals) if (!seen.has(r.playerId)) seen.set(r.playerId, r.playerName)
  return [...seen].map(([id, name]) => ({ id, name, avatar: FALLBACK_AVATAR }))
}

function holeOf(record: HandRecord, id: string): Card[] {
  return (
    record.hole?.find((h) => h.playerId === id)?.cards ??
    record.reveals.find((r) => r.playerId === id)?.cards ??
    []
  )
}

function streetOf(board: readonly Card[]): Street {
  if (board.length === 0) return 'preflop'
  if (board.length === 3) return 'flop'
  if (board.length === 4) return 'turn'
  return 'river'
}

/**
 * The table at `step` — the state after that many events have been shown.
 *
 * `toActIndex` is always -1: nobody is to act in a hand that is over, and the
 * felt reads it only to decide who to highlight. The seat that just acted is
 * highlighted instead, which is the thing a review wants to point at.
 */
export function handStateAt(record: HandRecord, step: number): ReplayStep {
  const shown = record.events.slice(0, Math.max(0, step))
  const community = [...shown].reverse().find((e) => e.kind === 'board')?.cards ?? []

  const folded = new Set<string>()
  // Seeded from the deal, so step zero is the table as the cards landed —
  // stacks after the blinds, the blinds in front, and the pot they make —
  // rather than a felt full of zeroes waiting for the first action.
  let pot: number | null = record.start?.pot ?? null
  let stacks: Record<string, number> | null = record.start?.stacks ?? null
  let committed: Record<string, number> | null = record.start?.committed ?? null
  for (const ev of shown) {
    if (ev.kind !== 'action') continue
    if (ev.type === 'fold') folded.add(ev.playerId)
    if (ev.pot !== undefined) pot = ev.pot
    if (ev.stacks) stacks = ev.stacks
    // Chips in front reset every street, and the recorded map resets with them
    // — but only an *action* carries one, so a board event between streets
    // leaves the last street's pills standing. Clear them when the board grew.
    if (ev.committed) committed = ev.committed
  }
  // The board moving on is what clears the chips in front, so find out whether
  // anything has been bet since the last card landed.
  const lastBoardAt = shown.reduce((at, ev, i) => (ev.kind === 'board' ? i : at), -1)
  const actedSinceBoard = shown.slice(lastBoardAt + 1).some((ev) => ev.kind === 'action')
  if (lastBoardAt >= 0 && !actedSinceBoard) committed = null

  const seats = seatsOf(record)
  const players: Player[] = seats.map((seat) => ({
    id: seat.id,
    name: seat.name,
    stack: stacks?.[seat.id] ?? 0,
    hole: holeOf(record, seat.id),
    status: folded.has(seat.id) ? 'folded' : 'active',
    committedThisStreet: committed?.[seat.id] ?? 0,
    committedThisHand: 0,
    hasActed: false,
  }))

  const buttonIndex = record.buttonId ? seats.findIndex((s) => s.id === record.buttonId) : -1
  const last = [...shown].reverse().find((e) => e.kind === 'action') ?? null
  const lastIndex = shown.length - 1
  const lastEvent = shown[lastIndex] ?? null

  return {
    hand: {
      players,
      buttonIndex,
      smallBlind: record.smallBlind,
      bigBlind: record.bigBlind,
      street: streetOf(community),
      community: [...community],
      deck: [],
      currentBet: 0,
      lastRaiseSize: 0,
      toActIndex: -1,
      pots: [],
      result: null,
      variant: 'holdem',
    },
    seats,
    pot,
    last,
    lastEvent,
    lastIndex,
    done: step >= record.events.length,
  }
}

/** The players still live at this step — the ones an equity read is between. */
export function liveHands(hand: HandState): { id: string; hole: Card[] }[] {
  return hand.players
    .filter((p) => p.status !== 'folded' && p.hole.length >= 2)
    .map((p) => ({ id: p.id, hole: p.hole }))
}
