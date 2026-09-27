// Flavour helpers for AI opponents — a play-style label and a pretend bankroll.
// Names, faces, bios and personality now come from the cast (config/cast.ts).

import type { AiProfile } from '@/lib/poker/ai/policy'
import type { Venue } from './venues'

/** A human-readable play style from the seat's AI profile. */
export function styleFor(ai: AiProfile): string {
  const tight = ai.tightness >= 0.42
  const loose = ai.tightness <= 0.28
  const aggressive = ai.aggression >= 0.55
  const passive = ai.aggression <= 0.35
  if (tight && aggressive) return 'Tight & aggressive'
  if (loose && aggressive) return 'Loose & aggressive'
  if (tight && passive) return 'Tight & cautious'
  if (loose && passive) return 'Loose & passive'
  return 'Balanced'
}

/**
 * How hard a table plays, in one word.
 *
 * Five steps over the ten ladder rungs, read off `skill` — the field that
 * actually decides how sound the opposition is (docs/venues.md). Two rungs to a
 * word, so the scale says something rather than renaming every price.
 *
 * **This exists because a room name is not a difficulty** (Will, 2026-09-22).
 * "The Penthouse" means how hard a table plays only to somebody who has already
 * climbed there; on the table builder, where you can seat the Penthouse's
 * regulars at a 100-chip game, it is the one thing a player needs to know and
 * the one thing the name does not tell them.
 */
export function difficultyOf(ai: AiProfile): string {
  return DIFFICULTY_WORDS[difficultyRank(ai) - 1]
}

const DIFFICULTY_WORDS = ['Easy', 'Standard', 'Hard', 'Very hard', 'Extra hard'] as const

/** The same scale as a number, 1–5, for a meter to fill. */
export function difficultyRank(ai: AiProfile): number {
  const skill = ai.skill ?? 1
  if (skill < 0.4) return 1
  if (skill < 0.6) return 2
  if (skill < 0.8) return 3
  if (skill < 0.95) return 4
  return 5
}

/** A pretend total bankroll, scaled to the venue (richer at higher stakes). */
export function randomBankroll(venue: Venue): number {
  const raw = venue.buyIn * (5 + Math.random() * 40)
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1)
  return Math.round(raw / mag) * mag
}
