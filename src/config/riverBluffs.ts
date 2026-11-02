// What /blog/calling-a-river-bet prints: how often the right answer to a river
// bet depends on who is betting, counted over the Calling the river pack's own
// deals (`riverBluffCount` in src/lib/drills/riverBluffCount.ts), seeds 1 to
// 40,000. tests/riverBluffCount.test.ts recounts them, so the post fails
// the build the day the pack changes under it.

export const SHUFFLES = 40_000

/** Shuffles that give you a playable hand with a pair or better of your own on the river. */
export const HANDS = 13_294

/** Shuffles the pack turns into a question. */
export const ASKED = 1_033

/** Every distinct bet across every hand, and how many of those depend on the bettor. */
export const DECISIONS = { total: 157_878, depends: 39_746 } as const

/** By bet size, as a fraction of the pot before it. */
export const BY_BET = [
  { label: '1/5', call: 6_530, fold: 3_139, depends: 3_625 },
  { label: '1/4', call: 6_181, fold: 3_552, depends: 3_561 },
  { label: '1/3', call: 5_805, fold: 4_091, depends: 3_398 },
  { label: '2/5', call: 5_607, fold: 4_426, depends: 3_261 },
  { label: '1/2', call: 5_347, fold: 4_868, depends: 3_079 },
  { label: '3/5', call: 5_186, fold: 5_278, depends: 2_830 },
  { label: '2/3', call: 4_653, fold: 5_443, depends: 3_198 },
  { label: '3/4', call: 3_697, fold: 5_544, depends: 4_053 },
  { label: '1', call: 3_454, fold: 6_121, depends: 3_719 },
  { label: '5/4', call: 3_307, fold: 6_556, depends: 3_431 },
  { label: '3/2', call: 3_186, fold: 6_827, depends: 3_281 },
  { label: '2', call: 3_041, fold: 7_241, depends: 3_012 },
] as const
