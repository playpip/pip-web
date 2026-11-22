'use client'

// Friends, profiles and the inbox: the network half (docs/social.md).
//
// Every call is a function in supabase/migrations/20261122180000_social.sql,
// which takes the caller from their session and refuses anything they may not
// do. A refusal comes back as a short code; `problemOf` turns it into words.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AvatarSpec } from '@/lib/avatar'
import { syncConfigured, getSupabase } from '@/lib/sync/client'
import { type Card, type ShowKey, parseCard, parseShown } from './card'

/** Switched on per build, like the rating, until the backend is live. */
export function socialEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOCIAL === '1' && syncConfigured()
}

/** The untyped client: these tables are newer than the generated types. */
async function client(): Promise<SupabaseClient | null> {
  return (await getSupabase()) as unknown as SupabaseClient | null
}

export type Relation = 'self' | 'friends' | 'sent' | 'received' | 'none'

/** Somebody in a list: a face, a name and a handle. */
export interface PlayerRow {
  handle: string
  name: string
  avatar: AvatarSpec | null
  ring: string | null
}

export interface Player extends PlayerRow {
  bio: string
  shown: ShowKey[]
  card: Card
  rating: { rating: number; peak: number; decisions: number } | null
  relation: Relation
  friendsSince: string | null
  searchable: boolean
  /** A featured player's label ("Made Pip"), or null. */
  featured: string | null
}

export interface MyProfile extends PlayerRow {
  bio: string
  shown: ShowKey[]
  searchable: boolean
}

export type Result<T> = { ok: true; value: T } | { ok: false; problem: string }

const PROBLEMS: Record<string, string> = {
  auth: 'Sign in again to do that.',
  'handle-shape': 'A handle is 3 to 20 letters, numbers or underscores.',
  'handle-taken': 'That handle is taken.',
  'handle-word': 'Pick a different handle.',
  'name-shape': 'Your name needs 1 to 24 characters.',
  'name-word': 'Pick a different name.',
  'bio-long': 'Your bio can be 160 characters at most.',
  'bio-word': 'Your bio has a word Pip won’t show.',
  'bio-link': 'Links can’t go in a bio.',
  'avatar-shape': 'Your avatar couldn’t be saved.',
  'no-profile': 'Choose a handle first.',
  'not-found': 'That player isn’t here.',
  'slow-down': 'That’s a lot at once. Try again later.',
  'too-many': 'That’s the most there can be.',
  offline: 'Couldn’t reach Pip. Check your connection and try again.',
}

export function problemOf(code: string): string {
  return PROBLEMS[code] ?? PROBLEMS.offline
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<Result<T>> {
  const sb = await client()
  if (!sb) return { ok: false, problem: problemOf('offline') }
  try {
    const { data, error } = await sb.rpc(fn, args)
    if (error) return { ok: false, problem: problemOf(error.message) }
    return { ok: true, value: data as T }
  } catch {
    return { ok: false, problem: problemOf('offline') }
  }
}

type RawRow = {
  handle: string
  display_name: string
  avatar: AvatarSpec | null
  ring: string | null
}

const toRow = (r: RawRow): PlayerRow => ({
  handle: r.handle,
  name: r.display_name,
  avatar: r.avatar,
  ring: r.ring,
})

// --- your profile -------------------------------------------------------------

/** Your own public profile, or null when you haven't made one. Undefined: couldn't ask. */
export async function readMyProfile(): Promise<MyProfile | null | undefined> {
  const sb = await client()
  if (!sb) return undefined
  const { data: session } = await sb.auth.getSession()
  const me = session.session?.user.id
  if (!me) return undefined
  const { data, error } = await sb
    .from('player_profiles')
    .select('handle, display_name, avatar, ring, bio, shown, searchable')
    .eq('user_id', me)
    .maybeSingle()
  if (error) return undefined
  if (!data) return null
  return {
    ...toRow(data as RawRow),
    bio: data.bio as string,
    shown: parseShown(data.shown),
    searchable: data.searchable as boolean,
  }
}

export function saveMyProfile(p: {
  handle: string
  name: string
  avatar: AvatarSpec | null
  ring: string | null
  bio: string
  shown: ShowKey[]
  card: Card
  searchable: boolean
}): Promise<Result<null>> {
  return rpc('save_player_profile', {
    p_handle: p.handle,
    p_name: p.name,
    p_avatar: p.avatar,
    p_ring: p.ring,
    p_bio: p.bio,
    p_shown: p.shown,
    p_card: p.card,
    p_searchable: p.searchable,
  })
}

/**
 * Make your profile if you have none: a handle from your name, showing only the
 * Pip Rating. Everyone with an account has one (docs/social.md); this covers a
 * new account. Leaves an existing profile alone.
 */
export function ensureMyProfile(p: {
  name: string
  avatar: AvatarSpec | null
  ring: string | null
}): Promise<Result<null>> {
  return rpc('ensure_player_profile', { p_name: p.name, p_avatar: p.avatar, p_ring: p.ring })
}

/** The shown values again, and your current name and face. */
export function refreshMyCard(p: {
  name: string
  avatar: AvatarSpec | null
  ring: string | null
  card: Card
}): Promise<Result<null>> {
  return rpc('refresh_player_card', {
    p_name: p.name,
    p_avatar: p.avatar,
    p_ring: p.ring,
    p_card: p.card,
  })
}

// --- finding people -----------------------------------------------------------

export async function searchPlayers(
  query: string,
): Promise<Result<(PlayerRow & { relation: Relation })[]>> {
  const r = await rpc<(RawRow & { relation: Relation })[]>('search_players', { p_query: query })
  return r.ok ? { ok: true, value: r.value.map((x) => ({ ...toRow(x), relation: x.relation })) } : r
}

export async function getPlayer(handle: string): Promise<Result<Player | null>> {
  const r = await rpc<Record<string, unknown> | null>('get_player', { p_handle: handle })
  if (!r.ok) return r
  const v = r.value
  if (!v) return { ok: true, value: null }
  return {
    ok: true,
    value: {
      handle: v.handle as string,
      name: v.name as string,
      avatar: (v.avatar as AvatarSpec | null) ?? null,
      ring: (v.ring as string | null) ?? null,
      bio: (v.bio as string) ?? '',
      shown: parseShown(v.shown),
      card: parseCard(v.card),
      rating: (v.rating as Player['rating']) ?? null,
      relation: v.relation as Relation,
      friendsSince: (v.friendsSince as string | null) ?? null,
      searchable: v.searchable === true,
      featured: typeof v.featured === 'string' ? v.featured : null,
    },
  }
}

/** People to add: featured players first, then friends of friends. `reason` says why. */
export async function suggestedPlayers(): Promise<Result<(PlayerRow & { reason: string })[]>> {
  const r = await rpc<(RawRow & { reason: string })[]>('suggested_players')
  return r.ok ? { ok: true, value: r.value.map((x) => ({ ...toRow(x), reason: x.reason })) } : r
}

// --- friends ------------------------------------------------------------------

export type FriendStatus = 'friends' | 'sent' | 'received'

export interface Friend extends PlayerRow {
  status: FriendStatus
  since: string
}

export async function myFriends(): Promise<Result<Friend[]>> {
  const r = await rpc<(RawRow & { status: FriendStatus; since: string })[]>('my_friends')
  return r.ok
    ? {
        ok: true,
        value: r.value.map((x) => ({ ...toRow(x), status: x.status, since: x.since })),
      }
    : r
}

/** Ask, or say yes if they already asked you. */
export function requestFriend(handle: string): Promise<Result<Relation>> {
  return rpc('request_friend', { p_handle: handle })
}

export function answerFriend(handle: string, accept: boolean): Promise<Result<Relation>> {
  return rpc('answer_friend', { p_handle: handle, p_accept: accept })
}

/** Unfriend, or take back a request. */
export function removeFriend(handle: string): Promise<Result<null>> {
  return rpc('remove_friend', { p_handle: handle })
}

// --- block and report ---------------------------------------------------------

export function blockPlayer(handle: string): Promise<Result<null>> {
  return rpc('block_player', { p_handle: handle })
}

export function unblockPlayer(userId: string): Promise<Result<null>> {
  return rpc('unblock_player', { p_user: userId })
}

export interface Blocked {
  userId: string
  /** Null for somebody blocked at a table who has no profile. */
  handle: string | null
  name: string | null
  avatar: AvatarSpec | null
}

export async function myBlocks(): Promise<Result<Blocked[]>> {
  const r =
    await rpc<
      {
        user_id: string
        handle: string | null
        display_name: string | null
        avatar: AvatarSpec | null
      }[]
    >('my_blocks')
  return r.ok
    ? {
        ok: true,
        value: r.value.map((x) => ({
          userId: x.user_id,
          handle: x.handle,
          name: x.display_name,
          avatar: x.avatar,
        })),
      }
    : r
}

export const PROFILE_REPORT_REASONS = [
  { id: 'profile', label: 'Their name, picture or bio' },
  { id: 'abuse', label: 'Abusive or harassing' },
  { id: 'cheating', label: 'Cheating or spam' },
  { id: 'other', label: 'Something else' },
] as const

export type ProfileReportReason = (typeof PROFILE_REPORT_REASONS)[number]['id']

export function reportPlayer(
  handle: string,
  reason: ProfileReportReason,
  note: string,
): Promise<Result<null>> {
  return rpc('report_player', { p_handle: handle, p_reason: reason, p_note: note })
}

// --- challenges and invites ---------------------------------------------------

/** Tell friends about a room you opened. Resolves to how many were told. */
export function inviteFriends(
  handles: string[],
  kind: 'challenge' | 'invite',
  code: string,
  slow: boolean,
  venue: string,
): Promise<Result<number>> {
  return rpc('invite_friends', {
    p_handles: handles,
    p_kind: kind,
    p_code: code,
    p_slow: slow,
    p_venue: venue,
  })
}

// --- the inbox ----------------------------------------------------------------

export type NoticeKind = 'friend-request' | 'friend-accepted' | 'challenge' | 'invite'

export interface Notice {
  id: number
  kind: NoticeKind
  from: PlayerRow
  /** Challenges and invites. */
  code: string | null
  slow: boolean
  /** The room's venue, for its picture. */
  venue: string | null
  at: string
  read: boolean
  /** Where you stand with them now: a request already answered is not asked again. */
  relation: Relation
}

export async function myNotices(): Promise<Result<Notice[]>> {
  const r =
    await rpc<
      (RawRow & {
        id: number
        kind: NoticeKind
        payload: { code?: string; slow?: boolean; venue?: string } | null
        created_at: string
        read_at: string | null
        relation: Relation
      })[]
    >('my_notifications')
  return r.ok
    ? {
        ok: true,
        value: r.value.map((x) => ({
          id: x.id,
          kind: x.kind,
          from: toRow(x),
          code: x.payload?.code ?? null,
          slow: x.payload?.slow === true,
          venue: x.payload?.venue ?? null,
          at: x.created_at,
          read: x.read_at !== null,
          relation: x.relation,
        })),
      }
    : r
}

/** Mark these read, or with no ids, everything. */
export function readNotices(ids?: number[]): Promise<Result<null>> {
  return rpc('read_notifications', { p_ids: ids ?? null })
}

/** Calls `onChange` when a notification of yours arrives or changes, until stopped. */
export async function watchNotices(onChange: () => void): Promise<() => void> {
  const sb = await client()
  if (!sb) return () => {}
  const channel = sb
    .channel(`notifications-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, onChange)
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
