// Take a signed-in player's rated hands and update their public Pip Rating.
//
// POST { hands: SubmittedHand[], name, avatar, hidden? } with the player's
// access token → { rating, peak, ratedDecisions, core, hidden }.
// POST { hands: [] } reads the stored row back without changing anything.
//
// **The client's number is never taken.** The function replays the decisions
// it is sent through the shared arithmetic (`_shared/rating.ts`) from its own
// stored state, after checking their shape, timing and rate. docs/rating.md
// lists every check and says plainly what they cannot stop: hands against the
// AI are played and priced on the device, so a determined cheat can send
// decisions that never happened.

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  cleanAvatar,
  cleanName,
  decideSubmission,
  parseCore,
  type PublicNumbers,
  RETRYABLE,
  type ServerState,
} from '../_shared/rating.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/** Service role: bypasses RLS. Never returned to a caller and never logged. */
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'signed-out' }, 401)
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth.user) return json({ error: 'signed-out' }, 401)
  const userId = auth.user.id

  let body: { hands?: unknown; name?: unknown; avatar?: unknown; hidden?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad-request' }, 400)
  }

  const [{ data: stateRow }, { data: publicRow }] = await Promise.all([
    admin.from('rating_state').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('ratings').select('*').eq('user_id', userId).maybeSingle(),
  ])

  const stored: ServerState | null = stateRow
    ? {
        core: parseCore(stateRow.core),
        lastHandAt: Number(stateRow.last_hand_at) || 0,
        lastSubmitAt: stateRow.last_submit_at ? Date.parse(stateRow.last_submit_at) : null,
        hourStart: stateRow.hour_start ? Date.parse(stateRow.hour_start) : null,
        hourDecisions: stateRow.hour_decisions ?? 0,
        rejected: stateRow.rejected ?? 0,
      }
    : null
  const row: PublicNumbers | null = publicRow
    ? {
        rating: publicRow.rating,
        peak: publicRow.peak,
        ratedDecisions: publicRow.rated_decisions,
        weekStart: publicRow.week_start,
        weekStartRating: publicRow.week_start_rating,
        flagged: publicRow.flagged,
      }
    : null
  const hidden = typeof body.hidden === 'boolean' ? body.hidden : (publicRow?.hidden ?? false)

  // Nothing to count: read back, and apply a change to "hide me" if one came.
  if (Array.isArray(body.hands) && body.hands.length === 0) {
    if (publicRow && hidden !== publicRow.hidden) {
      await admin.from('ratings').update({ hidden }).eq('user_id', userId)
    }
    return json({
      rating: row?.rating ?? null,
      peak: row?.peak ?? null,
      ratedDecisions: row?.ratedDecisions ?? 0,
      core: stored?.core ?? null,
      hidden,
    })
  }

  const now = Date.now()
  const result = decideSubmission(body.hands, stored, row, now)
  const toRow = (s: ServerState) => ({
    user_id: userId,
    core: s.core,
    last_hand_at: s.lastHandAt,
    last_submit_at: s.lastSubmitAt === null ? null : new Date(s.lastSubmitAt).toISOString(),
    hour_start: s.hourStart === null ? null : new Date(s.hourStart).toISOString(),
    hour_decisions: s.hourDecisions,
    rejected: s.rejected,
  })

  if (!result.ok) {
    if (stored || result.state.rejected > 0)
      await admin.from('rating_state').upsert(toRow(result.state))
    const retry = RETRYABLE.includes(result.reason)
    return json({ error: result.reason, retry }, retry ? 429 : 422)
  }

  const { numbers } = result
  const { error: stateError } = await admin.from('rating_state').upsert(toRow(result.state))
  if (stateError) {
    console.error(`submit-rating: state for ${userId} failed:`, stateError)
    return json({ error: 'unavailable', retry: true }, 503)
  }
  const { error: rowError } = await admin.from('ratings').upsert({
    user_id: userId,
    display_name: cleanName(body.name),
    avatar: cleanAvatar(body.avatar),
    rating: numbers.rating,
    peak: numbers.peak,
    rated_decisions: numbers.ratedDecisions,
    week_start: numbers.weekStart,
    week_start_rating: numbers.weekStartRating,
    hidden,
    flagged: numbers.flagged,
    updated_at: new Date(now).toISOString(),
  })
  if (rowError) {
    console.error(`submit-rating: row for ${userId} failed:`, rowError)
    return json({ error: 'unavailable', retry: true }, 503)
  }
  // Whoever this climbed past hears about it (the room server sends it).
  // Never allowed to fail the submission.
  if (!hidden && !numbers.flagged && row && numbers.rating > row.rating) {
    await notePassed(userId, cleanName(body.name), row.rating, numbers.rating).catch((e) =>
      console.error('submit-rating: passed notices failed:', e),
    )
  }
  return json({
    rating: numbers.rating,
    peak: numbers.peak,
    ratedDecisions: numbers.ratedDecisions,
    core: result.state.core,
    hidden,
    clamped: result.clamped,
  })
})

/** At most this many players are told about one climb: the nearest ones. */
const PASSED_MAX = 10

/**
 * Queue a `passed` push for everyone on the board at or above `from` and now
 * below `to`, each with the place it leaves them in.
 */
async function notePassed(userId: string, name: string, from: number, to: number): Promise<void> {
  const { data: passed } = await admin
    .from('ratings')
    .select('user_id, rating')
    .eq('hidden', false)
    .eq('flagged', false)
    .neq('user_id', userId)
    .gte('rating', from)
    .lt('rating', to)
    .order('rating', { ascending: false })
    .limit(PASSED_MAX)
  if (!passed?.length) return
  const rows = await Promise.all(
    passed.map(async (p) => {
      const { count } = await admin
        .from('ratings')
        .select('user_id', { count: 'exact', head: true })
        .eq('hidden', false)
        .eq('flagged', false)
        .gt('rating', p.rating)
      return {
        user_id: p.user_id,
        kind: 'passed',
        payload: { name, rank: count === null ? null : count + 1 },
      }
    }),
  )
  const { error } = await admin.from('push_outbox').insert(rows)
  if (error) throw error
}
