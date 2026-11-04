'use client'

// The Pip Rating's network half (docs/rating.md): send this device's rated
// hands to `submit-rating`, and read the public board. Reads only; nothing here
// writes a table (tests/rating.test.ts holds that).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AvatarSpec } from '@/lib/avatar'
import { getSupabase } from '@/lib/sync/client'
import { dropThrough, readQueue } from './queue'

/** The untyped client: the ratings tables are newer than the generated types. */
async function client(): Promise<SupabaseClient | null> {
  return (await getSupabase()) as unknown as SupabaseClient | null
}

export interface ServerRating {
  rating: number | null
  peak: number | null
  ratedDecisions: number
  core: unknown
  hidden: boolean
}

let sending = false

/**
 * Send what is queued, or (with nothing queued, or `read`) ask for the stored
 * row. Fire-and-forget like sync: a failure keeps the hands for next time.
 * Returns the server's numbers, or null when there was nothing to learn.
 */
export async function submitRating(who: {
  name: string
  avatar: AvatarSpec | null
  hidden: boolean
}): Promise<ServerRating | null> {
  if (sending) return null
  const sb = await client()
  if (!sb) return null
  const { data: session } = await sb.auth.getSession()
  if (!session.session) return null
  sending = true
  try {
    const hands = readQueue()
    const { data, error } = await sb.functions.invoke<ServerRating & { error?: string }>(
      'submit-rating',
      { body: { hands, name: who.name, avatar: who.avatar, hidden: who.hidden } },
    )
    if (error) {
      const reason = await (error as { context?: Response }).context
        ?.json()
        .then((b: { retry?: boolean }) => b)
        .catch(() => undefined)
      // Refused for good (already counted, malformed): drop them, or they block the queue.
      if (reason && reason.retry === false && hands.length > 0) {
        dropThrough(hands[hands.length - 1].at)
      }
      return null
    }
    if (hands.length > 0) dropThrough(hands[hands.length - 1].at)
    return data ?? null
  } catch {
    return null
  } finally {
    sending = false
  }
}

/** One row of the board: a face, a name and a rating, nothing else. */
export interface BoardRow {
  userId: string
  name: string
  avatar: AvatarSpec | null
  rating: number
  weekGain: number
}

const COLUMNS = 'user_id, display_name, avatar, rating, week_gain'

type Raw = {
  user_id: string
  display_name: string
  avatar: AvatarSpec | null
  rating: number
  week_gain: number
}

const toRow = (r: Raw): BoardRow => ({
  userId: r.user_id,
  name: r.display_name,
  avatar: r.avatar,
  rating: r.rating,
  weekGain: r.week_gain,
})

export interface Board {
  top: BoardRow[]
  climbers: BoardRow[]
  /** The caller's place and the rows either side, when they are on the board. */
  around: { place: number; firstPlace: number; rows: BoardRow[] } | null
}

/** The top 100, this week's climbers, and the rows around the caller. */
export async function readBoard(weekStart: string): Promise<Board | null> {
  if (process.env.NEXT_PUBLIC_RATING_DEMO === '1') return (await import('./demo')).demoBoard()
  const sb = await client()
  if (!sb) return null
  const visible = () => sb.from('ratings').select(COLUMNS).eq('hidden', false).eq('flagged', false)
  const [top, climbers, session] = await Promise.all([
    visible().order('rating', { ascending: false }).limit(100),
    visible()
      .eq('week_start', weekStart)
      .gt('week_gain', 0)
      .order('week_gain', { ascending: false })
      .limit(10),
    sb.auth.getSession(),
  ])
  if (top.error || climbers.error) return null
  const board: Board = {
    top: (top.data as Raw[]).map(toRow),
    climbers: (climbers.data as Raw[]).map(toRow),
    around: null,
  }
  const me = session.data.session?.user.id
  if (me) {
    const { data: mine } = await sb
      .from('ratings')
      .select('rating, hidden, flagged')
      .eq('user_id', me)
      .maybeSingle()
    if (mine && !mine.hidden && !mine.flagged) {
      const [{ count }, above, below] = await Promise.all([
        sb
          .from('ratings')
          .select('user_id', { count: 'exact', head: true })
          .eq('hidden', false)
          .eq('flagged', false)
          .gt('rating', mine.rating),
        visible().gt('rating', mine.rating).order('rating', { ascending: true }).limit(2),
        visible()
          .lte('rating', mine.rating)
          .neq('user_id', me)
          .order('rating', { ascending: false })
          .limit(2),
      ])
      const self = (await visible().eq('user_id', me).maybeSingle()).data as Raw | null
      if (self) {
        const over = ((above.data as Raw[]) ?? []).reverse()
        const place = (count ?? 0) + 1
        board.around = {
          place,
          firstPlace: place - over.length,
          rows: [...over, self, ...((below.data as Raw[]) ?? [])].map(toRow),
        }
      }
    }
  }
  return board
}

/** Calls `onChange` whenever a visible row changes, until the returned function is called. */
export async function watchBoard(onChange: () => void): Promise<() => void> {
  const sb = await client()
  if (!sb) return () => {}
  // A name of its own each time: the client keeps channels by name, and a
  // second watcher (a remount, or React running an effect twice) reusing one
  // that is already subscribed throws instead of listening.
  const channel = sb
    .channel(`ratings-board-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ratings' }, onChange)
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
