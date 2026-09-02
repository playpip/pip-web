// The postflop gates the AI bets and raises on, in one place so that anything
// quoting them imports them instead of typing them.
//
// They live in config rather than beside the code that uses them for one
// reason: `src/lib/poker/ai/policy.ts` pulls in the equity simulator and the
// engine, so a page importing a number out of it would ship the whole AI to a
// reader who only wanted the number. Nothing here imports anything.
//
// Same rule as src/config/potOdds.ts: the heads-up absolutes are derived, not
// written down, so a change to a multiple moves everything quoting it.

/**
 * Each gate as a multiple of a fair share of the pot, `1 / (opponents + 1)`,
 * which is what "ahead of this field" means. An equity number is not the same
 * size against one opponent as against three, and these used to be absolutes
 * written for a heads-up pot. See `decideAction` for the defect that caused.
 */
export const POSTFLOP_GATE = {
  /** Bet an unbet pot above this. */
  lead: 1.24,
  /** Raise for value above this. */
  raiseValue: 1.56,
  /** Raise thin above this. */
  raiseThin: 1.2,
  /** Bluff only below this. */
  bluffCeiling: 0.8,
} as const

/** A fair share of the pot heads-up, which is exactly a half. */
export const HEADS_UP_FAIR_SHARE = 1 / (1 + 1)

/**
 * The same four gates as the heads-up equity absolutes they replaced: 0.62,
 * 0.78, 0.6 and 0.4. Every multiple reproduces its absolute exactly, which is
 * why the change moved no heads-up pot and could ship without a playtest of
 * all 29 tables. `tests/ai.test.ts` pins all four.
 */
export const POSTFLOP_GATE_HEADS_UP = {
  lead: POSTFLOP_GATE.lead * HEADS_UP_FAIR_SHARE,
  raiseValue: POSTFLOP_GATE.raiseValue * HEADS_UP_FAIR_SHARE,
  raiseThin: POSTFLOP_GATE.raiseThin * HEADS_UP_FAIR_SHARE,
  bluffCeiling: POSTFLOP_GATE.bluffCeiling * HEADS_UP_FAIR_SHARE,
} as const

/**
 * Preflop the gates are holding quality, not equity, so they are a different
 * quantity from the four above and do not scale with the field. `raiseValue`
 * reading 0.62 here is a coincidence, not the same 0.62.
 */
export const PREFLOP_RAISE_STRENGTH = 0.62

/** The widening band a loose or aggressive seat also comes in with. */
export const PREFLOP_RAISE_THIN_STRENGTH = 0.55
