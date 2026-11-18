// Free hosting, asked of and spent on the player's own object (`player.ts`).
// The rules are `lib/multiplayer/freeRoom.ts`.

import type { FreeLeft } from '@/lib/multiplayer/freeRoom'
import { playerStub, type Env } from './env'
import type { FreeDaily } from './player'

function ask(env: Env, userId: string, path: string, body?: unknown): Promise<Response> {
  return playerStub(env, userId).fetch(
    `https://player/${path}?user=${encodeURIComponent(userId)}`,
    body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) },
  )
}

/** What is left of somebody's free hosting. */
export async function freeLeft(env: Env, userId: string): Promise<FreeLeft> {
  return (await (await ask(env, userId, 'free')).json()) as FreeLeft
}

/** A free one spent today, and the day it was last spent before, to hand it back. */
export interface FreeClaim {
  kind: FreeDaily
  previous: string | null
}

/** Spend this week's free room or today's quick match, or null when it is already spent. */
export async function claimFree(
  env: Env,
  userId: string,
  kind: FreeDaily,
): Promise<FreeClaim | null> {
  const claim = (await (await ask(env, userId, 'free/claim', { kind })).json()) as {
    ok: boolean
    previous?: string | null
  }
  return claim.ok ? { kind, previous: claim.previous ?? null } : null
}

/** The table could not be had after all: today's is theirs again. */
export async function releaseFree(env: Env, userId: string, claim: FreeClaim): Promise<void> {
  await ask(env, userId, 'free/release', claim)
}
