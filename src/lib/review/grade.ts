/**
 * What a scored decision is worth saying about it, and in what tone.
 *
 * The session review shows every priced decision of every hand, which is a very
 * different job from `lib/coach.ts`'s one-line read: the read's job is to be
 * silent unless it has something, and this one's job is to account for the
 * whole session without ever overstating a single spot. So the two floors that
 * make the read quiet appear here as a *grade* instead of as silence — a spot
 * inside the noise is marked `close` and says so, rather than vanishing from a
 * list that claims to be complete.
 *
 * **Everything is in big blinds.** A hand at Friends' Garage and a hand at The
 * Main Event are four decimal places apart in chips and identical in blinds, so
 * chips cannot be summed across a session, let alone a career. Chips are still
 * shown next to a single decision, where they are what the player actually
 * pushed; nothing is ever *added up* in them.
 *
 * **Nothing here grades a bet, and that is about what this file knows.** These
 * grades come off `lib/coach.ts`, which sees only what the player could see —
 * and what makes a bet good is fold equity, a guess about an opponent rather
 * than a number on the table. The report is built on these, so it stays a
 * report about calls and folds.
 *
 * The review grades bets too, and it is allowed to because it is asking a
 * different question with every card face up: see `lib/review/moveGrade.ts`.
 */

import { EDGE_FLOOR, type PricedStreet, type Scored, streetOf } from '@/lib/coach'

/**
 * How thin an edge still counts as sharp.
 *
 * A call that was right by forty points was right the way a card back is blue;
 * a call that was right by six is a read. Both get credit, but only one of them
 * is worth a player's attention, and a review that cannot tell them apart is a
 * review that congratulates you for showing up.
 */
export const SHARP_EDGE = 0.12

/** Big blinds given up before a mistake is called costly rather than a slip. */
export const COSTLY_BB = 4

export type Grade = 'sharp' | 'sound' | 'close' | 'slip' | 'costly'

/** Did this decision go the way the price said, or not, or was it unknowable? */
export type Verdict = 'right' | 'wrong' | 'unknowable'

export interface GradedDecision {
  /** Which entry of `record.events` this was — the replay anchors to it. */
  eventIndex: number
  street: PricedStreet
  folded: boolean
  /** The price the pot laid, as a fraction. */
  required: number
  /** Estimated share of the pot. Always spoken of as "about". */
  equity: number
  /** Chips it cost to call, and what was in the pot before it. */
  toCall: number
  pot: number
  /** Chips the choice gained (+) or gave up (−) against the other one. */
  margin: number
  /** The same, in big blinds. The only unit that may be summed. */
  bb: number
  grade: Grade
  verdict: Verdict
}

export function verdictOf(grade: Grade): Verdict {
  if (grade === 'close') return 'unknowable'
  return grade === 'sharp' || grade === 'sound' ? 'right' : 'wrong'
}

/**
 * Grade one scored decision.
 *
 * `bigBlind` comes from the hand rather than the venue because blinds climb: a
 * decision on hand 40 of a tournament is priced in the blinds that were on the
 * table when it was made, not the ones the tournament started with.
 */
export function gradeDecision(scored: Scored, bigBlind: number): GradedDecision {
  const edge = Math.abs(scored.equity - scored.required)
  const bb = bigBlind > 0 ? scored.margin / bigBlind : 0
  const grade: Grade =
    edge < EDGE_FLOOR
      ? 'close'
      : scored.margin > 0
        ? edge < SHARP_EDGE
          ? 'sharp'
          : 'sound'
        : Math.abs(bb) >= COSTLY_BB
          ? 'costly'
          : 'slip'
  return {
    eventIndex: scored.eventIndex,
    street: streetOf(scored.decision.board),
    folded: scored.folded,
    required: scored.required,
    equity: scored.equity,
    toCall: scored.decision.toCall,
    pot: scored.decision.pot,
    margin: scored.margin,
    bb,
    grade,
    verdict: verdictOf(grade),
  }
}

/**
 * What to call it, on a chip beside the hand.
 *
 * Calm, and never a telling-off — the house style `lib/coach.ts` sets. "A touch
 * loose" is a thing a good player says over your shoulder; "Mistake" is a thing
 * a machine says, and a machine that is sampling its own evidence has not
 * earned it.
 */
export function gradeLabel(d: Pick<GradedDecision, 'grade' | 'folded'>): string {
  switch (d.grade) {
    case 'sharp':
      return d.folded ? 'Sharp laydown' : 'Sharp call'
    case 'sound':
      return d.folded ? 'Good fold' : 'Good call'
    case 'close':
      return 'Nothing in it'
    case 'slip':
      return d.folded ? 'A touch tight' : 'A touch loose'
    case 'costly':
      return d.folded ? 'Folded the best of it' : 'Paid too much'
  }
}

/**
 * The arithmetic, said the way the free read says it. One sentence.
 *
 * Kept exported and unused by the review, which grades moves against the cards
 * they actually held instead (lib/review/moveGrade). This is the other half of
 * the pair — what the price alone said — and the report is built on it.
 */
export function priceLine(d: GradedDecision): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`
  return `You needed ${pct(d.required)} and had about ${pct(d.equity)}`
}

/**
 * What it was worth, in blinds, or null when the answer is "nothing worth
 * counting". Below a tenth of a blind the number is rounding, and a review
 * printing "0.0bb" beside a verdict looks like it has lost its nerve.
 */
export function marginLine(d: GradedDecision): string | null {
  if (d.grade === 'close' || Math.abs(d.bb) < 0.1) return null
  const size = `${Math.abs(d.bb).toFixed(1)} big blinds`
  if (d.verdict === 'right') return `Worth ${size}`
  return d.folded ? `Calling was worth ${size}` : `Folding was ${size} cheaper`
}

/** Which grades are worth a player's attention when they filter the list. */
export function isMistake(grade: Grade): boolean {
  return grade === 'slip' || grade === 'costly'
}
