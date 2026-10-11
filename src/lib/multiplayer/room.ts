// A multiplayer table, as a pure reducer.
//
// **The room server runs this; nothing else decides a hand.** The Durable
// Object in `rooms/` holds one `RoomState`, passes every message and every
// alarm through the functions here, and sends each player `viewFor` the
// result. Keeping the whole table in one serialisable value with no clock and
// no I/O is what lets it be tested here in AVA and stored between messages
// (a hibernating object loses its memory, never its storage).
//
// It is a sit-and-go, the same shape as the ladder: everyone buys in for the
// same stack, the blinds rise on the venue's schedule, and the last player
// with chips takes the prize. The prize is the buy-in times the seats dealt
// in, bots included, exactly as a ladder table's is.
//
// Time comes in as `now` and leaves as `dueAt`: every transition says when the
// next thing happens (a turn running out, a bot thinking, the next deal) and
// the server sets one alarm for it. See `tick`.

import { draftCast, profileFor } from '@/config/cast'
import { HANDS_PER_LEVEL, blindsAt } from '@/config/blinds'
import { VENUES, type Venue } from '@/config/venues'
import type { AvatarSpec } from '@/lib/avatar'
import type { Rng } from '@/lib/poker/cards'
import {
  applyAction,
  isHandComplete,
  legalActions,
  startHand,
  type Action,
  type HandState,
} from '@/lib/poker/engine'
import { type AiProfile, decideAction } from '@/lib/poker/ai/policy'
import { createTableMemory, observeAction, type TableMemory } from '@/lib/poker/ai/memory'
import { BOT_ALONE_MS, botThinkMs, fillPlayers } from './players'

/** The most seats a private room has. Quick match uses the venue's own count. */
export const MAX_ROOM_SEATS = 6

/** How long a connected player has to act. */
export const TURN_MS = 30_000
/**
 * How long a player who is not there gets: disconnected, or timed out twice
 * running. Long enough for a phone to come back from the lock screen, short
 * enough that the table is not held hostage by an empty chair.
 */
export const AWAY_TURN_MS = 8_000
/** The pause after a hand, before the next deal. Longer when cards were shown. */
export const NEXT_HAND_MS = 2_800
export const SHOWDOWN_HAND_MS = 5_000
/** A quick-match table waits this long for everyone it matched to connect. */
export const QUICK_START_MS = 15_000
/** A room nobody has started, or a finished one, is cleared after this. */
export const IDLE_EXPIRE_MS = 2 * 60 * 60 * 1000
export const FINISHED_EXPIRE_MS = 30 * 60 * 1000
/** Timeouts in a row before a player is treated as away. */
const AWAY_AFTER_TIMEOUTS = 2

export type RoomKind = 'private' | 'quick'

/** How fast the blinds climb. `flat` never moves them. */
export type BlindSpeed = 'slow' | 'normal' | 'turbo' | 'flat'
/**
 * What standing up mid-game means. `keep-seat`: the seat and chips stay, their
 * hands are folded, and they can come back. `out`: they are eliminated after
 * the hand in progress and their chips leave the table.
 */
export type LeavingRule = 'keep-seat' | 'out'

/** What a private room's host can set before the deal. Quick match uses the defaults. */
export interface RoomSettings {
  seats: number
  /** Starting chips as a multiple of the buy-in. The prize is the buy-in times the seats either way. */
  depth: 1 | 2 | 3
  blinds: BlindSpeed
  turnSeconds: 15 | 30 | 60
  leaving: LeavingRule
  /**
   * Whether the chips come from the Roll. Off, it is a game for fun: nobody
   * pays the buy-in and nobody is paid a prize, and the stake only sets the
   * chips and the blinds.
   */
  forRoll: boolean
}

export const DEFAULT_SETTINGS: Omit<RoomSettings, 'seats'> = {
  depth: 1,
  blinds: 'normal',
  turnSeconds: 30,
  leaving: 'keep-seat',
  forRoll: true,
}
export type RoomPhase = 'lobby' | 'playing' | 'finished' | 'closed'
export type DueKind = 'turn' | 'bot' | 'next-hand' | 'start' | 'expire'

export interface RoomPlayer {
  /** The seat's id, and the engine's player id. Never the account id. */
  id: string
  /** The account behind a person. Null for a bot. */
  userId: string | null
  name: string
  avatar: AvatarSpec
  /** An avatar ring id (config/cosmetics), drawn round a person's face. */
  ring: string | null
  bot: boolean
  /** Which cast character a bot is. Absent on a quick-match stranger. */
  characterId?: string
  ai?: AiProfile
  /** Chips between hands. During a hand the live stack is on `hand`. */
  stack: number
  connected: boolean
  /** Left the table on purpose: their turns are taken for them at once. */
  left: boolean
  /** Turns run out in a row. Reset whenever they act. */
  timeouts: number
  /** Where they finished, once they have. */
  place: number | null
  /** Out after the hand in progress: they left under the `out` rule, or the host removed them. */
  standing?: boolean
}

export interface RoomState {
  code: string
  kind: RoomKind
  /** Who may start a private room and add bots to it. */
  hostUserId: string | null
  venueId: string
  buyIn: number
  startingStack: number
  smallBlind: number
  bigBlind: number
  handsPerLevel?: number
  maxSeats: number
  /** Quick match: the accounts the matchmaker put at this table. */
  reserved: string[]
  /** Accounts the host removed. They cannot come back to this room. */
  banned: string[]
  /**
   * Who has blocked whom, by account: blocker → blocked. The host's standing
   * blocks are loaded when the room opens, so somebody the host blocked cannot
   * join; anybody's block at the table stops camera and voice between the two.
   */
  blocks: Record<string, string[]>
  settings: RoomSettings
  phase: RoomPhase
  players: RoomPlayer[]
  hand: HandState | null
  /** Hands dealt so far. */
  handIndex: number
  blindLevel: number
  buttonId: string | null
  /** Set when the game starts: the buy-in times the seats dealt in. */
  prize: number
  startedAt: number | null
  memory: TableMemory
  dueAt: number | null
  dueKind: DueKind | null
  /** Bumped on every change, so a client can tell a stale message. */
  version: number
  /** Next seat id to hand out. */
  nextSeat: number
}

/** Who is asking to sit down. Name and face come from their own profile. */
export interface Joiner {
  userId: string
  name: string
  avatar: AvatarSpec
  ring: string | null
}

export type RoomError =
  | 'full'
  | 'started'
  | 'not-invited'
  | 'not-host'
  | 'not-your-turn'
  | 'illegal'
  | 'too-few'
  | 'not-seated'
  | 'closed'
  | 'kicked'
  | 'bad-settings'

export type Result = { ok: true; state: RoomState } | { ok: false; error: RoomError }

const ok = (state: RoomState): Result => ({ ok: true, state })
const fail = (error: RoomError): Result => ({ ok: false, error })

/** The ladder rungs a room can be played at. Hold'em only: the stake is the venue. */
export function roomVenue(venueId: string): Venue | undefined {
  return VENUES.find((v) => v.id === venueId)
}

export function createRoom(opts: {
  code: string
  kind: RoomKind
  venue: Venue
  host?: Joiner
  reserved?: string[]
  /** Accounts the host has blocked before, from their account. */
  hostBlocks?: string[]
  now: number
}): RoomState {
  const { venue, now } = opts
  let state: RoomState = {
    code: opts.code,
    kind: opts.kind,
    hostUserId: opts.host?.userId ?? null,
    venueId: venue.id,
    buyIn: venue.buyIn,
    startingStack: venue.startingStack ?? venue.buyIn,
    smallBlind: venue.smallBlind,
    bigBlind: venue.bigBlind,
    handsPerLevel: venue.handsPerLevel,
    maxSeats: opts.kind === 'quick' ? venue.seats : MAX_ROOM_SEATS,
    reserved: opts.reserved ?? [],
    banned: [],
    blocks: opts.host && opts.hostBlocks?.length ? { [opts.host.userId]: opts.hostBlocks } : {},
    settings: {
      ...DEFAULT_SETTINGS,
      seats: opts.kind === 'quick' ? venue.seats : MAX_ROOM_SEATS,
    },
    phase: 'lobby',
    players: [],
    hand: null,
    handIndex: 0,
    blindLevel: 0,
    buttonId: null,
    prize: 0,
    startedAt: null,
    memory: createTableMemory(),
    dueAt: null,
    dueKind: null,
    version: 0,
    nextSeat: 0,
  }
  if (opts.host) state = seat(state, opts.host)
  return schedule(
    state,
    opts.kind === 'quick' ? now + QUICK_START_MS : now + IDLE_EXPIRE_MS,
    opts.kind === 'quick' ? 'start' : 'expire',
  )
}

function seat(state: RoomState, j: Joiner): RoomState {
  const player: RoomPlayer = {
    id: `p${state.nextSeat}`,
    userId: j.userId,
    name: j.name,
    avatar: j.avatar,
    ring: j.ring,
    bot: false,
    stack: state.startingStack,
    connected: true,
    left: false,
    timeouts: 0,
    place: null,
  }
  return { ...state, players: [...state.players, player], nextSeat: state.nextSeat + 1 }
}

function schedule(state: RoomState, dueAt: number | null, dueKind: DueKind | null): RoomState {
  return { ...state, dueAt, dueKind, version: state.version + 1 }
}

export function playerFor(state: RoomState, userId: string): RoomPlayer | undefined {
  return state.players.find((p) => p.userId === userId)
}

/**
 * Sit somebody down, or welcome them back.
 *
 * Somebody already seated is a reconnect, at any phase: their seat, stack and
 * cards are where they left them, which is the whole of what makes a phone
 * locking mid-hand survivable. Anybody new can only sit down before the deal.
 */
export function join(state: RoomState, j: Joiner, now: number): Result {
  if (state.phase === 'closed') return fail('closed')
  if (state.banned.includes(j.userId)) return fail('kicked')
  // Somebody the host has blocked is told the same as somebody removed: no more.
  if (state.hostUserId && state.blocks[state.hostUserId]?.includes(j.userId)) {
    return fail('kicked')
  }
  const existing = playerFor(state, j.userId)
  if (existing) {
    const players = state.players.map((p) =>
      p.userId === j.userId
        ? {
            ...p,
            connected: true,
            // Somebody who is out after this hand comes back to watch, not to play.
            left: p.standing ? p.left : false,
            timeouts: 0,
            // Name and face can change in the lobby; once dealt, the table
            // keeps the one everybody has been looking at.
            ...(state.phase === 'lobby' ? { name: j.name, avatar: j.avatar, ring: j.ring } : {}),
          }
        : p,
    )
    const next = { ...state, players }
    return ok(state.phase === 'playing' ? reschedule(next, now) : bump(next))
  }
  if (state.phase !== 'lobby') return fail('started')
  if (state.kind === 'quick' && !state.reserved.includes(j.userId)) return fail('not-invited')
  if (state.players.length >= state.maxSeats) return fail('full')
  const next = seat(state, j)
  // The last matched player arriving starts a quick table without waiting.
  if (
    next.kind === 'quick' &&
    next.reserved.every((id) => next.players.some((p) => p.userId === id))
  ) {
    return ok(schedule(next, now, 'start'))
  }
  return ok(bump(next))
}

function bump(state: RoomState): RoomState {
  return { ...state, version: state.version + 1 }
}

/** A socket closed. In the lobby the seat stays theirs until they leave on purpose. */
export function disconnect(state: RoomState, userId: string, now: number): RoomState {
  if (!playerFor(state, userId)) return state
  const players = state.players.map((p) => (p.userId === userId ? { ...p, connected: false } : p))
  const next = { ...state, players }
  return state.phase === 'playing' ? reschedule(next, now) : bump(next)
}

/**
 * Stand up on purpose.
 *
 * Before the deal it frees the seat. If it was the host's, the room passes to
 * whoever has been there longest, so a room is never left with nobody able to
 * start it. Once the game is on, the seat and chips stay (a sit-and-go has no
 * cashing out) and their turns are folded for them until they bust or come back.
 */
export function leave(state: RoomState, userId: string, now: number): RoomState {
  const player = playerFor(state, userId)
  if (!player) return state
  if (state.phase === 'lobby') {
    const players = state.players.filter((p) => p.userId !== userId)
    const humans = players.filter((p) => !p.bot)
    const hostUserId = state.hostUserId === userId ? (humans[0]?.userId ?? null) : state.hostUserId
    // An empty private room with nobody left to start it is over.
    if (state.kind === 'private' && humans.length === 0) {
      return schedule({ ...state, players: [], hostUserId: null }, now, 'expire')
    }
    return bump({ ...state, players, hostUserId })
  }
  const out = state.settings.leaving === 'out'
  const players = state.players.map((p) =>
    p.userId === userId ? { ...p, left: true, connected: false, standing: p.standing || out } : p,
  )
  const next = { ...state, players }
  return state.phase === 'playing' ? reschedule(next, now) : bump(next)
}

/**
 * The host removes somebody. Before the deal the seat is freed; once it is
 * dealt they are folded through the hand in progress and then out, exactly as
 * if they had left under the `out` rule. Either way they cannot come back.
 */
export function kick(state: RoomState, userId: string, playerId: string, now: number): Result {
  if (state.kind !== 'private' || state.hostUserId !== userId) return fail('not-host')
  const target = state.players.find((p) => p.id === playerId)
  if (!target || target.bot || !target.userId || target.userId === userId) return fail('illegal')
  const banned = [...state.banned, target.userId]
  if (state.phase === 'lobby') {
    return ok(bump({ ...state, banned, players: state.players.filter((p) => p.id !== playerId) }))
  }
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, left: true, connected: false, standing: true } : p,
  )
  const next = { ...state, banned, players }
  return ok(state.phase === 'playing' ? reschedule(next, now) : bump(next))
}

/**
 * Block another person at the table. From now on no camera or voice passes
 * between the two of you, whoever turns theirs on. It is private: they are
 * not told, and nothing else about the game changes.
 */
export function block(state: RoomState, userId: string, playerId: string): Result {
  const me = playerFor(state, userId)
  const target = state.players.find((p) => p.id === playerId)
  if (!me || !target || target.bot || !target.userId || target.userId === userId) {
    return fail('illegal')
  }
  const mine = state.blocks[userId] ?? []
  if (mine.includes(target.userId)) return ok(state)
  return ok(bump({ ...state, blocks: { ...state.blocks, [userId]: [...mine, target.userId] } }))
}

/** Whether either of two accounts has blocked the other. */
export function blockedBetween(state: RoomState, a: string, b: string): boolean {
  return Boolean(state.blocks[a]?.includes(b) || state.blocks[b]?.includes(a))
}

/** The host changes the table before the deal. Anything out of range is refused whole. */
export function configure(state: RoomState, userId: string, patch: Partial<RoomSettings>): Result {
  if (state.phase !== 'lobby') return fail('started')
  if (state.kind !== 'private' || state.hostUserId !== userId) return fail('not-host')
  const settings = { ...state.settings, ...patch }
  if (
    !Number.isInteger(settings.seats) ||
    settings.seats < Math.max(2, state.players.length) ||
    settings.seats > MAX_ROOM_SEATS ||
    ![1, 2, 3].includes(settings.depth) ||
    !['slow', 'normal', 'turbo', 'flat'].includes(settings.blinds) ||
    ![15, 30, 60].includes(settings.turnSeconds) ||
    !['keep-seat', 'out'].includes(settings.leaving) ||
    typeof settings.forRoll !== 'boolean'
  ) {
    return fail('bad-settings')
  }
  return ok(bump({ ...state, settings, maxSeats: settings.seats }))
}

/** Hands per blind level for a speed, from the stake's own pace. */
export function handsPerLevelFor(speed: BlindSpeed, base: number | undefined): number {
  const normal = base ?? HANDS_PER_LEVEL
  if (speed === 'slow') return Math.round(normal * 1.75)
  if (speed === 'turbo') return Math.max(3, Math.round(normal / 2))
  if (speed === 'flat') return Number.MAX_SAFE_INTEGER
  return normal
}

/** The host fills empty chairs with the cast. */
export function addBots(state: RoomState, userId: string, count: number, rng: Rng): Result {
  if (state.phase !== 'lobby') return fail('started')
  if (state.kind !== 'private' || state.hostUserId !== userId) return fail('not-host')
  return ok(bump(seatBots(state, count, rng)))
}

/** The host sends a bot home. */
export function removeBot(state: RoomState, userId: string, playerId: string): Result {
  if (state.phase !== 'lobby') return fail('started')
  if (state.kind !== 'private' || state.hostUserId !== userId) return fail('not-host')
  const players = state.players.filter((p) => !(p.bot && p.id === playerId))
  return ok(bump({ ...state, players }))
}

/**
 * Bots into the empty chairs. A private room's host picks from the cast, the
 * regulars everybody knows; a quick-match table is filled with ordinary
 * strangers (`players.ts`), each tagged AI at the table.
 */
function seatBots(
  state: RoomState,
  count: number,
  rng: Rng,
  who: 'cast' | 'strangers' = 'cast',
): RoomState {
  const room = Math.max(0, Math.min(count, state.maxSeats - state.players.length))
  if (room === 0) return state
  const venue = roomVenue(state.venueId)
  if (!venue) return state
  if (who === 'strangers') {
    let seat = state.nextSeat
    const strangers: RoomPlayer[] = fillPlayers(
      room,
      venue.ai,
      state.players.map((p) => p.name),
      rng,
    ).map((f) => ({
      id: `p${seat++}`,
      userId: null,
      name: f.name,
      avatar: f.avatar,
      ring: null,
      bot: true,
      ai: f.ai,
      stack: state.startingStack,
      connected: true,
      left: false,
      timeouts: 0,
      place: null,
    }))
    return { ...state, players: [...state.players, ...strangers], nextSeat: seat }
  }
  const sitting = new Set(state.players.map((p) => p.characterId).filter(Boolean))
  // Drafted from the venue's own regulars, as at the ladder table, with
  // anybody already sitting here left out so nobody is at the table twice.
  const cast = draftCast(venue, room + sitting.size, rng)
    .filter((ch) => !sitting.has(ch.id))
    .slice(0, room)
  let nextSeat = state.nextSeat
  const bots: RoomPlayer[] = cast.map((ch) => ({
    id: `p${nextSeat++}`,
    userId: null,
    name: ch.name,
    avatar: ch.avatar,
    ring: null,
    bot: true,
    characterId: ch.id,
    ai: profileFor(venue, ch),
    stack: state.startingStack,
    connected: true,
    left: false,
    timeouts: 0,
    place: null,
  }))
  return { ...state, players: [...state.players, ...bots], nextSeat }
}

/** The host deals the first hand. Two players at least, bots counted. */
export function start(state: RoomState, userId: string, now: number, rng: Rng): Result {
  if (state.phase !== 'lobby') return fail('started')
  if (state.kind !== 'private' || state.hostUserId !== userId) return fail('not-host')
  if (state.players.length < 2) return fail('too-few')
  return ok(begin(state, now, rng))
}

function begin(state: RoomState, now: number, rng: Rng): RoomState {
  // Seat order is shuffled once, at the start, so where you sat down in the
  // lobby says nothing about where the button starts.
  const players = [...state.players]
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[players[i], players[j]] = [players[j], players[i]]
  }
  const button = players[Math.floor(rng() * players.length)]
  // The host's settings take effect here and are fixed from now on.
  const stack = state.startingStack * state.settings.depth
  return deal(
    {
      ...state,
      players: players.map((p) => ({ ...p, stack })),
      handsPerLevel: handsPerLevelFor(state.settings.blinds, state.handsPerLevel),
      phase: 'playing',
      // A game for fun pays nobody, so it has no prize to show.
      prize: state.settings.forRoll ? state.buyIn * players.length : 0,
      startedAt: now,
      handIndex: 0,
    },
    now,
    rng,
    button.id,
  )
}

/** The quick-match start: whoever turned up, and the cast in every other chair. */
function beginQuick(state: RoomState, now: number, rng: Rng): RoomState {
  const humans = state.players.filter((p) => !p.bot)
  if (humans.length === 0) return schedule({ ...state, phase: 'closed' }, null, null)
  const filled = seatBots(state, state.maxSeats - state.players.length, rng, 'strangers')
  return begin(filled, now, rng)
}

/** The button moves to the next seat round the table that still has chips. */
function nextButton(state: RoomState): string {
  const order = state.players
  const from = order.findIndex((p) => p.id === state.buttonId)
  for (let i = 1; i <= order.length; i++) {
    const p = order[(from + i + order.length) % order.length]
    if (p.stack > 0) return p.id
  }
  return order[0].id
}

/**
 * Players who are out after the hand (`standing`) are taken off the table
 * before the next deal: chips gone, and placed below everybody still playing,
 * the bigger stack higher. Returns the finished game if that leaves one.
 */
function release(state: RoomState, now: number): RoomState | null {
  const going = state.players
    .filter((p) => p.standing && p.place === null && p.stack > 0)
    .sort((a, b) => b.stack - a.stack)
  if (going.length === 0) return null
  const staying = state.players.filter((p) => p.place === null && p.stack > 0 && !p.standing)
  const placeOf = new Map(going.map((p, i) => [p.id, staying.length + 1 + i]))
  let players = state.players.map((p) =>
    placeOf.has(p.id) ? { ...p, stack: 0, place: placeOf.get(p.id)! } : p,
  )
  if (staying.length <= 1) {
    players = players.map((p) => (p.place === null ? { ...p, place: 1 } : p))
    return schedule(
      { ...state, players, hand: state.hand, phase: 'finished' },
      now + FINISHED_EXPIRE_MS,
      'expire',
    )
  }
  return { ...state, players }
}

function deal(before: RoomState, now: number, rng: Rng, buttonId?: string): RoomState {
  const released = release(before, now)
  if (released?.phase === 'finished') return released
  const state = released ?? before
  const live = state.players.filter((p) => p.stack > 0)
  const button = buttonId ?? nextButton(state)
  const blinds = blindsAt(
    { smallBlind: state.smallBlind, bigBlind: state.bigBlind, handsPerLevel: state.handsPerLevel },
    state.handIndex,
  )
  const hand = startHand({
    seats: live.map((p) => ({ id: p.id, name: p.name, stack: p.stack })),
    buttonIndex: Math.max(
      0,
      live.findIndex((p) => p.id === button),
    ),
    smallBlind: blinds.smallBlind,
    bigBlind: blinds.bigBlind,
    rng,
  })
  const next: RoomState = {
    ...state,
    hand,
    buttonId: button,
    handIndex: state.handIndex + 1,
    blindLevel: blinds.level,
  }
  // Blinds can put everybody all-in and run the hand out on the deal.
  return isHandComplete(hand) ? settle(next, now) : reschedule(next, now)
}

/** Whose turn it is, and when it runs out. The one place the clock is decided. */
function reschedule(state: RoomState, now: number): RoomState {
  const hand = state.hand
  if (state.phase !== 'playing' || !hand) return bump(state)
  if (isHandComplete(hand)) return bump(state)
  const toAct = hand.players[hand.toActIndex]
  const player = toAct && state.players.find((p) => p.id === toAct.id)
  if (!player) return bump(state)
  if (player.bot) {
    // Nobody is waiting on it: every person has folded or is all-in.
    const peopleIn = hand.players.some((p) => {
      const seat = state.players.find((s) => s.id === p.id)
      return seat && !seat.bot && p.status === 'active'
    })
    if (!peopleIn) return schedule(state, now + BOT_ALONE_MS, 'bot')
    const facingBet = hand.currentBet > toAct.committedThisStreet
    const street = ['preflop', 'flop', 'turn', 'river'].indexOf(hand.street)
    const seed = state.handIndex * 131 + hand.actions.length * 17 + hand.toActIndex
    return schedule(state, now + botThinkMs(seed, facingBet, Math.max(0, street)), 'bot')
  }
  if (player.left) return schedule(state, now + 400, 'turn')
  const away = !player.connected || player.timeouts >= AWAY_AFTER_TIMEOUTS
  const turn = state.settings.turnSeconds * 1000
  return schedule(state, now + (away ? Math.min(AWAY_TURN_MS, turn) : turn), 'turn')
}

/**
 * A person's move.
 *
 * The engine applies an action to whoever is to act and never asks who sent
 * it, so this is where that question is asked: the sender must own the seat
 * whose turn it is, and the move must be one `legalActions` allows. The
 * client's buttons are a convenience; this is the rule.
 */
export function act(state: RoomState, userId: string, action: Action, now: number): Result {
  if (state.phase !== 'playing' || !state.hand) return fail('illegal')
  const player = playerFor(state, userId)
  if (!player) return fail('not-seated')
  const toAct = state.hand.players[state.hand.toActIndex]
  if (!toAct || toAct.id !== player.id) return fail('not-your-turn')
  const applied = apply(state, action)
  if (!applied) return fail('illegal')
  const players = applied.players.map((p) =>
    p.id === player.id ? { ...p, timeouts: 0, left: false } : p,
  )
  return ok(after({ ...applied, players }, now))
}

/** Apply a move to the hand, or null if the engine refuses it. */
function apply(state: RoomState, action: Action): RoomState | null {
  const hand = state.hand!
  if (!legalActions(hand)) return null
  let next: HandState
  try {
    next = applyAction(hand, action)
  } catch {
    return null
  }
  const memory = structuredClone(state.memory)
  observeAction(memory, hand, action)
  return { ...state, hand: next, memory }
}

function after(state: RoomState, now: number): RoomState {
  return state.hand && isHandComplete(state.hand) ? settle(state, now) : reschedule(state, now)
}

/** The move a player makes when their time runs out: check if it is free, fold if not. */
export function timeoutAction(hand: HandState): Action {
  const legal = legalActions(hand)
  if (legal?.canDraw) return { type: 'draw', discard: [] }
  return legal?.canCheck ? { type: 'check' } : { type: 'fold' }
}

/**
 * The end of a hand: stacks back onto the seats, and anybody who busted gets
 * their place.
 *
 * Two players out on the same hand are placed by the chips they started it
 * with, the bigger stack finishing higher, which is the standard tournament
 * rule. The last player standing wins the prize and the game is over.
 */
function settle(state: RoomState, now: number): RoomState {
  const hand = state.hand!
  const after = new Map(hand.players.map((p) => [p.id, p.stack]))
  const busting = state.players
    .filter((p) => p.place === null && p.stack > 0 && after.get(p.id) === 0)
    .sort((a, b) => b.stack - a.stack)
  const alive = state.players.filter(
    (p) => p.place === null && (after.get(p.id) ?? p.stack) > 0,
  ).length
  const placeOf = new Map(busting.map((p, i) => [p.id, alive + 1 + i]))
  let players = state.players.map((p) => ({
    ...p,
    stack: after.get(p.id) ?? p.stack,
    place: placeOf.get(p.id) ?? p.place,
  }))
  if (alive <= 1) {
    players = players.map((p) => (p.place === null ? { ...p, place: 1 } : p))
    return schedule({ ...state, players, phase: 'finished' }, now + FINISHED_EXPIRE_MS, 'expire')
  }
  const pause = hand.result?.showdown ? SHOWDOWN_HAND_MS : NEXT_HAND_MS
  return schedule({ ...state, players }, now + pause, 'next-hand')
}

/**
 * Whatever is due, done. The server calls this from its alarm.
 *
 * Returns the state unchanged when nothing is due yet, so an alarm that fires
 * early (or twice) is harmless.
 */
export function tick(state: RoomState, now: number, rng: Rng): RoomState {
  if (state.dueAt === null || now < state.dueAt) return state
  switch (state.dueKind) {
    case 'expire':
      return schedule({ ...state, phase: 'closed' }, null, null)
    case 'start':
      return state.phase === 'lobby' ? beginQuick(state, now, rng) : state
    case 'next-hand':
      return state.phase === 'playing' ? deal(state, now, rng) : state
    case 'bot': {
      const hand = state.hand
      if (!hand || isHandComplete(hand)) return reschedule(state, now)
      const toAct = hand.players[hand.toActIndex]
      const bot = state.players.find((p) => p.id === toAct?.id)
      if (!bot?.bot) return reschedule(state, now)
      // A bot that cannot decide checks or folds rather than taking the alarm
      // down with it: an alarm that throws is retried with a growing backoff,
      // and the whole table waits on it.
      let applied: RoomState | null = null
      try {
        const action = decideAction(hand, bot.ai ?? roomVenue(state.venueId)!.ai, rng, state.memory)
        applied = apply(state, action)
      } catch {
        applied = null
      }
      applied ??= apply(state, timeoutAction(hand))
      return applied ? after(applied, now) : reschedule(state, now)
    }
    case 'turn': {
      const hand = state.hand
      if (!hand || isHandComplete(hand)) return reschedule(state, now)
      const toAct = hand.players[hand.toActIndex]
      const applied = apply(state, timeoutAction(hand))
      if (!applied) return reschedule(state, now)
      const players = applied.players.map((p) =>
        p.id === toAct?.id && !p.left ? { ...p, timeouts: p.timeouts + 1 } : p,
      )
      return after({ ...applied, players }, now)
    }
    default:
      return state
  }
}
