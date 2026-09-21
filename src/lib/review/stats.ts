/**
 * What every priced decision you have ever made adds up to.
 *
 * The session review is one afternoon; this is the career, and it is what lets
 * the report say **where** the money goes rather than only how often you fold.
 * "You win 38% of your showdowns" is a rate — true, and it does not tell you
 * that the river is costing you four big blinds a hundred hands while the flop
 * is costing you nothing.
 *
 * **Everything is counted in big blinds.** A hand at Friends' Garage and a hand
 * at The Main Event are four decimal places apart in chips and identical in
 * blinds, and this table spans a whole career of both.
 *
 * **Collected for everybody, read by the membership.** The game store fills
 * this in at every reviewed table without asking who is paying — it is
 * forbidden from knowing (`tests/membershipSurfaces.test.ts`) — so the day
 * somebody joins, the report has their history in it rather than an instruction
 * to go and play. The cost is a few hundred bytes on a profile.
 */

import type { PricedStreet } from '@/lib/coach'
import { encodeHand } from '@/lib/handLink'
import { isMistake } from './grade'
import type { ReviewHand } from './session'

/** One bucket of priced decisions. */
export interface DecisionTally {
  /** Decisions the price could settle either way. */
  priced: number
  /** How many went the right side of it. */
  right: number
  /** Big blinds given up at the ones that did not. Positive. */
  bbLost: number
  /**
   * Spots inside the noise floor: priced, but the estimate cannot call them.
   *
   * Counted separately and never folded into either column — they are not
   * right and they are not wrong, and putting them in either would be the one
   * dishonest number in the feature. Optional because the first build of this
   * table did not have it; `?? 0` is the whole migration.
   */
  close?: number
}

/**
 * Which failure a hand is evidence of.
 *
 * Named for the mistake rather than for the finding that cites it, so that
 * `lib/deepCoach.ts` can change its mind about what to call a leak without
 * orphaning everything this has already stored. A single decision can land in
 * two buckets — a bad river call is a loose call *and* a river call — and that
 * is deliberate: they are two different sentences a report might want to prove.
 */
export type EvidenceKey = 'loose-call' | 'tight-fold' | 'river-call' | 'preflop-call'

export interface EvidenceHand {
  /** The hand itself, as a `/hand` permalink token. Self-contained, no server. */
  token: string
  /** The verdict, already written, so nothing has to re-run the simulation. */
  line: string
  /** Big blinds given up. Negative. Ranks the bucket. */
  bb: number
}

/** How many examples a bucket keeps. Enough to be a pattern, few enough to read. */
export const EVIDENCE_PER_KEY = 3

export interface ReviewStats {
  /** Hands folded in — the denominator for anything "per 100 hands". */
  hands: number
  byStreet: Record<PricedStreet, DecisionTally>
  /** The same decisions split by what was actually done. */
  calls: DecisionTally
  folds: DecisionTally
  evidence: Partial<Record<EvidenceKey, EvidenceHand[]>>
}

export function emptyDecisionTally(): DecisionTally {
  return { priced: 0, right: 0, bbLost: 0, close: 0 }
}

export function emptyReviewStats(): ReviewStats {
  return {
    hands: 0,
    byStreet: {
      preflop: emptyDecisionTally(),
      flop: emptyDecisionTally(),
      turn: emptyDecisionTally(),
      river: emptyDecisionTally(),
    },
    calls: emptyDecisionTally(),
    folds: emptyDecisionTally(),
    evidence: {},
  }
}

function add(tally: DecisionTally, verdict: 'right' | 'wrong' | 'unknowable', bb: number) {
  tally.priced++
  if (verdict === 'unknowable') tally.close = (tally.close ?? 0) + 1
  else if (verdict === 'right') tally.right++
  else tally.bbLost += Math.abs(bb)
}

/**
 * Fold one reviewed hand into the career table.
 *
 * Pure, and it returns a new object: the profile store's `set` compares by
 * reference, and a counter mutated in place is a counter that does not
 * re-render the screen reading it.
 */
export function foldHand(stats: ReviewStats, hand: ReviewHand): ReviewStats {
  const next: ReviewStats = {
    hands: stats.hands + 1,
    byStreet: {
      preflop: { ...stats.byStreet.preflop },
      flop: { ...stats.byStreet.flop },
      turn: { ...stats.byStreet.turn },
      river: { ...stats.byStreet.river },
    },
    calls: { ...stats.calls },
    folds: { ...stats.folds },
    evidence: { ...stats.evidence },
  }

  for (const d of hand.decisions) {
    add(next.byStreet[d.street], d.verdict, d.bb)
    add(d.folded ? next.folds : next.calls, d.verdict, d.bb)
  }

  // Only a real mistake is worth keeping a hand for. Evidence is the report's
  // answer to "says who?", and a 0.4bb slip is not an answer.
  const worst = hand.decisions.filter((d) => isMistake(d.grade)).sort((a, b) => a.bb - b.bb)[0]
  if (worst) {
    const keys: EvidenceKey[] = worst.folded ? ['tight-fold'] : ['loose-call']
    if (worst.street === 'river') keys.push('river-call')
    if (worst.street === 'preflop') keys.push('preflop-call')
    const example: EvidenceHand = {
      token: encodeHand(hand.record),
      line: `The ${worst.street} ${worst.folded ? 'fold' : 'call'} — ${Math.abs(worst.bb).toFixed(1)} big blinds`,
      bb: worst.bb,
    }
    for (const key of keys) {
      next.evidence[key] = [...(stats.evidence[key] ?? []), example]
        .sort((a, b) => a.bb - b.bb)
        .slice(0, EVIDENCE_PER_KEY)
    }
  }

  return next
}

/** Big blinds given up per hundred hands, or null below a usable sample. */
export function bbPer100(tally: DecisionTally, hands: number): number | null {
  if (hands < 1 || tally.priced === 0) return null
  return (tally.bbLost / hands) * 100
}
