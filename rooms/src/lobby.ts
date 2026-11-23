// The open tables list (src/lib/multiplayer/openTables.ts). One object, named "all".
//
// Every listed room tells it what it looks like after each change
// (`PokerRoom.save`): `put` while it waits for the deal with a chair free,
// `drop` once it is dealt, full or closed. A room that dies without saying so
// (an object evicted mid-write) ages off on its own idle clock.

import { DurableObject } from 'cloudflare:workers'
import { type OpenTableEntry, openTableStale, openTablesFor } from '@/lib/multiplayer/openTables'
import { json, type Env } from './env'

export class Lobby extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/put' && request.method === 'POST') {
      const entry = (await request.json()) as Omit<OpenTableEntry, 'openedAt'>
      const key = `t:${entry.code}`
      const before = await this.ctx.storage.get<OpenTableEntry>(key)
      await this.ctx.storage.put(key, { ...entry, openedAt: before?.openedAt ?? Date.now() })
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
      if (stale.length > 0) await this.ctx.storage.delete(stale.slice(0, 128))
      return json({ tables: openTablesFor([...stored.values()], userId, now) }, 200)
    }
    return json({ error: 'not-found' }, 404)
  }
}

export function lobbyStub(env: Env): DurableObjectStub {
  return env.LOBBY.get(env.LOBBY.idFromName('all'))
}
