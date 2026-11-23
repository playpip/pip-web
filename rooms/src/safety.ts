// Reports and blocks, kept on Supabase where they outlive the room, and who
// an account's friends are, for telling them about its open tables.
//
// Written with the service role into tables no client can read
// (supabase/migrations/20261011090000_player_safety.sql). Best effort: a
// report that cannot be stored is logged instead, so it is never silently
// lost, and a failure never breaks the table.

import type { ReportReason } from '@/lib/multiplayer/protocol'
import type { Env } from './env'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function headers(env: Env): Record<string, string> | null {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!env.SUPABASE_URL || !key) return null
  return key.startsWith('eyJ')
    ? { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
    : { apikey: key, 'Content-Type': 'application/json' }
}

export async function saveReport(
  env: Env,
  report: { reporter: string; reported: string; roomCode: string; reason: ReportReason },
): Promise<void> {
  // Logged either way: the Worker's logs are the record if the insert fails.
  console.log(JSON.stringify({ kind: 'player-report', ...report }))
  const h = headers(env)
  if (!h || !UUID.test(report.reporter) || !UUID.test(report.reported)) return
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/player_reports`, {
      method: 'POST',
      headers: { ...h, Prefer: 'return=minimal' },
      body: JSON.stringify({
        reporter: report.reporter,
        reported: report.reported,
        room_code: report.roomCode,
        reason: report.reason,
      }),
    })
    if (!res.ok) console.error('player-report not stored', res.status, await res.text())
  } catch (e) {
    console.error('player-report not stored', String(e))
  }
}

export async function saveBlock(env: Env, blocker: string, blocked: string): Promise<void> {
  const h = headers(env)
  if (!h || !UUID.test(blocker) || !UUID.test(blocked)) return
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/player_blocks`, {
      method: 'POST',
      headers: { ...h, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ blocker, blocked }),
    })
    if (!res.ok) console.error('player-block not stored', res.status, await res.text())
  } catch (e) {
    console.error('player-block not stored', String(e))
  }
}

/** Everybody this account has blocked, for a room it is opening. */
export async function blocksOf(env: Env, userId: string): Promise<string[]> {
  const h = headers(env)
  if (!h || !UUID.test(userId)) return []
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/player_blocks?blocker=eq.${userId}&select=blocked`,
      { headers: h },
    )
    if (!res.ok) return []
    return ((await res.json()) as { blocked: string }[]).map((r) => r.blocked)
  } catch {
    return []
  }
}

/** Everybody who has blocked this account: they never hear about its tables. */
export async function blockersOf(env: Env, userId: string): Promise<string[]> {
  const h = headers(env)
  if (!h || !UUID.test(userId)) return []
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/player_blocks?blocked=eq.${userId}&select=blocker`,
      { headers: h },
    )
    if (!res.ok) return []
    return ((await res.json()) as { blocker: string }[]).map((r) => r.blocker)
  } catch {
    return []
  }
}

/** This account's friends (accepted, not pending), for telling them it opened a table. */
export async function friendsOf(env: Env, userId: string): Promise<string[]> {
  const h = headers(env)
  if (!h || !UUID.test(userId)) return []
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/friendships?status=eq.friends&or=(user_a.eq.${userId},user_b.eq.${userId})&select=user_a,user_b`,
      { headers: h },
    )
    if (!res.ok) return []
    return ((await res.json()) as { user_a: string; user_b: string }[]).map((r) =>
      r.user_a === userId ? r.user_b : r.user_a,
    )
  } catch {
    return []
  }
}
