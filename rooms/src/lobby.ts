// The open tables list (src/lib/multiplayer/openTables.ts). One object, named "all".
//
// Every listed room tells it what it looks like after each change
// (`PokerRoom.save`): `put` while it waits for the deal with a chair free,
// `drop` once it is dealt, full or closed. A room that dies without saying so
// (an object evicted mid-write) ages off on its own idle clock.
//
// A table's first `put` is announced (`tableAudience`): each of the host's
// friends and everybody who switched Open tables on is sent the news, and
// their own index decides whether to push it (`nudges.ts` `tablePushAllowed`).
// Who switched it on is kept here (`s:<account>`), set from Settings.

import { DurableObject } from 'cloudflare:workers'
import {
  type OpenTableEntry,
  openTableStale,
  openTablesFor,
  tableAudience,
} from '@/lib/multiplayer/openTables'
import type { TableNews } from '@/lib/multiplayer/nudges'
import { json, playerStub, type Env } from './env'
import { blockersOf, friendsOf } from './safety'

export class Lobby extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/put' && request.method === 'POST') {
      const entry = (await request.json()) as Omit<OpenTableEntry, 'openedAt'>
      const key = `t:${entry.code}`
      const before = await this.ctx.storage.get<OpenTableEntry>(key)
      await this.ctx.storage.put(key, { ...entry, openedAt: before?.openedAt ?? Date.now() })
      // Announced once: when it first goes on the list, never again as it changes.
      if (!before && !(await this.ctx.storage.get(`a:${entry.code}`))) {
        await this.ctx.storage.put(`a:${entry.code}`, Date.now())
        this.ctx.waitUntil(this.announce(entry))
      }
      return json({ ok: true }, 200)
    }
    if (url.pathname === '/drop' && request.method === 'POST') {
      const { code } = (await request.json()) as { code: string }
      await this.ctx.storage.delete(`t:${code}`)
      return json({ ok: true }, 200)
    }
    if (url.pathname === '/list') {
      const userId = url.searchParams.get('user') ?? ''
      const now = Date.now()
      const stored = await this.ctx.storage.list<OpenTableEntry>({ prefix: 't:' })
      const stale = [...stored].filter(([, e]) => openTableStale(e, now)).map(([k]) => k)
      // Their announced marks go with them.
      const marks = stale.map((k) => `a:${k.slice(2)}`)
      if (stale.length > 0) await this.ctx.storage.delete([...stale, ...marks].slice(0, 128))
      return json({ tables: openTablesFor([...stored.values()], userId, now) }, 200)
    }
    if (url.pathname === '/subscribe' && request.method === 'POST') {
      // Settings → Notifications → Open tables, on or off (index.ts).
      const { userId, on } = (await request.json()) as { userId?: string; on?: boolean }
      if (!userId) return json({ error: 'bad' }, 400)
      if (on) await this.ctx.storage.put(`s:${userId}`, 1)
      else await this.ctx.storage.delete(`s:${userId}`)
      return json({ ok: true }, 200)
    }
    return json({ error: 'not-found' }, 404)
  }

  /** Tell the host's friends and everybody who asked that a table just opened. */
  private async announce(entry: Omit<OpenTableEntry, 'openedAt'>): Promise<void> {
    try {
      const [friends, blockers, subs] = await Promise.all([
        friendsOf(this.env, entry.hostUserId),
        blockersOf(this.env, entry.hostUserId),
        this.ctx.storage.list({ prefix: 's:' }),
      ])
      const audience = tableAudience(
        entry.hostUserId,
        friends,
        [...subs.keys()].map((k) => k.slice(2)),
        [...entry.shut, ...blockers],
      )
      const seated = entry.people + entry.bots
      await Promise.all(
        audience.map(({ userId, friend }) => {
          const news: TableNews = {
            code: entry.code,
            name: entry.host.name,
            venueId: entry.venueId,
            buyIn: entry.buyIn,
            forRoll: entry.forRoll,
            slow: entry.kind === 'slow',
            seated,
            maxSeats: entry.maxSeats,
            friend,
          }
          return playerStub(this.env, userId)
            .fetch(`https://player/nudge/table?user=${encodeURIComponent(userId)}`, {
              method: 'POST',
              body: JSON.stringify(news),
            })
            .catch(() => null)
        }),
      )
    } catch (e) {
      console.error('open table not announced', { code: entry.code, error: String(e) })
    }
  }
}

export function lobbyStub(env: Env): DurableObjectStub {
  return env.LOBBY.get(env.LOBBY.idFromName('all'))
}
