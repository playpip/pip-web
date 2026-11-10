'use client'

// The browser's side of the room server: where it is, who you are to it, and
// the two plain requests (open a room, look a code up). The sockets live in
// `store/room.ts` and `store/queue.ts`.

import { getSupabase } from '@/lib/sync/client'
import type { AvatarSpec } from '@/lib/avatar'
import type { FreeLeft } from './freeRoom'
import type { PlayPrefs } from './notices'
import type { RoomKind, RoomSettings } from './room'
import type { SlowCard } from './slowCard'
import type { MoveHours, SlowEnding } from './slow'

const ROOMS_URL = process.env.NEXT_PUBLIC_ROOMS_URL?.replace(/\/$/, '')

/** Is there a room server in this build? Multiplayer hides itself when not. */
export function roomsConfigured(): boolean {
  return Boolean(ROOMS_URL)
}

export function socketUrl(path: string): string {
  return `${ROOMS_URL!.replace(/^http/, 'ws')}${path}`
}

const DEV_TOKEN_KEY = 'pip.roomsDevToken'

/**
 * Local development only: a `dev:<name>:member` token stands in for a Supabase
 * session, so two browsers can sit at one table against `pnpm rooms:dev` with
 * no accounts. The room server accepts it only when its own DEV_AUTH is on,
 * which production never sets.
 */
function devToken(): string | null {
  if (process.env.NODE_ENV !== 'development') return null
  try {
    return localStorage.getItem(DEV_TOKEN_KEY)
  } catch {
    return null
  }
}

/** Whether a dev token is set, and whether it says member, so the screens can be tried locally. */
export function devSignedIn(): boolean {
  return devToken() !== null
}

export function devMember(): boolean {
  return devToken()?.endsWith(':member') ?? false
}

/** Your session, as the room server reads it. Null when signed out. */
export async function sessionToken(): Promise<string | null> {
  const dev = devToken()
  if (dev) return dev
  const sb = await getSupabase()
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export interface Seat {
  name: string
  avatar: AvatarSpec
  ring: string | null
}

export type CreateResult = { code: string } | { error: string }

/** Open a private room (or a slow game) at a ladder stake, with you in the first seat and your rules set. */
export async function createRoom(
  venueId: string,
  seat: Seat,
  settings?: Partial<RoomSettings>,
  kind: Extract<RoomKind, 'private' | 'slow'> = 'private',
): Promise<CreateResult> {
  const token = await sessionToken()
  if (!token) return { error: 'auth' }
  try {
    const res = await fetch(`${ROOMS_URL}/rooms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId, kind, ...seat, settings }),
    })
    const body = (await res.json()) as { code?: string; error?: string }
    return body.code ? { code: body.code } : { error: body.error ?? 'busy' }
  } catch {
    return { error: 'offline' }
  }
}

/** What a code opens, before you sit down: shown on the join screen. */
export interface RoomPeek {
  code: string
  kind: RoomKind
  phase: 'lobby' | 'playing' | 'finished' | 'closed'
  venueId: string
  buyIn: number
  seated: number
  maxSeats: number
  host: string | null
  /** False for a game for fun: no buy-in, no prize. */
  forRoll?: boolean
  /** Slow games only. */
  moveHours?: MoveHours
  ending?: SlowEnding
}

export async function peekRoom(code: string): Promise<RoomPeek | null> {
  try {
    const res = await fetch(`${ROOMS_URL}/rooms/${code}`)
    return res.ok ? ((await res.json()) as RoomPeek) : null
  } catch {
    return null
  }
}

/** The link a host shares. Opens the room on any device, the app included. */
export function inviteLink(code: string): string {
  return `${window.location.origin}/game/room?code=${code}`
}

// --- your own things: slow games and notifications ------------------------------

/** A signed-in request to the room server, or null when signed out or it fails. */
async function mine<T>(path: string, body?: unknown): Promise<T | null> {
  if (!ROOMS_URL) return null
  const token = await sessionToken()
  if (!token) return null
  try {
    const res = await fetch(`${ROOMS_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/** What is left of your free hosting. Null when it could not be asked: the server decides anyway. */
export function fetchFreeLeft(): Promise<FreeLeft | null> {
  return mine<FreeLeft>('/free')
}

/** Your slow games as mini tables. Null when they could not be fetched. */
export async function fetchSlowGames(): Promise<SlowCard[] | null> {
  const body = await mine<{ games: SlowCard[] }>('/slow')
  return body?.games ?? null
}

/** Take a slow game off your list: a finished one, or leave one still waiting for players. */
export async function dismissSlowGame(code: string): Promise<void> {
  await mine('/slow/dismiss', { code })
}

export interface NotifySettings {
  prefs: PlayPrefs
  /** Whether they have ever been saved. Until then the timezone is a guess. */
  set: boolean
  devices: { kind: 'web' | 'expo'; id: string }[]
}

export function fetchNotifySettings(): Promise<NotifySettings | null> {
  return mine<NotifySettings>('/notify/prefs')
}

export async function saveNotifyPrefs(prefs: PlayPrefs): Promise<boolean> {
  return (await mine('/notify/prefs', prefs)) !== null
}

/**
 * Ask the room server to forget this account: its devices, switches, quiet
 * hours and slow games list. Called just before the account is deleted.
 */
export async function forgetNotify(): Promise<boolean> {
  return (await mine('/notify/forget', {})) !== null
}

/** Allow pushes on this device: a browser's subscription, or the app's Expo token. */
export async function registerDevice(
  device:
    | { kind: 'web'; endpoint: string; keys: { p256dh: string; auth: string } }
    | { kind: 'expo'; token: string },
): Promise<boolean> {
  return (await mine('/notify/devices', device)) !== null
}

/** The room server's web push key, or null when it has none. */
export async function vapidKey(): Promise<string | null> {
  if (!ROOMS_URL) return null
  try {
    const res = await fetch(`${ROOMS_URL}/notify/key`)
    const body = (await res.json()) as { key: string | null }
    return body.key
  } catch {
    return null
  }
}
