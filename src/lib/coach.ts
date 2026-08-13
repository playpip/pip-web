/**
 * Per-hand coaching: one honest read on the hand you just played.
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
 * implied odds or the chance of being bet off later. Bets and raises are not
 * judged at all: what makes them good is fold equity, which is a guess about
 * the opponent rather than a number on the table.
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
}

export interface HandRead {
  /** The read, ready to render. One or two sentences. */
  text: string
  /**
   * Was it the right call on the numbers? The copy already carries the verdict,
   * so nothing visual hangs off this yet. It is here because every consumer of
   * a read wants to know, and because tests should assert on the judgement
   * rather than on the prose.
   */
  good: boolean
}

/**
 * Monte-Carlo sample size for a post-hand read. Larger than the 800 the live
 * win% uses, because this runs off the critical path and the noise floor below
 * is only honest if the estimate is tighter than the edge it is judging: at
 * 1500 the standard error is around 1.3 points, so `EDGE_FLOOR` sits a few
 * sigma clear of it.
 */
const ITERATIONS = 1500

/** Decisions scored per hand, largest pot first. Bounds the work on a raise war. */
const MAX_ANALYSED = 4

/** Below this equity gap the estimate cannot tell right from wrong. Say nothing. */
const EDGE_FLOOR = 0.05

/** And below one big blind of swing it is right but not worth anyone's attention. */
const COST_FLOOR_IN_BB = 1

interface Scored {
  decision: HeroDecision
  folded: boolean
  /** The price the pot laid, as a fraction: `toCall / (pot + toCall)`. */
  required: number
  /** Estimated share of the pot at that moment. */
  equity: number
  /** Chips the choice gained (positive) or cost (negative) against the alternative. */
  margin: number
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

/** "The turn call", "The preflop fold". */
function momentOf(board: readonly Card[], folded: boolean): string {
  const street = streetOf(board)
  const action = folded ? 'fold' : 'call'
  return street === 'preflop' ? `The preflop ${action}` : `The ${street} ${action}`
}

const pct = (fraction: number): string => `${Math.round(fraction * 100)}%`

/**
 * The one decision worth talking about, or nothing.
 *
 * Scores each priced hero decision by how much it gained or cost against the
 * other choice, in chips, and surfaces the largest. Returns `null` when the
 * hand carries no priced decision, when the record has no decision snapshots
 * (a hand decoded from a `/hand` permalink is the case that matters, and the wire
 * format does not carry them), or when nothing clears the noise floor.
 */
export function readHand(record: HandRecord, rng?: Rng): HandRead | null {
  const decisions = record.events.flatMap((ev) =>
    ev.kind === 'action' && ev.decision
      ? [{ playerId: ev.playerId, type: ev.type, decision: ev.decision }]
      : [],
  )
  if (decisions.length === 0) return null

  // Only the hero's actions ever carry a snapshot, so the first one names them.
  const heroId = decisions[0].playerId
  const hole = record.reveals.find((r) => r.playerId === heroId)?.cards
  if (!hole || hole.length < 2) return null

  const priced = decisions
    .filter(
      (d) =>
        (d.type === 'call' || d.type === 'fold') &&
        d.decision.toCall > 0 &&
        d.decision.opponents > 0,
    )
    .sort((a, b) => b.decision.pot + b.decision.toCall - (a.decision.pot + a.decision.toCall))
    .slice(0, MAX_ANALYSED)
  if (priced.length === 0) return null

  const random = rng ?? mulberry32(seedFor(record))
  const scored: Scored[] = priced.map(({ type, decision }) => {
    const finalPot = decision.pot + decision.toCall
    const required = decision.toCall / finalPot
    const { equity } = estimateEquity({
      hole,
      community: decision.board,
      opponents: decision.opponents,
      opponentSelectivity: decision.selectivity,
      iterations: ITERATIONS,
      rng: random,
    })
    // Calling is worth `finalPot * (equity - required)` more than folding, and
    // folding is worth exactly that much less. One number, two signs.
    const swing = finalPot * (equity - required)
    const folded = type === 'fold'
    return { decision, folded, required, equity, margin: folded ? -swing : swing }
  })

  const best = scored.reduce((a, b) => (Math.abs(b.margin) > Math.abs(a.margin) ? b : a))
  if (Math.abs(best.equity - best.required) < EDGE_FLOOR) return null
  if (Math.abs(best.margin) < record.bigBlind * COST_FLOOR_IN_BB) return null

  return { text: phrase(best), good: best.margin > 0 }
}

/**
 * The copy. Calm, and never a telling-off: Pip is a good player looking over
 * your shoulder, not a coach with a whistle. "Folding was cheaper" beats "that
 * was a mistake", and the hands they got right are worth as much airtime as the
 * ones they did not.
 *
 * "About" belongs on the equity and nowhere else. The price the pot laid is
 * arithmetic and it is exact; the equity is fifteen hundred simulations and
 * pretending otherwise would be the first dishonest thing in the feature.
 */
function phrase(s: Scored): string {
  const moment = momentOf(s.decision.board, s.folded)
  const price = `You needed ${pct(s.required)} and had about ${pct(s.equity)}`
  if (s.folded) {
    return s.margin > 0
      ? `${moment}. ${price}. Good laydown.`
      : `${moment}. ${price}. That one was worth a call.`
  }
  const stake = `you put in ${formatChips(s.decision.toCall)} to win ${formatChips(s.decision.pot)}`
  return s.margin > 0
    ? `${moment}. ${price}, so ${stake} on the right side of it. Good call.`
    : `${moment}. ${price}, so ${stake} on the wrong side of it. Folding was the cheaper option.`
}
