// Heuristic poker AI. There's no drop-in "good bot" library, so we build one on
// top of Monte-Carlo equity: estimate our chance of winning, compare to the pot
// odds, then let per-venue personality knobs decide how loose/aggressive/bluffy
// the action is. Pure and deterministic given an RNG.

import {
  HABIT,
  LINE,
  OPENING,
  POSTFLOP_GATE,
  PREFLOP_RAISE_STRENGTH,
  PREFLOP_RAISE_THIN_STRENGTH,
  SEMI_BLUFF,
} from '@/config/aiGates'
import type { Rng } from '../cards'
import { legalActions, potSize, type Action, type HandState } from '../engine'
import { estimateEquity } from '../equity'
import { holeStrength, preflopPercentile } from '../range'
import { barrelledEveryStreet, checkRaised, lineOf, preflopAggressor, streetIsUnbet } from './line'
import { credibility, foldiness, type TableMemory } from './memory'
import { pushFoldAction } from './pushFold'

/**
 * A habit a character plays with, on top of their numbers: the thing a regular
 * at their table would learn about them and use. Personality, not skill, so it
 * holds at every rung. Set on characters in `config/cast.ts`.
 *
 * - `barreler` takes a checked turn whatever it holds, having called the flop
 *   or bet it.
 * - `caller` gives a bet less credit than anybody, and calls down.
 * - `trapper` checks big hands to the raiser far more often, to raise later.
 * - `positional` bets checked pots it is last to act in.
 */
export type Habit = 'barreler' | 'caller' | 'trapper' | 'positional'

export interface AiProfile {
  /** Loose (0) → nitty (1). Raises the equity needed to continue. */
  tightness: number
  /** Passive (0) → aggressive (1). Governs raise frequency and bet sizing. */
  aggression: number
  /** Probability of firing with a weak hand (0 → ~0.3). */
  bluff: number
  /** Monte-Carlo sims per decision. More = sharper estimate = smarter. */
  iterations: number
  /**
   * Play quality, 1 (its best game) → 0 (blundery). Below 1 the AI misreads
   * its own hand strength and gives up too easily under pressure — genuine,
   * exploitable mistakes rather than a personality shift. Defaults to 1.
   */
  skill?: number
  /** A character's habit, if they have one. See `Habit`. */
  habit?: Habit
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

/** Opponents still contesting the hand (folded/out excluded). */
function liveOpponents(state: HandState, selfId: string): HandState['players'] {
  return state.players.filter((p) => p.id !== selfId && p.status !== 'folded' && p.status !== 'out')
}

/**
 * How "self-selected" an opponent's range looks, in [0, ~0.8]. Someone who has
 * piled chips in — especially betting later streets — is far likelier to hold a
 * real hand than two random cards, so equity should not treat them as random.
 * Derived from chips committed this hand (in big blinds) plus a bump for backing
 * it postflop. Feeds `estimateEquity`'s `opponentSelectivity`. This is the read
 * the player's win % and the coach use.
 *
 * **Postflop, an opponent who has put nothing in this street is read off their
 * earlier streets only** (`earlierStreetsRead`). Counting every chip of a
 * preflop raise as strength on a flop nobody has bet made the player's win %
 * twelve points too low there, against the bots' actual cards; read this way
 * it is three points low. Once they bet, the chips-in read stands: against the
 * bots, whose bets are honest, it is within a point (`pnpm win-read`,
 * 2026-10-08).
 */
export function opponentSelectivity(state: HandState, opp: HandState['players'][number]): number {
  const bb = Math.max(state.bigBlind, 1)
  if (state.street !== 'preflop' && opp.committedThisStreet === 0) {
    return earlierStreetsRead(state, opp)
  }
  const bbIn = opp.committedThisHand / bb
  let sel = bbIn / (bbIn + 5) // saturating: 1bb→0.17, 5bb→0.5, 15bb→0.75
  const backedItPostflop =
    state.street !== 'preflop' &&
    state.currentBet > 0 &&
    opp.committedThisStreet >= state.currentBet
  if (backedItPostflop) sel += 0.1
  return Math.min(sel, 0.8)
}

/**
 * What an opponent's earlier streets say about their range, postflop: the
 * chips they put in before this street, saturating slowly, because a preflop
 * raise is a range of most of the hands that opened rather than a made hand on
 * this board.
 */
function earlierStreetsRead(state: HandState, opp: HandState['players'][number]): number {
  const earlierBb = (opp.committedThisHand - opp.committedThisStreet) / Math.max(state.bigBlind, 1)
  return (0.3 * earlierBb) / (earlierBb + 15)
}

/**
 * The AI's own read of how strong an opponent's range is, in [0, 0.8], for the
 * same `estimateEquity` input as `opponentSelectivity`.
 *
 * `opponentSelectivity` reads every chip a player has put in this hand as
 * strength, and after the flop that over-reads a bet badly. A 3bb open and a
 * two-thirds pot c-bet is 7bb, which it scores as the best of four random
 * holdings *on this flop*: a range made of pairs and better. A real c-bet range
 * is most of the hands that opened, and the AI was folding 71% of checked
 * flops to it where a ⅔-pot bet needs 40% to show a profit (`pnpm
 * exploit-sim`, 2026-10-08). That is the hole a beginner who simply keeps
 * betting drives through, and it is what "I beat the best table by being
 * aggressive" was.
 *
 * So postflop, the read comes from what the player did **this street**, sized
 * against the pot they bet into, plus a smaller carry for what they put in on
 * earlier streets. A c-bet reads as two candidates, a check-raise or a second
 * barrel as three, and only a big line across several streets reaches the old
 * numbers. Preflop is unchanged.
 *
 * Then it is scaled by what the table has seen this player do (`memory.ts`): a
 * bet from somebody who bets everything says less than one from somebody who
 * rarely does. Measured with the c-bettor of `pnpm exploit-sim` at The Main
 * Event (`--sng --iters 300`), this change and that memory took its sit-and-go
 * wins from 117/600 to 78/600, and 83/600 with the push/fold chart on as well
 * (fair is 100), 2026-10-08.
 *
 * Kept apart from `opponentSelectivity`, which the coach and the player's own
 * win % still read, so this changes how the bots play and nothing the player
 * is shown.
 */
export function aiSelectivity(
  state: HandState,
  opp: HandState['players'][number],
  memory?: TableMemory,
  skill = 1,
): number {
  const preflop = state.street === 'preflop'
  let sel: number
  if (preflop) {
    sel = opponentSelectivity(state, opp)
  } else {
    const bb = Math.max(state.bigBlind, 1)
    const thisStreet = state.players.reduce((sum, p) => sum + p.committedThisStreet, 0)
    const potBefore = Math.max(potSize(state) - thisStreet, bb)
    const ratio = opp.committedThisStreet / potBefore
    const streetSignal = ratio > 0 ? 0.1 + (0.45 * ratio) / (ratio + 1) : 0
    sel = streetSignal + earlierStreetsRead(state, opp)
    // Checking and then raising is the strongest line there is.
    if (checkRaised(state, opp.id)) sel += LINE.checkRaiseRead
  }
  // A weaker player notices less of what the table is doing, so the read moves
  // with skill: the soft end of the ladder barely adjusts to anybody.
  const read = 1 + (credibility(memory, opp.id, preflop) - 1) * skill
  return clamp(sel * read, 0, 0.8)
}

/**
 * A bet sized off what it holds is a tell: a bluff at half the pot and value at
 * three quarters can be read off the chips by anybody paying attention, and a
 * player who learns it beats the table without looking at a card. So a skilled
 * seat sizes its bluffs and semi-bluffs like its value bets. Below 0.6 skill the
 * tell stays whole, a mistake the soft end of the ladder is meant to make, and
 * at full skill it is gone.
 */
export function disguised(own: number, valueSize: number, skill: number): number {
  const disguise = clamp((skill - 0.6) / 0.4, 0, 1)
  return own + (valueSize - own) * disguise
}

/**
 * Positional pressure in [0, 1]: how many live opponents still owe a decision
 * *after* us this street, normalised by the field. Acting with players left to
 * speak is riskier — someone behind can wake up with a raise — so early position
 * tightens (near 1) and last-to-act (the button's late seats) loosens (near 0).
 */
function positionalPressure(state: HandState, self: HandState['players'][number]): number {
  const opponents = liveOpponents(state, self.id)
  if (opponents.length === 0) return 0
  const behind = opponents.filter(
    (p) => p.status === 'active' && !(p.hasActed && p.committedThisStreet === state.currentBet),
  ).length
  return behind / opponents.length
}

/**
 * Choose a "to" amount for a bet/raise sized as a fraction of the pot, then
 * clamp into the legal band. Adds a little RNG jitter so sizing isn't robotic.
 *
 * Preflop is sized off the current bet instead, because the pot is only the
 * blinds: a 0.7-pot raise over a 10-chip big blind is a raise to 20, and a
 * table of min-raises reads as timid rather than as poker. Real opens are
 * 2.5-3x, and a re-raise is about 3x the bet it answers, so one multiple of
 * `currentBet` covers both.
 */
function sizedRaise(
  state: HandState,
  fractionOfPot: number,
  minRaiseTo: number,
  maxRaiseTo: number,
  rng: Rng,
  aggression = 0.5,
): number {
  const jitter = 0.85 + rng() * 0.3 // ±15%
  if (state.street === 'preflop' && state.currentBet > 0) {
    const multiple = 2.4 + aggression * 0.6 // 2.4x passive → 3x aggressive
    const target = Math.round(state.currentBet * multiple * jitter)
    return clamp(target, minRaiseTo, maxRaiseTo)
  }
  const pot = Math.max(potSize(state), state.bigBlind)
  const chips = Math.round(pot * fractionOfPot * jitter)
  const target = state.currentBet + Math.max(chips, state.lastRaiseSize)
  return clamp(target, minRaiseTo, maxRaiseTo)
}

/**
 * Decide the AI's action for the player currently to act. Guaranteed to return
 * an action that is legal for the current state.
 */
export function decideAction(
  state: HandState,
  profile: AiProfile,
  rng: Rng = Math.random,
  memory?: TableMemory,
): Action {
  const legal = legalActions(state)
  const player = state.players[state.toActIndex]
  if (!legal || !player) throw new Error('decideAction: no player to act')

  const opponents = liveOpponents(state, player.id)
  if (opponents.length === 0) {
    return legal.canCheck ? { type: 'check' } : { type: 'call' }
  }

  const skill = clamp(profile.skill ?? 1, 0, 1)

  // Short-stacked and first in, or facing one short shove: play the solved
  // chart (see pushFold.ts). Weaker seats reach for it less often and play the
  // spot by feel instead, which is the mistake a soft table should make.
  const chartMove = pushFoldAction(state, rng)
  if (chartMove && rng() < skill * skill) return chartMove

  // Model each opponent's range by how they've backed the hand, not as two
  // random cards, or the AI over-values its equity into aggression and calls
  // too light. Not as the best of a handful either: see `aiSelectivity`.
  const { equity: trueEquity } = estimateEquity({
    hole: player.hole,
    community: state.community,
    opponents: opponents.length,
    opponentSelectivity: opponents.map((p) => aiSelectivity(state, p, memory, skill)),
    iterations: profile.iterations,
    rng,
    // Without this the AI would be estimating Hold'em equity for a four-card
    // hand: it would read its own first two cards and every opponent as two
    // random ones, and play a different game from the one on the table.
    variant: state.variant,
  })

  // Unskilled players misread their hand strength. The noisy estimate feeds
  // every decision below, so mistakes compound naturally: missed value bets,
  // bad calls, folded winners.
  const misread = (rng() - 0.5) * (1 - skill) * 0.6
  const equity = clamp(trueEquity + misread, 0.02, 0.98)

  const toCall = legal.callAmount
  const pot = potSize(state)
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0
  const roll = rng()

  // Out of position (players still to act behind us) we tighten up and bluff
  // less — a steal into a live field is far likelier to run into a real hand.
  const posPressure = positionalPressure(state, player)

  // Preflop, gate voluntary chips on starting-hand quality. Raw equity vs two
  // random cards flatters junk — 2-3o still wins ~a third of the time heads-up —
  // so an equity-only bot limps and cheap-peels hands a real player just mucks.
  // The cutoff scales hard with tightness: it's the main dial separating a loose
  // low-stakes field that plays a wide, junky range from a nosebleed nit that
  // folds everything but premiums. A holding below it won't open-bluff and folds
  // to any bet. This never overrides checking for free (the unbet branch takes
  // its free card) so a limped big blind still sees the flop with anything.
  const preflop = state.street === 'preflop'
  const preStrength = preflop ? holeStrength(player.hole, state.community) : 1
  const preflopCutoff = 0.15 + profile.tightness * 0.5
  const trashPreflop = preflop && preStrength < preflopCutoff

  // Equity is the right yardstick for *raising* postflop, and the wrong one
  // preflop, because the field compresses it. Six-handed, aces are worth about
  // 0.49 against five live opponents and a good suited broadway sits near 0.25,
  // so an absolute 0.78 value gate can never fire preflop and the 0.6 one
  // almost never does. The bot then calls its whole range and hardly ever
  // raises: measured across the venue ladder it opened 1.9% to 7.8% of hands
  // where a real player is 12-25%, with a VPIP three to ten times its PFR.
  // That is a calling station, and it is what "the bots don't play like people"
  // actually looks like from the other side of the table.
  //
  // So preflop, judge a raise on the quality of the holding, which is what a
  // player does with five opponents still to speak. `raiseValue` is the top of
  // a real opening range (~AJo/KQo/A7s/77 and better, 15% of hands) and
  // `raiseThin` is the widening band a loose or aggressive seat also comes in
  // with. Postflop the field is small and equity means something again, so the
  // old numbers stand.
  // Postflop, equity is the right yardstick again, but an equity number is not
  // the same size against one opponent as against three, and every postflop gate
  // below used to be an absolute written for a heads-up pot. That is what made
  // the bots check the flop round: 0.62 equity is a decent made hand heads-up
  // and close to the nuts four-handed, so the AI led an unbet multiway pot at
  // under half its heads-up rate. A real player bets an unbet flop far more
  // than that, and the loose tables (the ones a beginner meets first) are the
  // ones that go multiway.
  //
  // No current rate is quoted here on purpose. Three-opponent unbet flops are
  // the rarest spot in any sample, so the cells carrying the finding are the
  // small ones, and a figure written into a comment is a figure nothing
  // re-reads: the last set drifted inside 48 hours of being written. The size
  // of the collapse is asserted in `tests/ai.test.ts` instead, on a named
  // profile, which re-measures it every run.
  //
  // So the gates are quoted as a multiple of a fair share of the pot,
  // `1 / (opponents + 1)`, which is what "ahead of this field" actually means.
  // **Heads-up every multiple reproduces the old absolute exactly**, which is
  // what `POSTFLOP_GATE_HEADS_UP` derives and `tests/ai.test.ts` pins, so
  // nothing changes at a table that plays heads-up pots. Only the multiway
  // spots move, which is where the defect was.
  const fairShare = 1 / (opponents.length + 1)
  const misjudged = clamp(preStrength + misread, 0, 1)
  const raiseValue = preflop
    ? misjudged >= PREFLOP_RAISE_STRENGTH
    : equity > fairShare * POSTFLOP_GATE.raiseValue
  const raiseThin = preflop
    ? misjudged >= PREFLOP_RAISE_THIN_STRENGTH
    : equity > fairShare * POSTFLOP_GATE.raiseThin

  // --- unbet pot: check or lead out --------------------------------------
  if (toCall === 0) {
    // The story of the hand, which the top of the ladder plays and the bottom
    // does not (every frequency below is scaled by skill). See `LINE`.
    const raiser = preflop ? null : preflopAggressor(state)
    const raiserBehind = opponents.find((o) => o.id === raiser && !o.hasActed)
    // A monster checks to the raiser still to act, to raise when they bet. Only
    // on the flop and turn: on the river there is no bet left to come.
    const trapper = profile.habit === 'trapper'
    if (
      raiserBehind &&
      state.street !== 'river' &&
      equity > fairShare * (trapper ? HABIT.trapperGate : LINE.trapGate) &&
      rng() < (trapper ? HABIT.trapper : LINE.trap * skill)
    ) {
      return { type: 'check' }
    }

    // Against players who fold to bets more than most, bluffs are worth more;
    // against callers, less, and a thinner hand is worth a value bet.
    const folds =
      1 +
      (opponents.reduce((sum, o) => sum + foldiness(memory, o.id), 0) / opponents.length - 1) *
        skill
    const leadGate = POSTFLOP_GATE.lead * (folds < 1 ? 1 - (1 - folds) * 0.15 : 1)

    // Same story here: preflop this branch is the big blind with the pot limped
    // to it, and equity-vs-the-field says check with any holding at all.
    const strongEnoughToLead = preflop
      ? misjudged >= PREFLOP_RAISE_STRENGTH
      : equity > fairShare * leadGate
    const wantsValue = strongEnoughToLead && roll < 0.35 + profile.aggression * 0.55
    // The bluff ceiling scales with the field for the same reason, and it is the
    // half that was quietly wrong in the other direction: four-handed, "under
    // 0.4" is almost every holding, so the bot fired its full bluff frequency
    // with hands that were good for the pot size and called it a bluff.
    const wantsBluff =
      equity < fairShare * POSTFLOP_GATE.bluffCeiling &&
      !trashPreflop &&
      roll < profile.bluff * folds * (1 - posPressure * 0.5)

    // Between those two gates sits every holding too good to bluff and not good
    // enough for value, and until this branch existed the AI could not bet one
    // of them at any table, at any aggression, ever. Heads-up that band is 0.40
    // to 0.62, which is where draws and second pair live, so betting it is what
    // semi-bluffing and thin value *are*: a bot that cannot bet a flush draw is
    // passive by construction rather than by personality. `pnpm lead-band`
    // measures how much of a flop lands in it; against a loose range it is over
    // a third of them.
    //
    // **Flop and turn only.** The band's whole justification is that it holds
    // draws, and a complete board has none: a river hand at half the pot's
    // equity is a marginal made hand, and betting it is thin value, which is a
    // different argument and one this change does not make. No rate is quoted
    // for that choice, because the first version of this comment quoted one off
    // 40 hands and it did not survive 300.
    //
    // **`semiBluffStreet` naming the two streets is the whole guard**, and it is
    // what keeps preflop out. Preflop this branch is the big blind in a limped
    // pot, where equity is measured against a whole field and the decision is
    // gated on holding quality instead (see the raise gates above); betting
    // there was calibrated separately and must not move. `tests/ai.test.ts`
    // fails if that list ever grows.
    //
    // The three bands are disjoint by equity and tile the range with no gap, so
    // sharing the single `roll` with the other two branches is safe: at most one
    // of them can be live for a given hand. That stops being true the moment a
    // gate moves past its neighbour, so a test pins the ordering.
    const semiBluffStreet = state.street === 'flop' || state.street === 'turn'
    const wantsSemiBluff =
      semiBluffStreet &&
      equity >= fairShare * POSTFLOP_GATE.bluffCeiling &&
      equity <= fairShare * leadGate &&
      roll <
        (SEMI_BLUFF.base + profile.aggression * SEMI_BLUFF.perAggression) * (1 - posPressure * 0.5)

    // The preflop raiser bets most flops: it has the stronger range, and the
    // caller missed two times in three. Halved multiway, damped out of position.
    const wantsCbet =
      state.street === 'flop' &&
      raiser === player.id &&
      streetIsUnbet(state) &&
      rng() <
        LINE.cbet * skill * folds * (opponents.length === 1 ? 1 : 0.5) * (1 - posPressure * 0.5)

    // Having led every street, a missed hand finishes the story on the river.
    const wantsStoryBluff =
      state.street === 'river' &&
      barrelledEveryStreet(state, player.id) &&
      equity < fairShare * POSTFLOP_GATE.bluffCeiling &&
      rng() < profile.bluff * LINE.storyBluff * skill * folds

    // Habits: the barreler takes every checked turn, the positional player
    // every checked pot it closes.
    const wantsHabitBet =
      (profile.habit === 'barreler' && state.street === 'turn' && rng() < HABIT.barreler) ||
      (profile.habit === 'positional' && !preflop && posPressure === 0 && rng() < HABIT.positional)

    const anyBet =
      wantsValue || wantsBluff || wantsSemiBluff || wantsCbet || wantsStoryBluff || wantsHabitBet
    if (anyBet && (legal.canBet || legal.canRaise)) {
      const valueSize = 0.55 + profile.aggression * 0.25
      let fraction = disguised(0.5, valueSize, skill)
      if (wantsValue) fraction = valueSize
      else if (wantsSemiBluff) fraction = disguised(SEMI_BLUFF.size, valueSize, skill)
      else if (wantsCbet && !wantsBluff) fraction = disguised(LINE.cbetSize, valueSize, skill)
      return {
        type: legal.canBet ? 'bet' : 'raise',
        amount: sizedRaise(
          state,
          fraction,
          legal.minRaiseTo,
          legal.maxRaiseTo,
          rng,
          profile.aggression,
        ),
      }
    }
    return { type: 'check' }
  }

  // --- facing a bet ------------------------------------------------------
  // Muck preflop junk to any bet rather than peel with 2-3 — no price is good
  // enough for a hand a real player never entered the pot with.
  //
  // Unless the raise is from somebody the table has watched raise everything.
  // Against them the cutoff shrinks with how little their raise means, or a
  // player who simply raises every hand takes the blinds off the top table
  // forty times in a hundred and never has to show a card.
  if (trashPreflop) {
    const raiser = opponents.reduce((a, b) =>
      b.committedThisStreet > a.committedThisStreet ? b : a,
    )
    const read = 1 + (credibility(memory, raiser.id, true) - 1) * skill
    const cutoff = read < 1 ? preflopCutoff * Math.sqrt(read) : preflopCutoff
    if (preStrength < cutoff) return { type: 'fold' }
  }

  // First in, a skilled seat raises or folds: it does not limp, and it opens
  // wider the fewer players are left behind it to wake up with a hand. The
  // button and the small blind steal; under the gun opens what it always did.
  // Skill is the chance it plays the spot this way, so the soft end still
  // limps along.
  // Hold'em only: the ranges are shares of the 1,326 two-card hands.
  const firstIn =
    preflop &&
    state.variant === 'holdem' &&
    state.currentBet === state.bigBlind &&
    player.committedThisStreet < state.bigBlind &&
    !lineOf(state).some((a) => a.street === 'preflop' && a.type !== 'fold')
  if (firstIn && legal.canRaise && rng() < skill) {
    const behind = opponents.filter((p) => p.status === 'active' && !p.hasActed).length
    const share =
      OPENING.shareByBehind[Math.min(behind, OPENING.shareByBehind.length - 1)] *
      Math.min(1, OPENING.loosest - OPENING.perTightness * profile.tightness)
    if (preflopPercentile(player.hole) >= 1 - share) {
      return {
        type: 'raise',
        amount: sizedRaise(state, 0.7, legal.minRaiseTo, legal.maxRaiseTo, rng, profile.aggression),
      }
    }
    return { type: 'fold' }
  }

  // Unskilled players also just give up under pressure — the exploitable
  // tell a casual human can actually find and use.
  if (skill < 1 && rng() < (1 - skill) * 0.35) {
    return { type: 'fold' }
  }

  // Tightness demands more equity than the raw pot odds before continuing;
  // position asks for a little extra when players are still to act behind us.
  // Preflop it bites harder — a loose field discounts the price and calls wide
  // (station-y, exploitable), a tight one barely discounts it at all, so the
  // ladder's looseness shows up in how many hands each table plays.
  //
  // Preflop the price is discounted on purpose, because paying it buys a flop
  // rather than a showdown: the field usually folds, so equity measured against
  // five live opponents is pessimistic for a hand that ends up three-way, and
  // there is another street to get away on. Tightness moves that discount, but
  // it must never turn into a premium over the raw price. Unchecked it reached
  // 1.11, and a premium is unpayable multiway: calling the blind six-handed
  // quotes 0.40 while the best hand in poker only holds ~0.49, so the top rungs
  // folded aces under the gun about half the time, and the tighter the venue
  // the likelier it was to do it.
  //
  // So the demand saturates rather than being clipped flat. A hard cap would
  // collapse every rung above it onto one number and flatten the top of the
  // ladder; this keeps them ordered and keeps the loose end exactly where it
  // was, since nothing below 0.7 was ever the problem.
  const rawOddsFactor = 0.42 + profile.tightness * 1.15
  const oddsFactor = preflop
    ? rawOddsFactor < 0.7
      ? rawOddsFactor
      : 0.7 + (rawOddsFactor - 0.7) * 0.35
    : 1
  const tightnessTax = profile.tightness * (preflop ? 0.2 : 0.15)

  // Those two taxes are quoted in equity points, and an equity point is not the
  // same size against one opponent as against five. Heads-up the usable range
  // runs to ~0.85 and a combined +0.14 is a nudge; six-handed the best hand in
  // poker holds ~0.49 and the same +0.14 is nearly a third of everything
  // available, which folded aces under the gun. Shrink them with the field so
  // "tight" and "out of position" mean the same thing at every table size.
  const fieldScale = 2 / (opponents.length + 1) // heads-up 1, six-handed 1/3
  const stationFactor = profile.habit === 'caller' && !preflop ? HABIT.caller : 1
  const continueThreshold =
    (potOdds * oddsFactor + (tightnessTax + posPressure * 0.06) * fieldScale) * stationFactor

  if (equity < continueThreshold) {
    // Usually fold; occasionally bluff-raise, or peel one cheaply when close.
    if (legal.canRaise && roll < profile.bluff * 0.5) {
      return {
        type: 'raise',
        amount: sizedRaise(
          state,
          disguised(0.6, 0.7, skill),
          legal.minRaiseTo,
          legal.maxRaiseTo,
          rng,
          profile.aggression,
        ),
      }
    }
    const cheap = toCall <= pot * 0.15
    if (legal.canCall && cheap && equity > potOdds * 0.85 && roll < 0.5) {
      return { type: 'call' }
    }
    return { type: 'fold' }
  }

  // Strong enough to continue: value-raise the strongest holdings.
  if (raiseValue && legal.canRaise && roll < 0.45 + profile.aggression * 0.5) {
    return {
      type: 'raise',
      amount: sizedRaise(state, 0.7, legal.minRaiseTo, legal.maxRaiseTo, rng, profile.aggression),
    }
  }
  if (raiseThin && legal.canRaise && roll < profile.aggression * 0.4) {
    return {
      type: 'raise',
      amount: sizedRaise(
        state,
        disguised(0.5, 0.7, skill),
        legal.minRaiseTo,
        legal.maxRaiseTo,
        rng,
        profile.aggression,
      ),
    }
  }
  return legal.canCall ? { type: 'call' } : { type: 'check' }
}
