'use client'

// Where "Play", "Deal me in" and the tour's "Take a seat" go: the table the
// lobby's hero card would pick, not the lobby. A new player who has just said
// "deal me in" and gets a menu of doors instead has to choose before they have
// seen a card, and a third of new players left there without playing a hand
// (Umami, September 2026).
//
// A visitor with no player yet is given one on the way (Will, 2026-10-07):
// a random face and a placeholder name, changeable from the lobby. The
// make-your-player screen that used to stand here was the other place new
// players left without seeing a card.
//
// Read at click time rather than through a hook: callers only need it once, on
// the press, and `deviceId()` reads localStorage.

import { nextUp } from '@/lib/nextUp'
import { deviceId } from '@/lib/sync/client'
import { randomAvatar } from '@/lib/avatar'
import { DEFAULT_PLAYER_NAME } from '@/lib/newPlayer'
import { useProfile } from '@/store/profile'

/**
 * The next-up table's URL. A visitor with no player yet gets the table a fresh
 * player would (Friends' Garage); the table route makes the player.
 */
export function firstSeatHref(): string {
  return `/play/${nextUp(useProfile.getState(), deviceId()).venue.id}`
}

/**
 * Make sure this browser has a player, making a placeholder one if not.
 *
 * The placeholder is still pristine as far as sync is concerned (lib/sync/merge
 * `isPristine` ignores identity), so signing in on top of it restores the
 * account rather than merging with it or asking.
 */
export function ensurePlayer(): void {
  const profile = useProfile.getState()
  if (profile.created && profile.avatar) return
  if (!profile.created) profile.createProfile(DEFAULT_PLAYER_NAME, randomAvatar())
  else profile.setAvatar(randomAvatar())
}
