// What a public profile can show, and the values it shows (docs/social.md).
//
// The player picks. Only what they picked leaves the device: `cardOf` copies
// those values and nothing else into `player_profiles.card`. The Pip Rating is
// the exception, read by the database from `ratings`, so it is the one number
// nobody can make up.

import { rankFor } from '@/config/ranks'
import { derivePlayStyle, type StyleKey } from '@/lib/playStyle'
import type { SeatStats } from '@/lib/reads'
import type { PlayStreak } from '@/lib/streak'

export const SHOWABLE = [
  { key: 'rating', label: 'Pip Rating' },
  { key: 'rank', label: 'Rank' },
  { key: 'roll', label: 'Roll' },
  { key: 'style', label: 'Player type' },
  { key: 'hands', label: 'Hands played' },
  { key: 'wins', label: 'Tournaments won' },
  { key: 'streak', label: 'Best streak' },
  { key: 'awards', label: 'Awards' },
  // Not a number: the list of games on the profile, each one open to replay (docs/games.md).
  { key: 'games', label: 'Games' },
] as const

export type ShowKey = (typeof SHOWABLE)[number]['key']

/**
 * A new profile shows the rating, which is public on the leaderboard already,
 * and its games (Will, 2026-11-27: "everything, like the session review").
 */
export const DEFAULT_SHOWN: readonly ShowKey[] = ['rating', 'games']

export interface Card {
  rank?: string
  roll?: number
  style?: StyleKey
  hands?: number
  wins?: number
  streak?: number
  awards?: number
}

/** The parts of the profile a card is made from. */
export interface CardSource {
  roll: number
  peakRoll: number
  stats: { handsPlayed: number; tournamentsWon: number }
  tendencies: SeatStats
  streak: PlayStreak
  awards: Record<string, number>
}

export function cardOf(p: CardSource, shown: readonly ShowKey[]): Card {
  const card: Card = {}
  const on = (k: ShowKey) => shown.includes(k)
  if (on('rank')) card.rank = rankFor(p.peakRoll).name
  if (on('roll')) card.roll = Math.max(0, Math.round(p.roll))
  if (on('style')) {
    const style = derivePlayStyle(p.tendencies)
    if (style.ready) card.style = style.key
  }
  if (on('hands')) card.hands = p.stats.handsPlayed
  if (on('wins')) card.wins = p.stats.tournamentsWon
  if (on('streak')) card.streak = p.streak.best
  if (on('awards')) card.awards = Object.keys(p.awards).length
  return card
}

/** Only the keys Pip knows, in Pip's order: what a profile page may trust from the server. */
export function parseShown(v: unknown): ShowKey[] {
  if (!Array.isArray(v)) return []
  return SHOWABLE.map((s) => s.key).filter((k) => v.includes(k))
}

const STYLE_KEYS: readonly StyleKey[] = ['shark', 'maniac', 'rock', 'station']

/** A card as read back from somebody else's profile: anything malformed is left out. */
export function parseCard(v: unknown): Card {
  if (typeof v !== 'object' || v === null) return {}
  const o = v as Record<string, unknown>
  const count = (x: unknown) =>
    typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.round(x) : undefined
  const card: Card = {}
  if (typeof o.rank === 'string' && o.rank.length <= 24) card.rank = o.rank
  if (count(o.roll) !== undefined) card.roll = count(o.roll)
  if (typeof o.style === 'string' && STYLE_KEYS.includes(o.style as StyleKey)) {
    card.style = o.style as StyleKey
  }
  if (count(o.hands) !== undefined) card.hands = count(o.hands)
  if (count(o.wins) !== undefined) card.wins = count(o.wins)
  if (count(o.streak) !== undefined) card.streak = count(o.streak)
  if (count(o.awards) !== undefined) card.awards = count(o.awards)
  return card
}
