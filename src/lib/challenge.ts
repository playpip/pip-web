// Challengers — there is always exactly one cast member wanting a game, and
// beating them brings the next one up. Pure: who is waiting, at what stakes,
// derived entirely from the persisted profile. No React, no storage, no timers.
//
// The load-bearing design choice is that the current challenger is **derived,
// never stored**. Two devices holding the same `challengeWins` and
// `challengesPlayed` compute the same challenger with no coordination, so there
// is no pending-challenge object for sync to reconcile and no way to accept a
// challenge on your phone and have your laptop resurrect it. See
// technology#22 for the shape and why the earlier stored-challenge draft was
// dropped.

import { CAST, bandFor, type CastBand, type Character } from '@/config/cast'
import { CHALLENGE_TABLES, VENUES, type Venue } from '@/config/venues'
import type { VenueRecord } from '@/store/profile'

/** Low to high, so a band can be stepped down when the Roll can't reach it. */
const BAND_ORDER: readonly CastBand[] = ['low', 'mid', 'high'] as const

/** The standing challenge: who, where, and whether you have beaten them before. */
export interface Challenge {
  character: Character
  venue: Venue
  band: CastBand
  /** Every challengeable character in the band is already on the shelf. */
  rematch: boolean
}

/** The profile fields a challenge is derived from. */
export interface ChallengeInput {
  roll: number
  venueRecords: Record<string, VenueRecord>
  challengeWins: readonly string[]
  challengesPlayed: number
}

/**
 * Everyone who can be challenged, in cast order. This list *is* the scalp
 * collection, so the chips in `lib/awards.ts` are generated from it.
 *
 * Pinned characters are out: the Kitchen host, the Chip Shop's Pearl and the
 * Vault's Sable belong to their venue, and `rosterFor` already keeps them out
 * of band rosters for the same reason. That makes the collection 22, not the
 * 25 of the whole cast.
 */
export const CHALLENGEABLE_CAST: readonly Character[] = CAST.filter((ch) => !ch.only)

/** Who can be challenged in a band. */
export const challengeable = (band: CastBand): Character[] =>
  CHALLENGEABLE_CAST.filter((ch) => ch.bands.includes(band))

/** Is this the table a challenge is played at? Scalps only count here. */
export const isChallengeTable = (venue: Venue): boolean =>
  CHALLENGE_TABLES.some((v) => v.id === venue.id)

/** The band a challenge table is pitched at, or `null` for any other venue. */
export function challengeBandOf(venue: Venue): CastBand | null {
  return BAND_ORDER.find((band) => venue.id === `challenge-${band}`) ?? null
}

/**
 * Who is sitting opposite at a challenge table, `null` anywhere else.
 *
 * Read at sit-down rather than passed in from the card, so a refresh, a
 * deep link or a second device all seat the same face: the challenger is
 * derived state and this is the only place the table asks for it.
 */
export function challengerFor(
  venue: Venue,
  p: Pick<ChallengeInput, 'challengeWins' | 'challengesPlayed'>,
): Character | null {
  const band = challengeBandOf(venue)
  if (band === null) return null
  return selectChallenger(band, p.challengeWins, p.challengesPlayed)
}

/**
 * The band the player has *demonstrated*, not the one they can afford.
 *
 * Winning a ladder venue is the evidence: it is the only thing that says you
 * beat a table rather than sat at one. Peak Roll would let a single lucky night
 * at the Card Room pitch every future challenge two rungs above your game.
 */
export function playerBand(venueRecords: Record<string, VenueRecord>): CastBand {
  let best: CastBand = 'low'
  for (const venue of VENUES) {
    if ((venueRecords[venue.id]?.won ?? 0) === 0) continue
    const band = bandFor(venue)
    if (BAND_ORDER.indexOf(band) > BAND_ORDER.indexOf(best)) best = band
  }
  return best
}

/** The table a band's challenge is played at. */
export function challengeTableFor(band: CastBand): Venue {
  const table = CHALLENGE_TABLES.find((v) => v.id === `challenge-${band}`)
  if (!table) throw new Error(`no challenge table for band ${band}`)
  return table
}

/**
 * Step the band down until the buy-in fits the Roll, or `null` if even the
 * lowest is out of reach.
 *
 * The band comes from demonstrated progress, so this mostly never fires — but a
 * player who won the Card Room and then lost it all back is exactly the player
 * an unaffordable standing challenge would taunt. A challenge you cannot sit at
 * is worse than no challenge; below the bottom rung the freeroll is the answer,
 * not a locked table.
 */
export function affordableBand(band: CastBand, roll: number): CastBand | null {
  for (let i = BAND_ORDER.indexOf(band); i >= 0; i--) {
    if (roll >= challengeTableFor(BAND_ORDER[i]).buyIn) return BAND_ORDER[i]
  }
  return null
}

/**
 * Who is waiting.
 *
 * Unbeaten characters first, rotated by how many challenges have been *played*
 * rather than won — that is the rule that stops a wall. If only wins advanced
 * the queue, a player who cannot beat Doris would stare at Doris forever.
 *
 * Once the band is cleared it rotates through rematches over the same pool,
 * minus whoever was beaten most recently, so clearing a band never hands you
 * the same face straight back.
 */
export function selectChallenger(
  band: CastBand,
  challengeWins: readonly string[],
  challengesPlayed: number,
): Character {
  const pool = challengeable(band)
  const unbeaten = pool.filter((ch) => !challengeWins.includes(ch.id))
  if (unbeaten.length > 0) return unbeaten[challengesPlayed % unbeaten.length]

  const justBeaten = challengeWins[challengeWins.length - 1]
  const rematches = pool.length > 1 ? pool.filter((ch) => ch.id !== justBeaten) : pool
  return rematches[challengesPlayed % rematches.length]
}

/** The standing challenge for a profile, or `null` when the Roll can't reach one. */
export function currentChallenge(p: ChallengeInput): Challenge | null {
  const band = affordableBand(playerBand(p.venueRecords), p.roll)
  if (band === null) return null
  const character = selectChallenger(band, p.challengeWins, p.challengesPlayed)
  return {
    character,
    venue: challengeTableFor(band),
    band,
    rematch: p.challengeWins.includes(character.id),
  }
}
