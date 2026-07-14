// Sit-and-go blind escalation. Levels rise every HANDS_PER_LEVEL hands so a
// tournament always ends — stacks stop being deep enough to fold forever.
// Multipliers scale each venue's base blinds: the Garage climbs 1/2 → 2/4 →
// 3/6 …, the Main Event 5k/10k → 10k/20k → …

export const HANDS_PER_LEVEL = 6

/** Blind multiplier per level; the last one holds once reached. */
export const LEVEL_MULTIPLIERS = [1, 2, 3, 5, 8, 12, 18, 27, 40, 60] as const

/** 0-based blind level in effect for hand number `handIndex` (0 = first hand). */
export function blindLevel(handIndex: number): number {
  const level = Math.floor(Math.max(0, handIndex) / HANDS_PER_LEVEL)
  return Math.min(level, LEVEL_MULTIPLIERS.length - 1)
}

/** Blinds a venue posts on hand number `handIndex` (0 = first hand). */
export function blindsAt(
  base: { smallBlind: number; bigBlind: number },
  handIndex: number,
): { smallBlind: number; bigBlind: number; level: number } {
  const level = blindLevel(handIndex)
  const mult = LEVEL_MULTIPLIERS[level]
  return { smallBlind: base.smallBlind * mult, bigBlind: base.bigBlind * mult, level }
}
