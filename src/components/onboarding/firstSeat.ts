'use client'

// Where "Deal me in" and the tour's "Take a seat" go: the table the lobby's
// hero card would pick, not the lobby. A new player who has just said "deal me
// in" and gets a menu of five doors instead has to choose before they have
// seen a card, and a third of new players left there without playing a hand
// (Umami, September 2026).
//
// Read at click time rather than through a hook: both callers only need it
// once, on the press, and `deviceId()` reads localStorage.

import { nextUp } from '@/lib/nextUp'
import { deviceId } from '@/lib/sync/client'
import { useProfile } from '@/store/profile'

/** The next-up table's URL, or the lobby for a visitor with no player yet. */
export function firstSeatHref(): string {
  const profile = useProfile.getState()
  if (!profile.created || !profile.avatar) return '/game'
  return `/play/${nextUp(profile, deviceId()).venue.id}`
}
