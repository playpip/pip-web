'use client'

// Your solo sessions, up to your games on the account (docs/games.md).
//
// The session the review keeps on the device (`lib/review/session`) is sent
// as it is played: its new hands a little after each one, and the ending as
// soon as there is one. What has gone up is remembered by hand number in
// `localStorage` `pip.gameSent`, so a send that fails is tried again with the
// next one. A guest's session stays on the device, as the review always has.
//
// Multiplayer games are not sent from here: the room server writes those
// (rooms/src/games.ts), so a slow game counts every hand on every device.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/sync/client'
import { loadReview, type ReviewSession } from '@/lib/review/session'
import { useSync } from '@/store/sync'

const KEY = 'pip.gameSent'
/** How long after a hand to send, so a session goes up in a few requests. */
const SEND_AFTER_MS = 20_000
/** Hands per request; the database takes at most 100. */
const BATCH = 50

interface Sent {
  key: string
  /** The last hand number gone up. */
  through: number
  ended: boolean
}

export function gameKey(session: Pick<ReviewSession, 'startedAt'>): string {
  return `solo:${session.startedAt}`
}

function readSent(): Sent | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Sent) : null
  } catch {
    return null
  }
}

function writeSent(sent: Sent): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sent))
  } catch {
    /* sent again next time, and kept once */
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
let sending: Promise<void> | null = null

/** After a hand: send soon. After an ending, or before a new sit-down: send now. */
export function queueGameUpload(now = false): void {
  if (useSync.getState().status !== 'signed-in') return
  if (now) {
    if (timer) clearTimeout(timer)
    timer = null
    // Read before the next sit-down replaces it.
    void sendSession(loadReview())
    return
  }
  if (!timer) {
    timer = setTimeout(() => {
      timer = null
      void sendSession(loadReview())
    }, SEND_AFTER_MS)
  }
}

async function sendSession(session: ReviewSession | null): Promise<void> {
  if (!session || session.room) return
  // One at a time: a second send waits and then finds less to do.
  while (sending) await sending
  const run = upload(session)
  sending = run
  try {
    await run
  } finally {
    sending = null
  }
}

async function upload(session: ReviewSession): Promise<void> {
  const sb = (await getSupabase()) as unknown as SupabaseClient | null
  if (!sb) return
  const key = gameKey(session)
  const prior = readSent()
  const sent: Sent = prior?.key === key ? prior : { key, through: -1, ended: false }
  const fresh = session.hands.filter((h) => h.record.handNo > sent.through)
  const ended = session.endedAt !== null
  if (fresh.length === 0 && (sent.ended || !ended)) return
  const game = {
    key,
    kind: session.cash ? 'cash' : 'tournament',
    venueId: session.venueId,
    title: session.venueName,
    accent: session.accent,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    outcome: session.outcome,
  }
  // The ending goes with the last batch, so a game is never closed short of hands.
  for (let i = 0; i === 0 || i < fresh.length; i += BATCH) {
    const batch = fresh.slice(i, i + BATCH)
    const last = i + BATCH >= fresh.length
    const { error } = await sb.rpc('save_game', {
      p_game: last ? game : { ...game, endedAt: null, outcome: null },
      p_hands: batch,
    })
    if (error) return
    if (batch.length > 0) sent.through = batch[batch.length - 1].record.handNo
    if (last) sent.ended = ended
    writeSent(sent)
  }
}
