// What one player is sent: the table as they are allowed to see it.
//
// **The deck and every card you are not entitled to see stop here.** The room
// holds one `HandState` with every hole card in it; each socket gets a copy
// with the deck emptied and everybody else's cards taken out, put back only
// for the players a showdown turned face up. A client that never receives a
// card cannot be made to show it, by devtools or anything else, and that is the
// only kind of hidden that holds once there is another person at the table.
//
// `tests/multiplayerView.test.ts` deals thousands of seeded hands and checks
// that no view ever carries a card that is not the viewer's or shown.

import type { AvatarSpec } from '@/lib/avatar'
import type { HandState } from '@/lib/poker/engine'
import {
  type DueKind,
  mediaAllowed,
  type RoomKind,
  type RoomPhase,
  type RoomSettings,
  type RoomState,
} from './room'
import type { PreAction, Quiet } from './slow'

export interface SeatView {
  id: string
  name: string
  avatar: AvatarSpec
  ring: string | null
  bot: boolean
  characterId?: string
  host: boolean
  stack: number
  connected: boolean
  left: boolean
  /** Out after the hand in progress. */
  standing: boolean
  place: number | null
  /** Slow games: their quiet hours, so the table can show them asleep. */
  quiet?: Quiet
}

export interface RoomView {
  code: string
  kind: RoomKind
  phase: RoomPhase
  /** The viewer's own seat, or null for somebody not seated. */
  you: string | null
  isHost: boolean
  venueId: string
  buyIn: number
  smallBlind: number
  bigBlind: number
  blindLevel: number
  handIndex: number
  maxSeats: number
  /**
   * Whether camera and voice pass at this table. False at a room hosted
   * without the membership, and at quick match.
   */
  media: boolean
  prize: number
  /** The host's table rules. */
  settings: RoomSettings
  /** The seats this viewer has blocked. Never who has blocked them. */
  blocked: string[]
  /** When the first hand was dealt. With the code, names this game for the Roll's ledger. */
  startedAt: number | null
  players: SeatView[]
  /** The hand with the deck gone and hidden cards taken out. */
  hand: HandState | null
  /** How many cards each player is holding, for drawing the backs. */
  held: Record<string, number>
  /** When the current timer runs out (the turn clock), as the server's time. */
  dueAt: number | null
  dueKind: DueKind | null
  version: number
  /** The move you set ahead of your turn. Only ever yours. */
  pre: PreAction | null
  /** Slow games: how far you had watched, so the catch-up starts there. */
  seen: { hand: number; actions: number } | null
  /** Slow games: the last few finished hands, as you may see them. Oldest first. */
  history: { index: number; hand: HandState }[]
}

/** Whose cards are face up for everybody: the players a showdown turned over. */
function shown(hand: HandState): Set<string> {
  if (!hand.result?.showdown) return new Set()
  return new Set(
    hand.players.filter((p) => p.status !== 'folded' && p.status !== 'out').map((p) => p.id),
  )
}

/** The hand as `viewerId` may see it. Null viewer: a spectator, who sees only what is public. */
export function redactHand(hand: HandState, viewerId: string | null): HandState {
  const faceUp = shown(hand)
  return {
    ...hand,
    deck: [],
    players: hand.players.map((p) =>
      p.id === viewerId || faceUp.has(p.id) ? { ...p, hole: [...p.hole] } : { ...p, hole: [] },
    ),
  }
}

export function viewFor(state: RoomState, userId: string | null): RoomView {
  const me = userId ? state.players.find((p) => p.userId === userId) : undefined
  const hand = state.hand
  const held: Record<string, number> = {}
  if (hand) {
    for (const p of hand.players) if (p.status !== 'out') held[p.id] = p.hole.length
  }
  return {
    code: state.code,
    kind: state.kind,
    phase: state.phase,
    you: me?.id ?? null,
    isHost: me !== undefined && state.hostUserId === me.userId,
    venueId: state.venueId,
    buyIn: state.buyIn,
    smallBlind: hand?.smallBlind ?? state.smallBlind,
    bigBlind: hand?.bigBlind ?? state.bigBlind,
    blindLevel: state.blindLevel,
    handIndex: state.handIndex,
    maxSeats: state.maxSeats,
    media: mediaAllowed(state),
    prize: state.prize,
    startedAt: state.startedAt,
    settings: state.settings,
    blocked: userId
      ? state.players
          .filter((p) => p.userId && state.blocks[userId]?.includes(p.userId))
          .map((p) => p.id)
      : [],
    // The account id stays on the server. Nobody at the table needs it, and a
    // list of them is the first thing anybody harvesting a room would want.
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      ring: p.ring,
      bot: p.bot,
      characterId: p.characterId,
      host: p.userId !== null && p.userId === state.hostUserId,
      stack: p.stack,
      connected: p.connected,
      left: p.left,
      standing: p.standing === true,
      place: p.place,
      ...(state.kind === 'slow' && p.quiet ? { quiet: p.quiet } : {}),
    })),
    hand: hand ? redactHand(hand, me?.id ?? null) : null,
    held,
    dueAt: state.dueAt,
    dueKind: state.dueKind,
    version: state.version,
    pre: me?.pre ?? null,
    seen: me?.seen ?? null,
    history: (state.history ?? []).map((h) => ({
      index: h.index,
      hand: redactHand(h.hand, me?.id ?? null),
    })),
  }
}
