'use client'

// Reading games back (docs/games.md): your own list, a player's list, and one
// game with its hands, as the `ReviewSession` the review screen plays.
// Everything goes through supabase/migrations/20261127120000_games.sql, which
// decides who may see what.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/sync/client'
import type { ReviewHand, ReviewSession, SessionOutcome } from '@/lib/review/session'

export type GameKind = 'cash' | 'tournament' | 'private' | 'open' | 'slow'

export interface GameRow {
  id: string
  kind: GameKind
  venueId: string
  title: string
  accent: string
  startedAt: number
  endedAt: number | null
  outcome: SessionOutcome | null
  hands: number
  net: number
}

/** A game opened for review, and whose it is. */
export interface OpenedGame {
  session: ReviewSession
  mine: boolean
  owner: { handle: string; name: string } | null
}

export const GAME_KINDS: { id: GameKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'cash', label: 'Cash' },
  { id: 'tournament', label: 'Tournaments' },
  { id: 'slow', label: 'Slow' },
  { id: 'private', label: 'Private' },
  { id: 'open', label: 'Open' },
]

async function client(): Promise<SupabaseClient | null> {
  return (await getSupabase()) as unknown as SupabaseClient | null
}

const time = (v: unknown): number | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const t = typeof v === 'number' ? v : Date.parse(v)
  return Number.isFinite(t) ? t : null
}

function parseOutcome(v: unknown): SessionOutcome | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
  if (o.kind === 'won') return { kind: 'won', seats: n(o.seats) ?? 0 }
  if (o.kind === 'busted') return { kind: 'busted', place: n(o.place), seats: n(o.seats) ?? 0 }
  if (o.kind === 'stood-up') return { kind: 'stood-up', rollDelta: n(o.rollDelta) ?? 0 }
  return null
}

const KINDS: readonly GameKind[] = ['cash', 'tournament', 'private', 'open', 'slow']

function parseRow(v: unknown): GameRow | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const startedAt = time(o.started_at ?? o.startedAt)
  if (typeof o.id !== 'string' || startedAt === null) return null
  if (!KINDS.includes(o.kind as GameKind)) return null
  return {
    id: o.id,
    kind: o.kind as GameKind,
    venueId: String(o.venue_id ?? o.venueId ?? ''),
    title: String(o.title ?? ''),
    accent: typeof o.accent === 'string' ? o.accent : '#7C8CF0',
    startedAt,
    endedAt: time(o.ended_at ?? o.endedAt),
    outcome: parseOutcome(o.outcome),
    hands: Number(o.hands) || 0,
    net: Number(o.net) || 0,
  }
}

const PAGE = 30

/**
 * A page of games, newest first: yours when `handle` is null, otherwise that
 * player's. Null when there is nobody to show or they keep their games to
 * themselves; undefined when Pip could not be reached.
 */
export async function listGames(
  handle: string | null,
  before: number | null = null,
): Promise<GameRow[] | null | undefined> {
  const sb = await client()
  if (!sb) return undefined
  if (handle === null) {
    let q = sb
      .from('games')
      .select('id, kind, venue_id, title, accent, started_at, ended_at, outcome, hands, net')
      .gt('hands', 0)
      .order('started_at', { ascending: false })
      .limit(PAGE)
    if (before !== null) q = q.lt('started_at', new Date(before).toISOString())
    const { data, error } = await q
    if (error) return undefined
    return (data ?? []).map(parseRow).filter((r): r is GameRow => r !== null)
  }
  const { data, error } = await sb.rpc('player_games', {
    p_handle: handle,
    p_before: before === null ? null : new Date(before).toISOString(),
  })
  if (error) return undefined
  if (data === null) return null
  return (Array.isArray(data) ? data : []).map(parseRow).filter((r): r is GameRow => r !== null)
}

export const GAMES_PAGE = PAGE

/** One game with its hands. Null when it is not there for you; undefined offline. */
export async function openGame(id: string): Promise<OpenedGame | null | undefined> {
  const sb = await client()
  if (!sb) return undefined
  const { data, error } = await sb.rpc('get_game', { p_game: id })
  if (error) return undefined
  const row = parseRow(data)
  if (!row || !data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const hands = (Array.isArray(o.hands) ? o.hands : []).filter(
    (h): h is ReviewHand =>
      !!h &&
      typeof h === 'object' &&
      !!(h as ReviewHand).record &&
      Array.isArray((h as ReviewHand).record.events) &&
      Array.isArray((h as ReviewHand).decisions),
  )
  const owner =
    o.owner && typeof o.owner === 'object'
      ? {
          handle: String((o.owner as Record<string, unknown>).handle ?? ''),
          name: String((o.owner as Record<string, unknown>).name ?? ''),
        }
      : null
  return {
    mine: o.mine === true,
    owner,
    session: {
      venueId: row.venueId,
      venueName: row.title,
      accent: row.accent,
      cash: row.kind === 'cash',
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      outcome: row.outcome,
      hands,
      dropped: 0,
      ...(o.mine !== true && owner ? { owner } : {}),
    },
  }
}

/** "Won", "4th of 6", "+1,240": what a game came to, in a word or two. */
export function resultOf(
  game: Pick<GameRow, 'outcome' | 'net' | 'kind' | 'endedAt'>,
  money: (n: number) => string,
): { text: string; tone: 'good' | 'bad' | 'plain' } {
  const o = game.outcome
  if (o?.kind === 'won') return { text: 'Won', tone: 'good' }
  if (o?.kind === 'busted') {
    return { text: o.place ? `${ordinal(o.place)} of ${o.seats}` : 'Out', tone: 'bad' }
  }
  const chips = o?.kind === 'stood-up' ? o.rollDelta : game.net
  if (game.endedAt === null && game.kind !== 'cash') return { text: 'In play', tone: 'plain' }
  return {
    text: `${chips > 0 ? '+' : ''}${money(chips)}`,
    tone: chips > 0 ? 'good' : chips < 0 ? 'bad' : 'plain',
  }
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
