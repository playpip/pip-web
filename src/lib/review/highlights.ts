/**
 * The hands worth opening first.
 *
 * A session of forty hands is thirty-five hands where nothing happened, and a
 * review that lists them flat asks the player to find the interesting ones
 * themselves. This picks them out: the pot that decided the session, the call
 * that cost the most, the laydown nobody else makes, the one time they made
 * quads.
 *
 * **Everything here is counted, not guessed.** A highlight is a fact about the
 * hand — chips won, a graded decision, a hand shown at showdown — with a short
 * line saying which. Nothing is "exciting" because a model thought so.
 *
 * **Sizes are in big blinds.** A 400-chip pot is the session at the Garage and
 * a rounding error at the Main Event; blinds climb inside a tournament too, so
 * even one session cannot compare its own hands in chips.
 */

import { isMistake } from './grade'
import type { ReviewHand, ReviewSession } from './session'

/** How big a pot swing is worth marking, in big blinds. */
const BIG_SWING_BB = 12
/** How much a good call has to be worth before it is worth pointing at. */
const GOOD_CALL_BB = 3
/**
 * And how much a mistake has to have cost.
 *
 * Under a blind, the spot is real — it stays in the hand's own list, graded —
 * but it is not one of the six things to look at first. A strip of highlights
 * led by three quarters of a big blind is a strip nobody opens twice.
 */
const WORTH_SAYING_BB = 1

export type HighlightKind = 'won' | 'lost' | 'costly' | 'sharp' | 'made'

export interface Highlight {
  /** Which hand in `session.hands`. */
  index: number
  kind: HighlightKind
  /** Two or three words, on a chip. */
  label: string
  /** One line: why this hand is here. */
  note: string
  /** Attention, descending. Big blinds, so kinds can be compared. */
  weight: number
}

/**
 * Hands you would tell someone about.
 *
 * pokersolver's category label is the evidence for a made hand, and its
 * presence is the evidence that the player was still there to make it: the
 * store only fills `handName` in for a player who reached a showdown
 * (`buildHandRecord`), so a hand folded on the flop can never claim the quads
 * the river happened to bring. "Straight Flush" covers a royal — the library
 * has no separate name for one, which the blog has a whole post about.
 */
const RARE_HANDS = new Set(['Straight Flush', 'Four of a Kind', 'Full House', 'Flush', 'Straight'])

function bbOf(hand: ReviewHand): number {
  const bb = hand.record.bigBlind
  return bb > 0 ? (hand.record.heroDelta ?? 0) / bb : 0
}

/** Everything notable about one hand, strongest first. Usually nothing. */
export function highlightsOfHand(hand: ReviewHand, index: number): Highlight[] {
  const found: Highlight[] = []
  const swing = bbOf(hand)
  const shown = hand.record.reveals.find((r) => r.playerId === 'hero')

  if (swing >= BIG_SWING_BB) {
    found.push({
      index,
      kind: 'won',
      label: 'Big pot',
      note: `Won ${Math.round(swing)}bb`,
      weight: swing,
    })
  } else if (swing <= -BIG_SWING_BB) {
    found.push({
      index,
      kind: 'lost',
      label: 'Expensive',
      note: `Lost ${Math.round(-swing)}bb`,
      weight: -swing,
    })
  }

  const worst = hand.decisions
    .filter((d) => isMistake(d.grade) && Math.abs(d.bb) >= WORTH_SAYING_BB)
    .sort((a, b) => a.bb - b.bb)[0]
  if (worst) {
    found.push({
      index,
      kind: 'costly',
      // Named for the moment, not for the verdict: "the turn call" is a thing
      // you can go and look at, and a strip of cards all reading "Worth a look"
      // under a heading that says Worth a look is a strip that says nothing.
      label: `The ${worst.street} ${worst.folded ? 'fold' : 'call'}`,
      note: `Gave up ${Math.abs(worst.bb).toFixed(1)}bb`,
      weight: Math.abs(worst.bb) * 1.5, // a mistake outranks a pot of the same size
    })
  }

  const best = hand.decisions
    .filter((d) => d.grade === 'sharp' && d.bb >= GOOD_CALL_BB)
    .sort((a, b) => b.bb - a.bb)[0]
  if (best) {
    found.push({
      index,
      kind: 'sharp',
      label: best.folded ? 'Sharp laydown' : 'Sharp call',
      note: `${best.street}, and the price was close`,
      weight: best.bb,
    })
  }

  if (shown?.handName && RARE_HANDS.has(shown.handName)) {
    found.push({
      index,
      kind: 'made',
      label: shown.handName,
      note: `You showed it down`,
      weight: Math.max(Math.abs(swing), GOOD_CALL_BB),
    })
  }

  return found.sort((a, b) => b.weight - a.weight)
}

/**
 * The session's highlights, best first, one per hand.
 *
 * One per hand because these are a way *into* the session — a list that offers
 * the same hand three times under three headings is a list that has forgotten
 * it is a table of contents.
 */
export function highlightsOf(session: ReviewSession, limit = 6): Highlight[] {
  return session.hands
    .flatMap((hand, index) => highlightsOfHand(hand, index).slice(0, 1))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
}

/** Does this hand carry anything worth marking in the list? */
export function isNotable(hand: ReviewHand, index: number): boolean {
  return highlightsOfHand(hand, index).length > 0
}
