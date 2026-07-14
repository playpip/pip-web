// Player ranks (titles) for the "grind" progression, derived from your peak Roll.

export interface Rank {
  name: string
  /** Peak Roll required to hold this rank. */
  min: number
}

export const RANKS: readonly Rank[] = [
  { name: 'Amateur', min: 0 },
  { name: 'Regular', min: 1_000 },
  { name: 'Shark', min: 10_000 },
  { name: 'Pro', min: 100_000 },
  { name: 'Legend', min: 1_000_000 },
] as const

export function rankFor(peakRoll: number): Rank {
  let current = RANKS[0]
  for (const rank of RANKS) if (peakRoll >= rank.min) current = rank
  return current
}
