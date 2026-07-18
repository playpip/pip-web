// Sit-and-go blind escalation. Levels rise every HANDS_PER_LEVEL hands so a
// tournament always ends — stacks stop being deep enough to fold forever.
// Multipliers scale each venue's base blinds: the Garage climbs 1/2 → 2/4 →
// 3/6 …, the Main Event 5k/10k → 10k/20k → …

export const HANDS_PER_LEVEL = 6

// Gentle ~1.3–1.4× steps with extra rungs, rather than a ×3→×5→×8 cliff. The
// old curve lurched straight into shove-or-fold right as a low-venue table
// reached its endgame; this reaches similar heights (so tournaments still end)
// but eases into the shallow zone. Must stay integers — the Garage posts SB 1,
// so a fractional multiplier would give fractional blinds (see blinds.test.ts).
/** Blind multiplier per level; the last one holds once reached. */
export const LEVEL_MULTIPLIERS = [1, 2, 3, 4, 6, 8, 11, 15, 20, 28, 40, 55] as const

/** 0-based blind level in effect for hand number `handIndex` (0 = first hand). */
export function blindLevel(handIndex: number, handsPerLevel: number = HANDS_PER_LEVEL): number {
  const level = Math.floor(Math.max(0, handIndex) / Math.max(1, handsPerLevel))
  return Math.min(level, LEVEL_MULTIPLIERS.length - 1)
}

/** Blinds a venue posts on hand number `handIndex` (0 = first hand). */
export function blindsAt(
  base: { smallBlind: number; bigBlind: number; handsPerLevel?: number },
  handIndex: number,
): { smallBlind: number; bigBlind: number; level: number } {
  const level = blindLevel(handIndex, base.handsPerLevel ?? HANDS_PER_LEVEL)
  const mult = LEVEL_MULTIPLIERS[level]
  return { smallBlind: base.smallBlind * mult, bigBlind: base.bigBlind * mult, level }
}
