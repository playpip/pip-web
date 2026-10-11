// One multiplayer table: a Durable Object holding a `RoomState`.
//
// Everything that decides the game is `src/lib/multiplayer/room.ts`, the same
// pure reducer the tests drive. This file is only the plumbing around it:
// sockets in, the reducer, the state into storage, one alarm for whatever is
// due next, and each socket sent its own redacted view.
//
// It uses the WebSocket Hibernation API, so an idle table costs nothing while
// the object sleeps. Memory does not survive that; storage does, which is why
// the state is read back from storage rather than trusted from a field, and
// why each socket carries who it is in its attachment.

import { DurableObject } from 'cloudflare:workers'
import {
  act,
  addBots,
  block,
  blockedBetween,
  configure,
  DEFAULT_SETTINGS,
  createRoom,
  disconnect,
  join,
  kick,
  leave,
  removeBot,
  roomVenue,
  start,
  tick,
  type Joiner,
  type Result,
  type RoomKind,
  type RoomSettings,
  type RoomState,
} from '@/lib/multiplayer/room'
import {
  parseClientMessage,
  type MediaState,
  type RTCIceServerLike,
  type ServerError,
  type ServerMessage,
} from '@/lib/multiplayer/protocol'
import { viewFor } from '@/lib/multiplayer/view'
import { identify } from './auth'
import { saveBlock, saveReport } from './safety'
import { cryptoRng, json, type Env } from './env'

interface Attachment {
  userId: string | null
  playerId: string | null
  media: MediaState
}

export interface InitBody {
  code: string
  kind: RoomKind
  venueId: string
  host?: Joiner
  reserved?: string[]
  /** A private room's rules, as the host chose them while opening it. */
  settings?: Partial<RoomSettings>
  /** The host's standing blocks, so nobody they blocked can join. */
  hostBlocks?: string[]
}

/** Messages a socket may send in a burst before it is told to slow down. */
const BURST = 30
/** And how many come back each second. */
const REFILL_PER_SEC = 10
const OFF: MediaState = { camera: false, mic: false }

export class PokerRoom extends DurableObject<Env> {
  private room: RoomState | null | undefined
  private buckets = new WeakMap<WebSocket, { tokens: number; at: number }>()
  private ice: { servers: RTCIceServerLike[]; until: number } | null = null
  /** Reports already taken in this room, so a tap twice files once. */
  private reported = new Set<string>()
  /** Ticks in a row that threw, so a broken table stops retrying. */
  private failures = 0

  private async load(): Promise<RoomState | null> {
    if (this.room === undefined) {
      const stored = (await this.ctx.storage.get<RoomState>('room')) ?? null
      // A room opened before host settings existed gets the defaults.
      this.room = stored && {
        ...stored,
        banned: stored.banned ?? [],
        blocks: stored.blocks ?? {},
        settings: stored.settings ?? { ...DEFAULT_SETTINGS, seats: stored.maxSeats },
      }
    }
    return this.room
  }

  private async save(next: RoomState): Promise<void> {
    this.room = next
    if (next.phase === 'closed') {
      for (const ws of this.ctx.getWebSockets()) ws.close(4004, 'closed')
      await this.ctx.storage.deleteAll()
      return
    }
    await this.ctx.storage.put('room', next)
    if (next.dueAt !== null) await this.ctx.storage.setAlarm(next.dueAt)
    else await this.ctx.storage.deleteAlarm()
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/init' && request.method === 'POST') {
      if (await this.load()) return json({ error: 'taken' }, 409)
      const body = (await request.json()) as InitBody
      const venue = roomVenue(body.venueId)
      if (!venue) return json({ error: 'no-venue' }, 400)
      let room = createRoom({
        code: body.code,
        kind: body.kind,
        venue,
        host: body.host,
        reserved: body.reserved,
        hostBlocks: body.hostBlocks,
        now: Date.now(),
      })
      if (body.settings && body.host) {
        const set = configure(room, body.host.userId, body.settings)
        if (!set.ok) return json({ error: set.error }, 400)
        room = set.state
      }
      await this.save(room)
      return json({ ok: true }, 201)
    }
    if (url.pathname === '/peek') {
      const room = await this.load()
      if (!room) return json({ error: 'no-room' }, 404)
      const host = room.players.find((p) => p.userId === room.hostUserId)
      return json(
        {
          code: room.code,
          kind: room.kind,
          phase: room.phase,
          venueId: room.venueId,
          buyIn: room.buyIn,
          seated: room.players.length,
          maxSeats: room.maxSeats,
          host: host?.name ?? null,
          forRoll: room.settings.forRoll,
        },
        200,
      )
    }
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response(null, { status: 426 })
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      this.ctx.acceptWebSocket(server)
      server.serializeAttachment({ userId: null, playerId: null, media: OFF } satisfies Attachment)
      return new Response(null, { status: 101, webSocket: client })
    }
    return new Response(null, { status: 404 })
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      // A socket closing under us is the close handler's business.
    }
  }

  private broadcast(room: RoomState): void {
    const now = Date.now()
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment
      if (a.userId) this.send(ws, { t: 'room', view: viewFor(room, a.userId), now })
    }
  }

  /**
   * Whose camera and mic are on, by seat. Private rooms only. Each socket is
   * told about everybody except the people it is blocked with, so neither side
   * even tries to connect.
   */
  private broadcastMedia(): void {
    const sockets = this.ctx.getWebSockets()
    const all = sockets.map((ws) => ws.deserializeAttachment() as Attachment)
    const room = this.room
    for (const ws of sockets) {
      const me = ws.deserializeAttachment() as Attachment
      const media: Record<string, MediaState> = {}
      for (const a of all) {
        if (!a.playerId || !a.userId) continue
        if (
          room &&
          me.userId &&
          a.userId !== me.userId &&
          blockedBetween(room, me.userId, a.userId)
        ) {
          continue
        }
        media[a.playerId] = a.media
      }
      this.send(ws, { t: 'media', media })
    }
  }

  private allow(ws: WebSocket): boolean {
    const now = Date.now()
    const b = this.buckets.get(ws) ?? { tokens: BURST, at: now }
    b.tokens = Math.min(BURST, b.tokens + ((now - b.at) / 1000) * REFILL_PER_SEC)
    b.at = now
    if (b.tokens < 1) {
      this.buckets.set(ws, b)
      return false
    }
    b.tokens -= 1
    this.buckets.set(ws, b)
    return true
  }

  private fail(ws: WebSocket, error: ServerError, close = false): void {
    this.send(ws, { t: 'error', error })
    if (close) ws.close(4000, error)
  }

  private async apply(ws: WebSocket, result: Result): Promise<void> {
    if (!result.ok) return this.fail(ws, result.error)
    await this.save(result.state)
    this.broadcast(result.state)
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.allow(ws)) return this.fail(ws, 'slow-down')
    const msg = parseClientMessage(typeof raw === 'string' ? raw : null)
    if (!msg) return this.fail(ws, 'bad-message')
    const a = ws.deserializeAttachment() as Attachment
    const room = await this.load()
    if (!room || room.phase === 'closed') return this.fail(ws, 'no-room', true)
    const now = Date.now()

    if (msg.t === 'ping') return this.send(ws, { t: 'pong' })

    if (!a.userId) {
      // Anything sent before the hello has been answered is dropped, not
      // punished: a client can fire a message while Supabase is still being
      // asked who it is.
      if (msg.t !== 'hello') return
      const userId = await identify(msg.token, this.env)
      if (!userId) return this.fail(ws, 'auth', true)
      // Read again after the await: another message can have been handled
      // while Supabase answered, and joining the copy from before it would
      // write that message's change away.
      const current = await this.load()
      if (!current || current.phase === 'closed') return this.fail(ws, 'no-room', true)
      const result = join(
        current,
        { userId, name: msg.name, avatar: msg.avatar, ring: msg.ring },
        Date.now(),
      )
      if (!result.ok) return this.fail(ws, result.error, true)
      // One socket per person: a second tab takes the seat over from the first.
      for (const other of this.ctx.getWebSockets()) {
        const o = other.deserializeAttachment() as Attachment
        if (other !== ws && o.userId === userId) other.close(4001, 'replaced')
      }
      const playerId = result.state.players.find((p) => p.userId === userId)!.id
      ws.serializeAttachment({ userId, playerId, media: OFF } satisfies Attachment)
      await this.save(result.state)
      this.broadcast(result.state)
      if (current.kind === 'private') {
        this.broadcastMedia()
        const iceServers = await this.iceServers()
        this.send(ws, { t: 'ice', iceServers })
      }
      return
    }

    const userId = a.userId
    const rng = cryptoRng
    switch (msg.t) {
      case 'hello':
        return
      case 'act':
        return this.apply(ws, act(room, userId, msg.action, now))
      case 'start':
        return this.apply(ws, start(room, userId, now, rng))
      case 'bots':
        return this.apply(ws, addBots(room, userId, msg.count, rng))
      case 'unbot':
        return this.apply(ws, removeBot(room, userId, msg.id))
      case 'configure':
        return this.apply(ws, configure(room, userId, msg.settings))
      case 'kick': {
        const target = room.players.find((p) => p.id === msg.id)?.userId
        const result = kick(room, userId, msg.id, now)
        await this.apply(ws, result)
        if (!result.ok || !target) return
        // Their socket goes too, with the reason, so their screen can say so.
        for (const other of this.ctx.getWebSockets()) {
          const o = other.deserializeAttachment() as Attachment
          if (o.userId === target) this.fail(other, 'kicked', true)
        }
        return
      }
      case 'leave': {
        const next = leave(room, userId, now)
        await this.save(next)
        this.broadcast(next)
        ws.serializeAttachment({ ...a, media: OFF } satisfies Attachment)
        ws.close(1000, 'left')
        return
      }
      case 'media': {
        // Camera and mic are for friends who invited each other, never for a
        // table of strangers the matchmaker put together.
        if (room.kind !== 'private') return this.fail(ws, 'illegal')
        ws.serializeAttachment({ ...a, media: msg.media } satisfies Attachment)
        return this.broadcastMedia()
      }
      case 'block': {
        const target = room.players.find((p) => p.id === msg.id)?.userId
        const result = block(room, userId, msg.id)
        await this.apply(ws, result)
        if (!result.ok || !target) return
        this.broadcastMedia()
        await saveBlock(this.env, userId, target)
        return
      }
      case 'report': {
        const target = room.players.find((p) => p.id === msg.id)
        if (!target?.userId || target.userId === userId) return this.fail(ws, 'illegal')
        // One report per person per room is plenty; more is noise.
        const key = `${userId}>${target.userId}`
        if (this.reported.has(key)) return this.send(ws, { t: 'reported' })
        this.reported.add(key)
        await saveReport(this.env, {
          reporter: userId,
          reported: target.userId,
          roomCode: room.code,
          reason: msg.reason,
        })
        return this.send(ws, { t: 'reported' })
      }
      case 'signal': {
        if (room.kind !== 'private' || !a.playerId) return this.fail(ws, 'illegal')
        for (const other of this.ctx.getWebSockets()) {
          const o = other.deserializeAttachment() as Attachment
          if (o.userId && blockedBetween(room, userId, o.userId)) continue
          if (o.playerId === msg.to) {
            this.send(other, { t: 'signal', from: a.playerId, data: msg.data })
          }
        }
        return
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.dropped(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.dropped(ws)
  }

  private async dropped(ws: WebSocket): Promise<void> {
    const a = ws.deserializeAttachment() as Attachment | null
    if (!a?.userId) return
    // Still here on another socket (the tab that replaced this one).
    const elsewhere = this.ctx
      .getWebSockets()
      .some((o) => o !== ws && (o.deserializeAttachment() as Attachment).userId === a.userId)
    if (elsewhere) return
    const room = await this.load()
    if (!room || room.phase === 'closed') return
    const next = disconnect(room, a.userId, Date.now())
    await this.save(next)
    this.broadcast(next)
    if (room.kind === 'private') this.broadcastMedia()
  }

  async alarm(): Promise<void> {
    const room = await this.load()
    if (!room) return
    const now = Date.now()
    // A table only ever waits on its own clock, so an alarm that arrives well
    // after it was due is time every player spent looking at a still table.
    // Logged so the Workers dashboard shows how often, and by how much.
    if (room.dueAt !== null && now - room.dueAt > 1000) {
      console.warn('alarm late', { code: room.code, kind: room.dueKind, lateMs: now - room.dueAt })
    }
    let next: RoomState
    try {
      next = tick(room, now, cryptoRng)
    } catch (e) {
      // Never throw out of here: Cloudflare retries a failed alarm after 2 s,
      // then 4, 8, 16..., which is the table frozen for half a minute. Try
      // again in a second instead, a few times, then leave it to the logs.
      this.failures++
      console.error('tick failed', { code: room.code, kind: room.dueKind, error: String(e) })
      if (this.failures < 5) await this.ctx.storage.setAlarm(now + 1000)
      return
    }
    this.failures = 0
    if (next === room) {
      // Woke early: put the alarm back for when it is actually due.
      if (room.dueAt !== null) await this.ctx.storage.setAlarm(room.dueAt)
      return
    }
    await this.save(next)
    if (next.phase !== 'closed') this.broadcast(next)
  }

  /**
   * STUN, plus Cloudflare's TURN relay when it is configured, for the camera
   * and mic. Minted short-lived and shared by the table for an hour: the relay
   * only carries media between people at this table, and only when a direct
   * connection fails.
   */
  private async iceServers(): Promise<RTCIceServerLike[]> {
    const stun: RTCIceServerLike[] = [{ urls: 'stun:stun.cloudflare.com:3478' }]
    const { TURN_KEY_ID, TURN_KEY_API_TOKEN } = this.env
    if (!TURN_KEY_ID || !TURN_KEY_API_TOKEN) return stun
    if (this.ice && this.ice.until > Date.now()) return this.ice.servers
    try {
      const res = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TURN_KEY_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl: 2 * 60 * 60 }),
        },
      )
      if (!res.ok) return stun
      const body = (await res.json()) as { iceServers?: RTCIceServerLike[] | RTCIceServerLike }
      const servers = Array.isArray(body.iceServers)
        ? body.iceServers
        : body.iceServers
          ? [body.iceServers]
          : stun
      this.ice = { servers, until: Date.now() + 60 * 60 * 1000 }
      return servers
    } catch {
      return stun
    }
  }
}
