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

/**
 * The band between `bluffCeiling` and `lead` is every holding too good to be a
 * bluff and not good enough to be value, which heads-up is 0.40 to 0.62: draws
 * and marginal made hands, the hands semi-bluffing exists for. `decideAction`
 * had no branch for it, so it could not be bet at any table, at any aggression,
 * ever. `pnpm lead-band` measures how wide it is (technology#79).
 *
 * How often the AI bets it, before position damps it. Deliberately below the
 * value-bet frequency (`0.35 + aggression * 0.55`) at every aggression the
 * ladder ships, because a hand that is not worth value is not bet like one, and
 * deliberately above the bluff frequency, because it holds something.
 *
 * **These two numbers are the tuning knob and nothing else is.** Measured over
 * 300 hands a venue with every seat on its shipped profile, they take the flop
 * lead rate from 15.6% to 21.6% at Friends' Garage and 31.1% to 39.5% at The
 * Main Event, and the turn from 12.1% to 17.6% and 22.5% to 30.9%. Whether that
 * is the right amount is a question about how the table *feels*, which no
 * simulation here can answer: re-run `pnpm lead-band` after moving either.
 */
export const SEMI_BLUFF = {
  /** Frequency floor, before aggression and position. */
  base: 0.18,
  /** What aggression adds to it. */
  perAggression: 0.45,
  /** Size as a fraction of the pot, under a value bet's 0.55 to 0.80. */
  size: 0.45,
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
