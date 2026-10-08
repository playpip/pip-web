'use client'

// Where "Play", "Deal me in" and the tour's "Take a seat" go.
//
// A visitor with no player starts the welcome flow (`/welcome`): make your
// player, then the Welcome Table. A player who has made one but not yet played
// the Welcome Table goes there. Everyone else goes to the table the lobby's
// hero card would pick, not the lobby: a new player who has just said "deal me
// in" and gets a menu of doors has to choose before they have seen a card.
//
// Read at click time rather than through a hook: callers only need it once, on
// the press, and `deviceId()` reads localStorage.

import { nextUp } from '@/lib/nextUp'
import { deviceId } from '@/lib/sync/client'
import { randomAvatar } from '@/lib/avatar'
import { DEFAULT_PLAYER_NAME } from '@/lib/newPlayer'
import { WELCOME_TABLE } from '@/config/venues'
import { useProfile } from '@/store/profile'

/** Has this player had their first game at the Welcome Table? */
export function playedWelcome(records: Readonly<Record<string, { entered: number }>>): boolean {
  return (records[WELCOME_TABLE.id]?.entered ?? 0) > 0
}

export function firstSeatHref(): string {
  const profile = useProfile.getState()
  if (!profile.created || !profile.avatar) return '/welcome'
  if (!playedWelcome(profile.venueRecords)) return `/play/${WELCOME_TABLE.id}`
  return `/play/${nextUp(profile, deviceId()).venue.id}`
}

/**
 * Make sure this browser has a player, making a placeholder one if not. Only
 * for a scanned transfer QR, which needs a lobby to restore into; every other
 * way in without a player goes through `/welcome`.
 */
export function ensurePlayer(): void {
  const profile = useProfile.getState()
  if (profile.created && profile.avatar) return
  if (!profile.created) profile.createProfile(DEFAULT_PLAYER_NAME, randomAvatar())
  else profile.setAvatar(randomAvatar())
}
