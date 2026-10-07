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

/**
 * The first Garage tournament is a short one.
 *
 * The Garage proper starts 50 big blinds deep with blinds up every 12 hands,
 * which is a long first sitting for somebody who pressed Play a minute ago.
 * Until a player has finished a Garage tournament (won or busted), it deals
 * 25 big blinds with blinds up every 5 hands: the same table, prize and
 * opponents, about ten minutes long. A refresh mid-run resumes it short, since
 * nothing has finished yet.
 */
export function seatedVenue<
  V extends { id: string; smallBlind: number; bigBlind: number; handsPerLevel?: number },
>(venue: V, records: Readonly<Record<string, { bestFinish: number | null }>>): V {
  if (venue.id !== 'garage' || records.garage?.bestFinish != null) return venue
  return { ...venue, smallBlind: 2, bigBlind: 4, handsPerLevel: 5 }
}

/** Hands into a tournament before a player who is not ahead is asked to save their Roll. */
export const SAVE_NUDGE_HANDS = 3

/**
 * Does the table offer a signed-out newcomer a free account right now?
 *
 * Between hands only, never while they are deciding. Once they are ahead in a
 * tournament (the moment there is something to keep), or after a few hands
 * either way. Only in a player's first tournaments, after which the account
 * offer lives on the end-of-run card and the lobby, and never again in a run
 * where they said "Not now".
 */
export function offersSaveMidRun(t: {
  signedOut: boolean
  dismissed: boolean
  betweenHands: boolean
  cash: boolean
  tournamentsEntered: number
  handIndex: number
  chipsUp: number
}): boolean {
  if (!t.signedOut || t.dismissed || !t.betweenHands || t.cash) return false
  if (t.tournamentsEntered > NEW_PLAYER_TOURNAMENTS) return false
  return t.chipsUp > 0 || t.handIndex >= SAVE_NUDGE_HANDS
}
