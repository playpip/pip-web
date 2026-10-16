// The room server's front door.
//
//   POST /rooms               create a private room (a member's, with a token)
//   GET  /rooms/:code         what a code opens: the stake and who is waiting
//   GET  /rooms/:code/ws      the table's socket
//   GET  /queue/:venueId/ws   quick match at a ladder stake
//
// Every socket and every create is refused from an origin that is not the
// site's (ALLOWED_ORIGINS), so a page somewhere else cannot drive a table with
// a visitor's session.

import { cryptoInt } from '@/lib/cryptoRng'
import { normaliseRoomCode, newRoomCode } from '@/lib/multiplayer/code'
import { parseClientMessage } from '@/lib/multiplayer/protocol'
import { type RoomSettings, roomVenue } from '@/lib/multiplayer/room'
import { identify, isMember } from './auth'
import { blocksOf } from './safety'
import { corsHeaders, json, originAllowed, type Env } from './env'
import type { InitBody } from './room'

export { PokerRoom } from './room'
export { Matchmaker } from './matchmaker'

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
 * A member opens a room. The host is seated as it is created, so the room
 * exists with somebody in it from its first moment and the code they share
 * opens onto their face.
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

  const userId = await identify(token, env)
  if (!userId) return json({ error: 'auth' }, 401, cors)
  if (!(await isMember(userId, token, env))) return json({ error: 'members-only' }, 403, cors)
  const hostBlocks = await blocksOf(env, userId)

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRoomCode(cryptoInt)
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code))
    const init: InitBody = {
      code,
      kind: 'private',
      venueId: venue.id,
      host: { userId, name: hello.name, avatar: hello.avatar, ring: hello.ring },
      settings,
      hostBlocks,
    }
    const res = await stub.fetch('https://room/init', {
      method: 'POST',
      body: JSON.stringify(init),
    })
    if (res.status === 201) return json({ code }, 201, cors)
    if (res.status === 400) return json({ error: 'bad-settings' }, 400, cors)
  }
  return json({ error: 'busy' }, 503, cors)
}
