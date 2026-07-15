// Flavour for AI opponents — a play-style label, a fun one-liner bio, and a
// pretend bankroll — so tapping a player at the table shows a bit about them.

import type { AiProfile } from '@/lib/poker/ai/policy'
import type { Venue } from './venues'

export const OPPONENT_BIOS = [
  'Swears they play a system.',
  'Once shoved all-in with seven-deuce. Won.',
  'Will tell you their bad-beat story. At length.',
  'Never met a flush draw they didn’t chase.',
  'Claims a cousin won a bracelet.',
  'Tilts the moment they lose a coin flip.',
  'Only here for the free snacks.',
  'Talks a big game, folds the river.',
  'Guards a lucky card protector.',
  'Slow-rolls when they’ve got the nuts.',
  'Reads far too many strategy blogs.',
  'Counts their chips between every hand.',
  'Insists they’re “due” for a big one.',
  'Types “nh” even when it wasn’t.',
  'Retired early. Allegedly.',
  'Plays every hand like it’s the Main Event.',
] as const

export function pickBio(): string {
  return OPPONENT_BIOS[Math.floor(Math.random() * OPPONENT_BIOS.length)]
}

/** A human-readable play style from the venue's AI profile. */
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

/** A pretend total bankroll, scaled to the venue (richer at higher stakes). */
export function randomBankroll(venue: Venue): number {
  const raw = venue.buyIn * (5 + Math.random() * 40)
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1)
  return Math.round(raw / mag) * mag
}
