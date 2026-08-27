// Heuristic poker AI. There's no drop-in "good bot" library, so we build one on
// top of Monte-Carlo equity: estimate our chance of winning, compare to the pot
// odds, then let per-venue personality knobs decide how loose/aggressive/bluffy
// the action is. Pure and deterministic given an RNG.

import type { Rng } from '../cards'
import { legalActions, potSize, type Action, type HandState } from '../engine'
import { estimateEquity } from '../equity'
import { holeStrength } from '../range'

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
 * it postflop. Feeds `estimateEquity`'s `opponentSelectivity`. Shared with the
 * hero's ambient read (store/game.ts) so both sides model ranges the same way.
 */
export function opponentSelectivity(state: HandState, opp: HandState['players'][number]): number {
  const bb = Math.max(state.bigBlind, 1)
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
export function decideAction(state: HandState, profile: AiProfile, rng: Rng = Math.random): Action {
  const legal = legalActions(state)
  const player = state.players[state.toActIndex]
  if (!legal || !player) throw new Error('decideAction: no player to act')

  const opponents = liveOpponents(state, player.id)
  if (opponents.length === 0) {
    return legal.canCheck ? { type: 'check' } : { type: 'call' }
  }

  // Model each opponent's range by how much they've backed the hand, not as two
  // random cards — otherwise the AI over-values its equity into aggression and
  // calls too light. This mirrors the hero's ambient read (store/game.ts).
  const { equity: trueEquity } = estimateEquity({
    hole: player.hole,
    community: state.community,
    opponents: opponents.length,
    opponentSelectivity: opponents.map((p) => opponentSelectivity(state, p)),
    iterations: profile.iterations,
    rng,
  })

  // Unskilled players misread their hand strength. The noisy estimate feeds
  // every decision below, so mistakes compound naturally: missed value bets,
  // bad calls, folded winners.
  const skill = clamp(profile.skill ?? 1, 0, 1)
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
  // below was written as an absolute against a heads-up pot. Measured on the
  // shipped venue profiles, that is what makes the bots check the flop round:
  // at the loose end of the ladder the AI leads an unbet pot 14% of the time
  // heads-up, 8% against two and 4% against three, because 0.62 equity is a
  // decent made hand heads-up and close to the nuts four-handed. A real player
  // bets an unbet flop far more than that, and the loose tables (the ones a
  // beginner meets first) are the ones that go multiway.
  //
  // So the gates are quoted as a multiple of a fair share of the pot,
  // `1 / (opponents + 1)`, which is what "ahead of this field" actually means.
  // **Heads-up every multiple below reproduces the old absolute exactly**
  // (0.5 x 1.24 = 0.62, 0.5 x 1.56 = 0.78, 0.5 x 1.2 = 0.6, 0.5 x 0.8 = 0.4),
  // so nothing changes at a table that plays heads-up pots, and `tests/ai.test.ts`
  // pins that. Only the multiway spots move, which is where the defect was.
  const fairShare = 1 / (opponents.length + 1)
  const misjudged = clamp(preStrength + misread, 0, 1)
  const raiseValue = preflop ? misjudged >= 0.62 : equity > fairShare * 1.56
  const raiseThin = preflop ? misjudged >= 0.55 : equity > fairShare * 1.2

  // --- unbet pot: check or lead out --------------------------------------
  if (toCall === 0) {
    // Same story here: preflop this branch is the big blind with the pot limped
    // to it, and equity-vs-the-field says check with any holding at all.
    const strongEnoughToLead = preflop ? misjudged >= 0.62 : equity > fairShare * 1.24
    const wantsValue = strongEnoughToLead && roll < 0.35 + profile.aggression * 0.55
    // The bluff ceiling scales with the field for the same reason, and it is the
    // half that was quietly wrong in the other direction: four-handed, "under
    // 0.4" is almost every holding, so the bot fired its full bluff frequency
    // with hands that were good for the pot size and called it a bluff.
    const wantsBluff =
      equity < fairShare * 0.8 && !trashPreflop && roll < profile.bluff * (1 - posPressure * 0.5)
    if ((wantsValue || wantsBluff) && (legal.canBet || legal.canRaise)) {
      const fraction = wantsValue ? 0.55 + profile.aggression * 0.25 : 0.5
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
  if (trashPreflop) {
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
  const continueThreshold = potOdds * oddsFactor + (tightnessTax + posPressure * 0.06) * fieldScale

  if (equity < continueThreshold) {
    // Usually fold; occasionally bluff-raise, or peel one cheaply when close.
    if (legal.canRaise && roll < profile.bluff * 0.5) {
      return {
        type: 'raise',
        amount: sizedRaise(state, 0.6, legal.minRaiseTo, legal.maxRaiseTo, rng, profile.aggression),
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
      amount: sizedRaise(state, 0.5, legal.minRaiseTo, legal.maxRaiseTo, rng, profile.aggression),
    }
  }
  return legal.canCall ? { type: 'call' } : { type: 'check' }
}
