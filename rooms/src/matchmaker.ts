// Quick match: one Durable Object per stake, holding the line.
//
// The rules are `src/lib/multiplayer/matchmaking.ts`. This object keeps the
// queue in storage, wakes when the first person in line has waited long
// enough, opens a `PokerRoom` for each table it takes, and tells the people it
// seated where to go. They then connect to the room like anybody with a code;
// the room seats only the accounts it was opened for.

import { DurableObject } from 'cloudflare:workers'
import { cryptoInt } from '@/lib/cryptoRng'
import { newRoomCode } from '@/lib/multiplayer/code'
import {
  dequeue,
  emptyQueue,
  enqueue,
  fillAt,
  takeTable,
  type Queue,
} from '@/lib/multiplayer/matchmaking'
import {
  parseQueueMessage,
  type QueueServerMessage,
  type ServerError,
} from '@/lib/multiplayer/protocol'
import { roomVenue } from '@/lib/multiplayer/room'
import { identify, isMember } from './auth'
import type { Env } from './env'
import type { InitBody } from './room'

interface Attachment {
  userId: string | null
  venueId: string
}

export class Matchmaker extends DurableObject<Env> {
  private queue: Queue | undefined

  private async load(venueId: string): Promise<Queue | null> {
    if (this.queue) return this.queue
    const stored = await this.ctx.storage.get<Queue>('queue')
    const venue = roomVenue(venueId)
    this.queue = stored ?? (venue ? emptyQueue(venue.id, venue.seats) : undefined)
    return this.queue ?? null
  }

  private async save(q: Queue): Promise<void> {
    this.queue = q
    await this.ctx.storage.put('queue', q)
    const at = fillAt(q)
    if (at !== null) await this.ctx.storage.setAlarm(at)
    else await this.ctx.storage.deleteAlarm()
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const venueId = url.searchParams.get('venue') ?? ''
    if (url.pathname !== '/ws' || !roomVenue(venueId)) return new Response(null, { status: 404 })
    if (request.headers.get('Upgrade') !== 'websocket') return new Response(null, { status: 426 })
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ userId: null, venueId } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  private send(ws: WebSocket, msg: QueueServerMessage): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      // Closing; the close handler takes them out of line.
    }
  }

  private fail(ws: WebSocket, error: ServerError): void {
    this.send(ws, { t: 'error', error })
    ws.close(4000, error)
  }

  private status(q: Queue): void {
    const now = Date.now()
    for (const ws of this.ctx.getWebSockets()) {
      if ((ws.deserializeAttachment() as Attachment).userId) {
        this.send(ws, {
          t: 'queued',
          waiting: q.waiting.length,
          seats: q.seats,
          fillAt: fillAt(q),
          now,
        })
      }
    }
  }

  /** Take every table that is ready, open a room for each, and send its players there. */
  private async match(q: Queue): Promise<Queue> {
    for (;;) {
      const { queue, table } = takeTable(q, Date.now())
      if (!table) return q
      const code = await this.openRoom({
        kind: 'quick',
        venueId: q.venueId,
        reserved: table.map((w) => w.userId),
      })
      q = queue
      if (!code) continue
      const seated = new Set(table.map((w) => w.userId))
      for (const ws of this.ctx.getWebSockets()) {
        const a = ws.deserializeAttachment() as Attachment
        if (a.userId && seated.has(a.userId)) {
          this.send(ws, { t: 'matched', code })
          ws.close(1000, 'matched')
        }
      }
    }
  }

  private async openRoom(body: Omit<InitBody, 'code'>): Promise<string | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newRoomCode(cryptoInt)
      const stub = this.env.ROOMS.get(this.env.ROOMS.idFromName(code))
      const res = await stub.fetch('https://room/init', {
        method: 'POST',
        body: JSON.stringify({ ...body, code } satisfies InitBody),
      })
      if (res.status === 201) return code
    }
    return null
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const msg = parseQueueMessage(typeof raw === 'string' ? raw : null)
    if (!msg) return this.fail(ws, 'bad-message')
    if (msg.t === 'ping') return this.send(ws, { t: 'pong' })
    const a = ws.deserializeAttachment() as Attachment
    const q = await this.load(a.venueId)
    if (!q) return this.fail(ws, 'no-room')

    if (msg.t === 'leave') {
      const userId = a.userId
      if (userId) await this.exclusively(async (current) => dequeue(current, userId), a.venueId)
      ws.close(1000, 'left')
      return
    }
    if (a.userId) return

    const userId = await identify(msg.token, this.env)
    if (!userId) return this.fail(ws, 'auth')
    // Quick match is the membership's: strangers at a table we run.
    if (!(await isMember(userId, msg.token, this.env))) return this.fail(ws, 'members-only')
    for (const other of this.ctx.getWebSockets()) {
      const o = other.deserializeAttachment() as Attachment
      if (other !== ws && o.userId === userId) other.close(4001, 'replaced')
    }
    ws.serializeAttachment({ userId, venueId: a.venueId } satisfies Attachment)
    const joiner = { userId, name: msg.name, avatar: msg.avatar, ring: msg.ring }
    await this.exclusively(async (current) => enqueue(current, joiner, Date.now()), a.venueId)
  }

  /**
   * Change the queue with nothing else running.
   *
   * Opening a room is a request to another object, and without this a second
   * person joining while it was in flight would be written away when the
   * first change saved the copy it started from.
   */
  private async exclusively(change: (q: Queue) => Promise<Queue>, venueId: string): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => {
      const q = await this.load(venueId)
      if (!q) return
      const next = await this.match(await change(q))
      await this.save(next)
      this.status(next)
    })
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.dropped(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.dropped(ws)
  }

  /** Closing the page takes you out of line, unless you are still here on another tab. */
  private async dropped(ws: WebSocket): Promise<void> {
    const a = ws.deserializeAttachment() as Attachment | null
    if (!a?.userId) return
    const elsewhere = this.ctx
      .getWebSockets()
      .some((o) => o !== ws && (o.deserializeAttachment() as Attachment).userId === a.userId)
    if (elsewhere) return
    const userId = a.userId
    await this.exclusively(async (q) => dequeue(q, userId), a.venueId)
  }

  async alarm(): Promise<void> {
    const q = this.queue ?? (await this.ctx.storage.get<Queue>('queue'))
    if (!q) return
    await this.exclusively(async (current) => current, q.venueId)
  }
}
