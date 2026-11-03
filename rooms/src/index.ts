// The room server's front door.
//
//   POST /rooms               create a private room or slow game (a member's, or a free one)
//   GET  /free                what is left of your free hosting (a token)
//   GET  /rooms/:code         what a code opens: the stake and who is waiting
//   GET  /rooms/:code/ws      the table's socket
//   GET  /queue/:venueId/ws   quick match at a ladder stake
//   GET  /slow                your slow games, as mini tables (a token)
//   POST /slow/dismiss        swipe a finished one away, or leave one waiting for players
//   GET  /notify/prefs        Settings → Notifications, and your devices
//   POST /notify/prefs        save them; a running game's clock follows
//   POST /notify/devices      allow pushes on this device
//   POST /notify/devices/remove
//   GET  /notify/key          the web push (VAPID) public key
//   GET|POST /notify/off      the "stop these emails" link (signed, no token)
//   GET  /hands               the hands-played count (the landing page reads it)
//   POST /hands               the game's hands against the cast, a batch at a time
//
// Every socket and every create is refused from an origin that is not the
// site's (ALLOWED_ORIGINS), so a page somewhere else cannot drive a table with
// a visitor's session.

import { cryptoInt } from '@/lib/cryptoRng'
import { hostingAllowance } from '@/lib/multiplayer/freeRoom'
import { normaliseRoomCode, newRoomCode } from '@/lib/multiplayer/code'
import { parseClientMessage } from '@/lib/multiplayer/protocol'
import { type RoomKind, type RoomSettings, roomVenue } from '@/lib/multiplayer/room'
import { parseDevice, parsePrefs, quietOf } from '@/lib/multiplayer/notices'
import { MAX_SLOW_GAMES } from '@/lib/multiplayer/slow'
import { identify, isMember } from './auth'
import { claimFree, freeLeft, releaseFree } from './free'
import { blocksOf } from './safety'
import { corsHeaders, json, originAllowed, playerStub, type Env } from './env'
import { offLinkValid } from './notify'
import type { InitBody } from './room'
import { tallyStub } from './tally'

export { PokerRoom } from './room'
export { Matchmaker } from './matchmaker'
export { Player } from './player'
export { Tally } from './tally'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const cors = corsHeaders(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const parts = url.pathname.split('/').filter(Boolean)

    // `uploaded` is when the running version went up: a merge to
    // src/lib/poker or src/lib/multiplayer after it is not on the tables yet.
    if (parts[0] === 'health') {
      return json({ ok: true, uploaded: env.VERSION?.timestamp ?? null }, 200, cors)
    }

    if (parts[0] === 'hands' && parts.length === 1) {
      if (request.method === 'GET') {
        const res = await tallyStub(env).fetch('https://tally/read')
        return json(await res.json(), 200, { ...cors, 'Cache-Control': 'public, max-age=300' })
      }
      if (request.method === 'POST') {
        if (!originAllowed(request, env)) return json({ error: 'origin' }, 403)
        const body = (await request.json().catch(() => null)) as { n?: unknown } | null
        const res = await tallyStub(env).fetch('https://tally/add', {
          method: 'POST',
          body: JSON.stringify({
            bucket: 'ai',
            n: body?.n,
            ip: request.headers.get('CF-Connecting-IP') ?? '',
          }),
        })
        return new Response(null, { status: res.ok ? 204 : res.status, headers: cors })
      }
    }

    if (parts[0] === 'rooms' && parts.length === 1 && request.method === 'POST') {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403)
      return createRoom(request, env, cors)
    }

    if (parts[0] === 'rooms' && parts[1]) {
      const code = normaliseRoomCode(parts[1])
      if (!code) return json({ error: 'no-room' }, 404, cors)
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code))
      if (parts.length === 2 && request.method === 'GET') {
        const res = await stub.fetch('https://room/peek')
        return new Response(res.body, {
          status: res.status,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      if (parts[2] === 'ws') {
        if (!originAllowed(request, env)) return new Response(null, { status: 403 })
        return stub.fetch(new Request('https://room/ws', request))
      }
    }

    if (parts[0] === 'notify' && parts[1] === 'off') return emailOff(url, env)
    if (parts[0] === 'notify' && parts[1] === 'key' && request.method === 'GET') {
      return json({ key: env.VAPID_PUBLIC_KEY ?? null }, 200, cors)
    }
    if (
      parts[0] === 'slow' ||
      parts[0] === 'notify' ||
      parts[0] === 'free' ||
      parts[0] === 'free-room'
    ) {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403)
      return mine(request, env, cors, parts)
    }

    if (parts[0] === 'queue' && parts[1] && parts[2] === 'ws') {
      if (!originAllowed(request, env)) return new Response(null, { status: 403 })
      const venue = roomVenue(parts[1])
      if (!venue) return new Response(null, { status: 404 })
      const stub = env.QUEUES.get(env.QUEUES.idFromName(venue.id))
      return stub.fetch(new Request(`https://queue/ws?venue=${venue.id}`, request))
    }

    return json({ error: 'not-found' }, 404, cors)
  },
} satisfies ExportedHandler<Env>

/**
 * A member, or somebody spending a free one, opens a room or a slow game. The host is
 * seated as it is created, so the room exists with somebody in it from its
 * first moment and the code they share opens onto their face.
 */
async function createRoom(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'bad-message' }, 400, cors)
  }
  // The same checks a socket's hello goes through: name, face, ring.
  const hello = parseClientMessage(
    JSON.stringify({ t: 'hello', token, name: body.name, avatar: body.avatar, ring: body.ring }),
  )
  const venue = typeof body.venueId === 'string' ? roomVenue(body.venueId) : undefined
  if (hello?.t !== 'hello' || !venue) return json({ error: 'bad-message' }, 400, cors)
  // The host's rules, through the same checks a socket's message would get.
  let settings: Partial<RoomSettings> | undefined
  if (body.settings !== undefined) {
    const parsed = parseClientMessage(JSON.stringify({ t: 'configure', settings: body.settings }))
    if (parsed?.t !== 'configure') return json({ error: 'bad-settings' }, 400, cors)
    settings = parsed.settings
  }

  const kind: RoomKind = body.kind === 'slow' ? 'slow' : 'private'

  const userId = await identify(token, env)
  if (!userId) return json({ error: 'auth' }, 401, cors)
  const member = await isMember(userId, token, env)
  // Without the membership: the free one of this kind. Today's room is
  // claimed now so two tabs cannot both have it, and handed back below if the
  // room cannot be opened. A slow game is free while they host no other.
  let release = async () => {}
  if (!member) {
    const allowed = hostingAllowance({ member, kind, left: await freeLeft(env, userId) })
    if (allowed !== 'free') return json({ error: allowed }, 403, cors)
    if (kind === 'private') {
      const claimed = await claimFree(env, userId, 'room')
      if (!claimed) return json({ error: 'free-room-used' }, 403, cors)
      release = () => releaseFree(env, userId, claimed)
    }
  }
  if (kind === 'slow') {
    const res = await player(env, userId, 'open')
    const { open } = (await res.json()) as { open: number }
    if (open >= MAX_SLOW_GAMES) return json({ error: 'too-many' }, 409, cors)
  }
  const hostBlocks = await blocksOf(env, userId)

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRoomCode(cryptoInt)
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code))
    const init: InitBody = {
      code,
      kind,
      venueId: venue.id,
      host: { userId, name: hello.name, avatar: hello.avatar, ring: hello.ring },
      settings,
      hostBlocks,
      // The host's membership decides the table: without it, at most four
      // seats and no camera or voice (Will, 2026-11-02).
      freeHost: !member,
    }
    const res = await stub.fetch('https://room/init', {
      method: 'POST',
      body: JSON.stringify(init),
    })
    if (res.status === 201) return json({ code }, 201, cors)
    if (res.status === 400) {
      await release()
      return json({ error: 'bad-settings' }, 400, cors)
    }
  }
  await release()
  return json({ error: 'busy' }, 503, cors)
}

function player(env: Env, userId: string, path: string, body?: unknown): Promise<Response> {
  return playerStub(env, userId).fetch(
    `https://player/${path}?user=${encodeURIComponent(userId)}`,
    body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) },
  )
}

/** The signed-in player's own things: their slow games and their notification settings. */
async function mine(
  request: Request,
  env: Env,
  cors: Record<string, string>,
  parts: string[],
): Promise<Response> {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const userId = token ? await identify(token, env) : null
  if (!userId) return json({ error: 'auth' }, 401, cors)
  const route = `${request.method} /${parts.join('/')}`
  const read = async (): Promise<unknown> => {
    try {
      return await request.json()
    } catch {
      return null
    }
  }
  const relay = async (res: Response) =>
    new Response(res.body, {
      status: res.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  switch (route) {
    case 'GET /free':
      return json(await freeLeft(env, userId), 200, cors)
    // The page before 2026-10-25 asks this; a cached copy can still be open.
    case 'GET /free-room':
      return json({ spent: !(await freeLeft(env, userId)).room }, 200, cors)
    case 'GET /slow':
      return relay(await player(env, userId, 'games'))
    case 'POST /slow/dismiss': {
      const body = (await read()) as { code?: unknown } | null
      const code = typeof body?.code === 'string' ? normaliseRoomCode(body.code) : null
      if (!code) return json({ error: 'bad-message' }, 400, cors)
      // A game still waiting for players: leave it first. Its seat goes, and
      // an empty one closes, which also takes it off their list.
      const res = await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch('https://room/leave', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      })
      const { left } = (await res.json()) as { left?: boolean }
      return relay(await player(env, userId, 'dismiss', { code, left: left === true }))
    }
    case 'GET /notify/prefs':
      return relay(await player(env, userId, 'prefs'))
    case 'POST /notify/prefs': {
      const prefs = parsePrefs(await read())
      if (!prefs) return json({ error: 'bad-message' }, 400, cors)
      const res = await player(env, userId, 'prefs', prefs)
      const { rooms } = (await res.json()) as { rooms: string[] }
      // Every game still running moves its clock to the new hours.
      await Promise.all(
        rooms.map((code) =>
          env.ROOMS.get(env.ROOMS.idFromName(code))
            .fetch('https://room/quiet', {
              method: 'POST',
              body: JSON.stringify({ userId, quiet: quietOf(prefs) }),
            })
            .catch(() => null),
        ),
      )
      return json({ prefs }, 200, cors)
    }
    case 'POST /notify/devices': {
      const device = parseDevice(await read())
      if (!device) return json({ error: 'bad-message' }, 400, cors)
      return relay(await player(env, userId, 'devices', device))
    }
    case 'POST /notify/devices/remove': {
      const body = (await read()) as { id?: unknown } | null
      if (typeof body?.id !== 'string' || body.id.length > 1024) {
        return json({ error: 'bad-message' }, 400, cors)
      }
      return relay(await player(env, userId, 'devices/remove', { id: body.id }))
    }
  }
  return json({ error: 'not-found' }, 404, cors)
}

/**
 * The "stop these emails" link. Signed with the account id, so it works from
 * an inbox with no session, and nobody can make one for somebody else. A mail
 * provider's one-click POST turns them off the same way a visit does.
 */
async function emailOff(url: URL, env: Env): Promise<Response> {
  const userId = url.searchParams.get('u') ?? ''
  const sig = url.searchParams.get('s') ?? ''
  const ok = userId.length > 0 && userId.length <= 64 && (await offLinkValid(env, userId, sig))
  if (ok) await player(env, userId, 'email-off', {})
  const text = ok
    ? 'Done. Pip won’t email you about your games. Turn it back on in Settings.'
    : 'That link has expired. Turn emails off in Pip, under Settings.'
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Pip</title></head><body style="margin:0;background:#0a0a0a;color:#ededed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box"><p style="max-width:360px;font-size:17px;line-height:1.5;text-align:center">${text}</p></body></html>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
