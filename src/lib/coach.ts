/**
 * One honest read on the hand you just played. Shipped as **"Second opinion"**;
 * this module and the profile field keep the older internal name, and the two
 * are one feature (see SettingsDialog for why they were not renamed).
 *
 * The label is deliberate (CMO, technology#46). A coach is someone whose job is
 * to correct you, and this is a peer looking over your shoulder. It also has to
 * survive being silent most hands: a coach who says nothing for twenty hands
 * has stopped doing their job, whereas someone with no second opinion to offer
 * simply had nothing to add, which is exactly what `null` means below.
 *
 * Not a report card on every action. One moment, named, with the arithmetic
 * that makes it true, or nothing at all. A hand where you folded 72o preflop
 * and moved on has no lesson in it, and inventing one is how coaching becomes
 * noise, so `null` is a first-class answer here and most hands get it.
 *
 * **What this reads and what it refuses to read.** Every judgement comes from a
 * `HeroDecision` snapshot, taken by the game store at the moment the hero acted
 * and holding only what was on screen then: the pot, the price, the board so
 * far, and how tight the live opponents' ranges looked. `HandRecord.reveals`
 * carries showdown hole cards and this module never touches them. Advice built
 * on cards the player could not see is correct and useless, because it teaches
 * results rather than decisions, and it is the single easiest bug to write in
 * here. `tests/coach.test.ts` targets it directly.
 *
 * **One hand in, one read out, and it stays that way.** Coaching *across* hands
 * (leaks, trends, progress) is the membership's surface and belongs in its own
 * module behind an entitlement check. Keeping this signature at one hand is the
 * cheapest way to stop that boundary eroding by accident.
 *
 * **What the arithmetic covers.** Pot odds against equity at the moments the
 * hero was charged a price: was calling worth it, on the numbers in front of
 * you. It assumes the hand plays no further streets, so it does not price
 * implied odds or the chance of being bet off later.
 *
 * **Bets and raises are judged too, and only in the branch where nobody folds**
 * (`scoreAggressive`). What makes aggression good is partly fold equity, which
 * is a guess about the opponent rather than a number on the table, so this
 * module does not have one and does not want one. It does not need one to say
 * a bet was good: folds can only help a bet, so aggression that is already
 * ahead when every live opponent calls is ahead whatever they would have done.
 * That makes "good bet" a bound rather than an estimate, and it is a stronger
 * claim than anything said about a call.
 *
 * **The other side of it is the one thing this module will not say.** No bet is
 * ever worse than checking on pot odds alone, because winning the pot
 * uncontested is worth something and folds are never negative. So a bet the
 * chips did not justify is reported as the fold frequency it was asking for,
 * with no verdict attached. Anyone asking for the coach to be harder on bets is
 * asking for a fold-equity model; that is a different build and a much larger
 * one, and the honest answer until then is the number, not an opinion.
 *
 * **One known simplification.** Calling all-in for less than the bet is priced
 * against the whole pot, when in truth only the matched part of it is winnable.
 * That flatters the call slightly. Side-pot arithmetic is a fair amount of code
 * for a spot the noise floor swallows most of the time, so v1 does without it
 * and this comment is the honest record of that.
 */

import type { HandRecord } from '@/store/game'
import type { Card, Rng } from '@/lib/poker/cards'
import { mulberry32 } from '@/lib/poker/cards'
import { estimateEquity } from '@/lib/poker/equity'
import { type HandState, potSize } from '@/lib/poker/engine'
import { opponentSelectivity } from '@/lib/poker/ai/policy'
import { formatChips } from '@/lib/useMoney'

/**
 * What the hero could see at one of their own decisions, recorded as they made
 * it. The store fills this in (see `recordStep` in `store/game.ts`); nothing
 * reconstructs it afterwards, because walking the event list back into a pot
 * is exactly the kind of arithmetic that goes quietly wrong.
 */
export interface HeroDecision {
  /** Chips already in the pot, before this action. */
  pot: number
  /** Chips it cost to call. 0 when checking was free. */
  toCall: number
  /** Opponents still live in the hand. */
  opponents: number
  /** Those opponents' range tightness, in [0, 1]. See `opponentSelectivity`. */
  selectivity: number[]
  /** The board as it stood. Empty preflop. */
  board: Card[]
  /**
   * Chips the hero already had in front of them on this street, so a raise's
   * real cost is `amount - committed` rather than `amount`. Optional because
   * records made before bets were judged do not carry it; absent, it reads as
   * 0, which overstates what a raise risked and so only ever makes the read
   * slower to call a raise good.
   */
  committed?: number
}

/**
 * Freeze what the hero can see at the moment they act.
 *
 * Everything here is already on their screen: the pot, the price, the board,
 * and the same range tightness the ambient win% readout uses. Nothing about
 * anyone's cards. The game store calls this from `recordStep`; it lives here
 * rather than in the store so that a measurement of the read runs the same
 * snapshot the player got, rather than a second copy of this arithmetic.
 */
export function heroDecision(
  state: HandState,
  heroId: string,
  toCall: number,
): HeroDecision | undefined {
  const hero = state.players.find((p) => p.id === heroId)
  if (!hero || hero.hole.length < 2) return undefined
  const opponents = state.players.filter(
    (p) => p.id !== heroId && p.status !== 'folded' && p.status !== 'out',
  )
  if (opponents.length === 0) return undefined
  return {
    pot: potSize(state),
    toCall,
    opponents: opponents.length,
    selectivity: opponents.map((p) => opponentSelectivity(state, p)),
    board: state.community.slice(),
    committed: hero.committedThisStreet,
  }
}

export interface HandRead {
  /** The read, ready to render. One or two sentences. */
  text: string
  /**
   * What the arithmetic found. The copy already carries it, so nothing visual
   * hangs off this yet. It is here because every consumer of a read wants to
   * know, and because tests should assert on the judgement rather than the
   * prose.
   *
   * There are three of these rather than a boolean, and the third one is the
   * whole reason bets can be judged at all. `good` and `costly` are verdicts:
   * the choice gained or lost chips against the other one. **`priced` is not a
   * verdict.** It is an aggressive action the chips alone did not justify, and
   * calling that a mistake would be a lie, because folding an opponent out is
   * worth chips too and this module has no way to know how often that happens
   * (see `needsFold`). A consumer that colours `priced` red is saying a bluff
   * is wrong, which is not what was measured.
   */
  verdict: 'good' | 'costly' | 'priced'
  /**
   * `priced` reads only: the share of the time the opponents had to fold for
   * the bet or raise to beat checking or calling. Exact arithmetic, not an
   * estimate of whether they actually would.
   */
  needsFold?: number
}

/**
 * Monte-Carlo sample size for a post-hand read. Larger than the 800 the live
 * win% uses, because this runs off the critical path and the noise floor below
 * is only honest if the estimate is tighter than the edge it is judging: at
 * 1500 the standard error is at most 1.29 points, so `EDGE_FLOOR` sits a few
 * sigma clear of it.
 *
 * That is not a comment any more: `tests/noiseFloors.test.ts` derives the bound
 * from `ITERATIONS` and fails the build if the floor stops clearing it, so the
 * two constants can only move together.
 */
export const ITERATIONS = 1500

/** Decisions scored per hand, largest pot first. Bounds the work on a raise war. */
const MAX_ANALYSED = 4

/** Below this equity gap the estimate cannot tell right from wrong. Say nothing. */
export const EDGE_FLOOR = 0.05

/** And below one big blind of swing it is right but not worth anyone's attention. */
export const COST_FLOOR_IN_BB = 1

/** The hero's own actions this module can put a number against. */
export type HeroAction = 'call' | 'fold' | 'bet' | 'raise'

export interface Scored {
  decision: HeroDecision
  /** What the hero did at this moment. */
  action: HeroAction
  /**
   * The equity the moment demanded. For a call or a fold it is the price the
   * pot laid, `toCall / (pot + toCall)`. For a bet or a raise it is the share
   * of the pot the extra chips have to win back when everybody calls, which
   * works out at a fair share of the field, `1 / (opponents + 1)`, whenever
   * there was nothing to call (see `scoreAggressive`).
   */
  required: number
  /** Estimated share of the pot at that moment. */
  equity: number
  /**
   * Chips per point of equity above `required`, signed, so that
   * `margin === scale * (equity - required)` for every action. Folding is a
   * call with the sign flipped, which is the whole of [[coach-speaks-symmetrically]];
   * keeping it as one multiplier stops a second copy of that rule existing.
   */
  scale: number
  /** Chips the choice gained (positive) or cost (negative) against the alternative. */
  margin: number
  /**
   * Bets and raises whose `margin` is negative: the share of the time the
   * opponents had to fold for the aggression to break even against checking or
   * calling. Undefined everywhere else.
   */
  needsFold?: number
}

/**
 * Deterministic seed for the read, seeded off the hand itself, so the same hand
 * always gets the same number and a re-render never quietly changes the advice.
 */
function seedFor(record: HandRecord): number {
  const source = `${record.handNo}:${record.community.map((c) => `${c.rank}${c.suit}`).join('')}`
  let h = 2166136261
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function streetOf(board: readonly Card[]): string {
  if (board.length === 0) return 'preflop'
  if (board.length === 3) return 'flop'
  if (board.length === 4) return 'turn'
  return 'river'
}

/** "The turn call", "The preflop fold", "The flop bet". */
function momentOf(board: readonly Card[], action: HeroAction): string {
  const street = streetOf(board)
  return street === 'preflop' ? `The preflop ${action}` : `The ${street} ${action}`
}

const pct = (fraction: number): string => `${Math.round(fraction * 100)}%`

/**
 * The one decision worth talking about, or nothing.
 *
 * `null` when the hand carries no priced decision, when the record has no
 * decision snapshots (a hand decoded from a `/hand` permalink is the case that
 * matters, and the wire format does not carry them), or when the best one is
 * inside either floor.
 */
export function readHand(record: HandRecord, rng?: Rng): HandRead | null {
  const best = analyseHand(record, { rng })
  if (!best) return null
  if (Math.abs(best.equity - best.required) < EDGE_FLOOR) return null
  if (Math.abs(best.margin) < record.bigBlind * COST_FLOOR_IN_BB) return null
  if (best.needsFold !== undefined) {
    return { text: phrase(best), verdict: 'priced', needsFold: best.needsFold }
  }
  return { text: phrase(best), verdict: best.margin > 0 ? 'good' : 'costly' }
}

/**
 * The arithmetic behind `readHand`, without the two floors that decide whether
 * to say anything.
 *
 * Scores each priced hero decision by how much it gained or cost against the
 * other choice, in chips, and returns the largest, or `null` for a hand that
 * carries none. Separate from `readHand` so `scripts/coach-sim.ts` can re-score
 * the same hand under other seeds and see whether the read a player got was a
 * property of the hand or of the seed.
 */
export function analyseHand(
  record: HandRecord,
  opts: { rng?: Rng; iterations?: number } = {},
): Scored | null {
  const decisions = record.events.flatMap((ev) =>
    ev.kind === 'action' && ev.decision
      ? [{ playerId: ev.playerId, type: ev.type, amount: ev.amount, decision: ev.decision }]
      : [],
  )
  if (decisions.length === 0) return null

  // Only the hero's actions ever carry a snapshot, so the first one names them.
  const heroId = decisions[0].playerId
  const hole = record.reveals.find((r) => r.playerId === heroId)?.cards
  if (!hole || hole.length < 2) return null

  /** One hero action the arithmetic can price, and what it cost to take it. */
  type Priced = { action: HeroAction; decision: HeroDecision; put: number }

  const priced = decisions
    .flatMap<Priced>((d) => {
      const { toCall, opponents, committed } = d.decision
      if (opponents === 0) return []
      if (d.type === 'call' || d.type === 'fold') {
        return toCall > 0 ? [{ action: d.type, decision: d.decision, put: toCall }] : []
      }
      if (d.type !== 'bet' && d.type !== 'raise') return []
      // What this aggression actually cost, which on a raise is not `amount`:
      // that is a "to" total for the street and some of it is already in.
      const put = (d.amount ?? 0) - (committed ?? 0)
      // A bet or raise that risks no more than calling would have is either a
      // record we cannot price or an all-in call wearing the wrong label.
      return put > toCall ? [{ action: d.type, decision: d.decision, put }] : []
    })
    .sort((a, b) => b.decision.pot + b.put - (a.decision.pot + a.put))
    .slice(0, MAX_ANALYSED)
  if (priced.length === 0) return null

  const random = opts.rng ?? mulberry32(seedFor(record))
  const scored: Scored[] = priced.map(({ action, decision, put }) => {
    const { equity } = estimateEquity({
      hole,
      community: decision.board,
      opponents: decision.opponents,
      opponentSelectivity: decision.selectivity,
      iterations: opts.iterations ?? ITERATIONS,
      rng: random,
    })
    return action === 'bet' || action === 'raise'
      ? scoreAggressive(action, decision, put, equity)
      : scorePriced(action, decision, equity)
  })

  return scored.reduce((a, b) => (Math.abs(b.margin) > Math.abs(a.margin) ? b : a))
}

/**
 * A call or a fold, priced against the pot.
 *
 * Calling is worth `finalPot * (equity - required)` more than folding, and
 * folding is worth exactly that much less. One number, two signs.
 */
function scorePriced(action: 'call' | 'fold', decision: HeroDecision, equity: number): Scored {
  const finalPot = decision.pot + decision.toCall
  const required = decision.toCall / finalPot
  const scale = action === 'fold' ? -finalPot : finalPot
  return { decision, action, required, equity, scale, margin: scale * (equity - required) }
}

/**
 * A bet or a raise, priced in the branch where nobody folds.
 *
 * **This is the whole of how bets can be judged without modelling fold equity,
 * which the engine does not have and this module will not invent.** Score the
 * aggression against its passive alternative assuming every live opponent
 * calls. That is the worst the bet can do, because folding an opponent out is
 * never worth less than the pot it wins uncontested, so a bet that is already
 * ahead in this branch is ahead full stop, whatever the opponents would have
 * done. The verdict it produces is a **bound**, not an estimate.
 *
 * The arithmetic, writing `n` for the live opponents and `put` for the chips
 * this action adds. Everyone calls to the hero's total, so the pot grows by
 * `(n + 1) * put`, and the alternative was to put in `toCall` and win a pot
 * smaller by that much:
 *
 * ```
 *   gain = equity * ((n + 1) * put - toCall) - (put - toCall)
 * ```
 *
 * The pot before the action cancels out of both sides, which is why `required`
 * below depends only on the price of the aggression and the size of the field.
 * With nothing to call it reduces to `equity > 1 / (n + 1)`, a fair share of
 * the field, the same form the AI's own postflop gates take.
 *
 * When that gain is negative the bet needed folds, and exactly how many is also
 * arithmetic: folding everyone out wins `pot + toCall` that the alternative
 * only won `equity` of, so `needsFold` is where the two branches cross. **That
 * number is not a verdict.** Whether the opponents fold that often is the
 * unknown, and `readHand` says the number rather than guessing the answer.
 */
function scoreAggressive(
  action: 'bet' | 'raise',
  decision: HeroDecision,
  put: number,
  equity: number,
): Scored {
  const { pot, toCall, opponents } = decision
  const scale = (opponents + 1) * put - toCall
  const required = (put - toCall) / scale
  const margin = scale * (equity - required)
  if (margin >= 0) return { decision, action, required, equity, scale, margin }
  // Winning it now is worth `pot + toCall`; the alternative won `equity` of it.
  const ifTheyFold = (pot + toCall) * (1 - equity)
  return {
    decision,
    action,
    required,
    equity,
    scale,
    margin,
    needsFold: -margin / (ifTheyFold - margin),
  }
}

/**
 * The copy. Calm, and never a telling-off: Pip is a good player looking over
 * your shoulder, not a coach with a whistle. "Folding was cheaper" beats "that
 * was a mistake", and the hands they got right are worth as much airtime as the
 * ones they did not.
 *
 * "About" belongs on anything the simulation touched and nowhere else. The
 * price the pot laid and the share a bet's extra chips have to win back are
 * arithmetic and they are exact; the equity is fifteen hundred simulations, and
 * so is the fold frequency derived from it. Pretending otherwise would be the
 * first dishonest thing in the feature.
 */
function phrase(s: Scored): string {
  const moment = momentOf(s.decision.board, s.action)
  if (s.action === 'bet' || s.action === 'raise') return phraseAggressive(s, moment)
  const price = `You needed ${pct(s.required)} and had about ${pct(s.equity)}`
  if (s.action === 'fold') {
    return s.margin > 0
      ? `${moment}. ${price}. Good laydown.`
      : `${moment}. ${price}. That one was worth a call.`
  }
  const stake = `you put in ${formatChips(s.decision.toCall)} to win ${formatChips(s.decision.pot)}`
  return s.margin > 0
    ? `${moment}. ${price}, so ${stake} on the right side of it. Good call.`
    : `${moment}. ${price}, so ${stake} on the wrong side of it. Folding was the cheaper option.`
}

/**
 * The copy for a bet or a raise, which has one more job than the rest: it has
 * to criticise without passing a verdict it cannot support.
 *
 * A bet that is ahead when everybody calls gets one, and it is the strongest
 * sentence this module says about anything, because folds can only add to it.
 * A bet that is behind gets the fold frequency it was asking for and no
 * judgement, because a bet asking for folds is how poker is played and calling
 * it a mistake would be the invented number this feature has gone out of its
 * way not to have.
 */
function phraseAggressive(s: Scored, moment: string): string {
  const held = `You had about ${pct(s.equity)} and those chips needed ${pct(s.required)}`
  if (s.needsFold === undefined) {
    return `${moment}. ${held}, so it paid even if nobody folded. Good ${s.action}.`
  }
  return `${moment}. ${held}, so it wanted them to fold about ${pct(s.needsFold)} of the time.`
}
