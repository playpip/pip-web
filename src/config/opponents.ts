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

/** A pretend total bankroll, scaled to the venue (richer at higher stakes). */
export function randomBankroll(venue: Venue): number {
  const raw = venue.buyIn * (5 + Math.random() * 40)
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1)
  return Math.round(raw / mag) * mag
}
