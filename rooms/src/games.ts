// Every finished hand, into each person's games (docs/games.md), and their
// rated decisions into the Pip Rating's inbox (docs/rating.md). What goes is
// built by `seatEntries` (src/lib/multiplayer/games.ts); this sends it.
//
// **The rating counts hands the server dealt.** That is the point of rating
// multiplayer at all: nobody's device priced these, so nobody's device can
// make them up. `submit-rating` counts the inbox the next time the player's
// rating is read or sent.
//
// Best effort, like the hands count: a write that fails never holds up a table.

import { seatEntries } from '@/lib/multiplayer/games'
import type { RoomState } from '@/lib/multiplayer/room'
import type { Env } from './env'
import { serviceHeaders } from './notify'

export async function recordRoomHand(env: Env, room: RoomState, now: number): Promise<void> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return
  try {
    const seats = seatEntries(room, now)
    if (seats.length === 0) return
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/record_room_hands`, {
      method: 'POST',
      headers: {
        ...serviceHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_seats: seats }),
    })
    if (!res.ok) {
      console.error('room hand not kept', {
        code: room.code,
        status: res.status,
        body: (await res.text()).slice(0, 300),
      })
    }
  } catch (e) {
    console.error('room hand not kept', { code: room.code, error: String(e) })
  }
}
