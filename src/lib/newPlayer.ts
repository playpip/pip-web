// What a brand-new visitor is given, and how long they count as new.
//
// A first visit deals you straight in (Will, 2026-10-07): Play makes a player
// with a random avatar and this name, and seats you at Friends' Garage. Before
// that a newcomer had to build an avatar and type a name before seeing a card.
// The name is a placeholder until they pick one, and two places read it as one:
// the lobby, which offers to change it, and the sync merge, which never lets it
// overwrite a name somebody actually chose on another device.
//
// Pure, no store or browser imports, so the sync merge can use it and the
// tests can read it.

import type { LifetimeStats } from '@/store/profile'

/** The name a player has until they choose one. */
export const DEFAULT_PLAYER_NAME = 'Player'

/** Has this player still got the name they were given rather than one they chose? */
export function hasPlaceholderName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed === '' || trimmed === DEFAULT_PLAYER_NAME
}

/** Tournaments a player has to have entered before the lobby shows every door. */
export const NEW_PLAYER_TOURNAMENTS = 3

/**
 * Hands that count as experienced on their own, for somebody who has only ever
 * played the Rail's cash games and so never entered a tournament.
 */
const NEW_PLAYER_HANDS = 150

/**
 * Does the lobby lead this player in with a short menu (the next table, the
 * Daily, Learn) rather than all of it at once?
 */
export function isNewPlayer(stats: Pick<LifetimeStats, 'tournamentsEntered' | 'handsPlayed'>) {
  return stats.tournamentsEntered < NEW_PLAYER_TOURNAMENTS && stats.handsPlayed < NEW_PLAYER_HANDS
}
