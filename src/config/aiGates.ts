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

/**
 * What the AI does with the story of the hand (`lib/poker/ai/line.ts`). Every
 * frequency here is multiplied by `skill`, so the soft end of the ladder plays
 * each street on its own, as it always has, and the top plays the hand.
 *
 * Tuned against `pnpm ai-stats`, whose reference column is a solid regular.
 */
export const LINE = {
  /**
   * Extra chance the preflop raiser bets a flop it would otherwise check, heads
   * up (halved multiway). Moves The Main Event's c-bet from 52% toward the
   * 55-70% a regular bets.
   */
  cbet: 0.2,
  /** Its size, before `disguised` blends it toward value at the top. */
  cbetSize: 0.4,
  /**
   * Chance a monster checks to the preflop raiser behind it on the flop or
   * turn, to raise when they bet. Equity has to clear `trapGate` times a fair
   * share of the pot, which heads-up is 0.875.
   */
  trap: 0.2,
  trapGate: 1.75,
  /**
   * River bluff frequency, as a multiple of the profile's `bluff`, for a seat
   * that has led every street before it: the bet that finishes the story.
   */
  storyBluff: 1.5,
  /** How much a check-raise adds to the read of the raiser's range. */
  checkRaiseRead: 0.15,
} as const

/** How strongly each character habit shows (see `Habit` in ai/policy). */
export const HABIT = {
  /** Chance the barreler bets a checked turn, whatever it holds. */
  barreler: 0.5,
  /** The caller's continue threshold, as a share of everybody else's. */
  caller: 0.75,
  /** Chance the trapper checks a big hand to the raiser, and the gate for it. */
  trapper: 0.6,
  trapperGate: 1.5,
  /** Chance the positional player bets a checked pot it is last to act in. */
  positional: 0.3,
} as const

/**
 * First-in opening (see `decideAction`): the share of all starting hands a
 * seat opens, by how many players are still to act behind it. The base is a
 * solid regular's six-handed ranges, under the gun at 15% out to the button
 * at 42%, scaled by `loosest - perTightness * tightness` and never past them.
 *
 * The scale is steep on purpose. The ladder enters fewer pots at every rung
 * (`tests/ai.test.ts`), the top rungs sit 0.02 to 0.05 of tightness apart, and
 * a higher rung reaches for these ranges more often because it has more
 * skill. A scale that left them near a regular's made the Penthouse play more
 * hands than the Casino. So the top of the ladder stays the nits it was
 * designed as, just ones that raise or fold: The Main Event (0.6) opens about
 * half the reference, 8% under the gun and 21% on the button.
 */
export const OPENING = {
  /** Index = players behind: 1 is the small blind, 5 is under the gun. */
  shareByBehind: [0.42, 0.38, 0.42, 0.26, 0.19, 0.15],
  loosest: 1.5,
  perTightness: 1.65,
} as const
