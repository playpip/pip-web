/**
 * What to say at each step of a replayed hand.
 *
 * Two lines at most: **what happened**, and — only when it was one of your own
 * priced decisions — **what the price said about it**. Pure, so the sentence a
 * player reads is testable and cannot quietly become advice built on a card
 * they could not see.
 *
 * **Bets and raises get described, never graded.** What makes a bet good is
 * whether they fold, which is a guess about somebody else rather than a number
 * on the table — `lib/coach.ts` sets that line and everything downstream of it
 * keeps it. "You should have bet here" would be the first dishonest sentence in
 * the feature, and it would be the most quotable one.
 */

import { priceLine } from './grade'
import { HERO_ID, type ReplayStep } from './handState'
import { gradeMove, gradeable, type MoveGrade } from './moveGrade'
import type { ReviewHand } from './session'

export interface Commentary {
  /** What just happened, in a few words. */
  said: string
  /** The engine's read on it, when there is one to give. */
  verdict: string | null
  tone: 'good' | 'bad' | 'flat'
  /** The graded move this step landed on, for the chip beside the line. */
  move: MoveGrade | null
}

/** "Flop" → "The flop lands." */
const BOARD_LINE: Record<string, string> = {
  Flop: 'The flop.',
  Turn: 'The turn.',
  River: 'The river.',
  Runout: 'All in — the rest of the board runs out.',
}

export function commentaryAt(
  hand: ReviewHand,
  frame: ReplayStep,
  money: (n: number) => string,
  /** Memoised equity, shared with the seat badges. See `gradeMove`. */
  solve?: Parameters<typeof gradeMove>[2],
): Commentary {
  const { record } = hand
  const event = frame.lastEvent

  // Before the first step, and after the last: bookends, rather than an empty
  // line that reads as something failing to load.
  if (!event) return { said: 'Cards in the air.', verdict: null, tone: 'flat', move: null }

  if (event.kind === 'board') {
    return {
      said: BOARD_LINE[event.label] ?? `The ${event.label.toLowerCase()}.`,
      verdict: null,
      tone: 'flat',
      move: null,
    }
  }

  const verb =
    event.type === 'fold'
      ? ['folds', 'fold']
      : event.type === 'check'
        ? ['checks', 'check']
        : event.type === 'call'
          ? [`calls ${money(event.amount ?? 0)}`, `call ${money(event.amount ?? 0)}`]
          : event.type === 'bet'
            ? [`bets ${money(event.amount ?? 0)}`, `bet ${money(event.amount ?? 0)}`]
            : event.type === 'draw'
              ? ['draws', 'draw']
              : [`raises to ${money(event.amount ?? 0)}`, `raise to ${money(event.amount ?? 0)}`]

  const mine = event.playerId === HERO_ID
  const said = mine ? `You ${verb[1]}.` : `${event.playerName} ${verb[0]}.`
  const tail = frame.done && record.summary ? record.summary : null

  // **Everybody's move is graded, not only yours** — seeing where the table
  // went wrong is most of what makes a replay worth stepping through, and the
  // arithmetic does not care whose turn it was (lib/review/moveGrade).
  const move = gradeMove(record, frame.lastIndex, solve, money)
  if (!move) {
    // A hand from before the review kept what a rating needs shows nothing at
    // all otherwise, which reads as the feature being broken rather than as the
    // hand being old.
    const why = gradeable(record) ? tail : 'Played before ratings — this hand is not graded.'
    return { said, verdict: why, tone: 'flat', move: null }
  }

  return {
    said,
    verdict: `${move.line}${priceNote(hand, frame.lastIndex, move.bb)}`,
    tone:
      move.verdict === 'mistake' || move.verdict === 'blunder'
        ? 'bad'
        : move.verdict === 'standard'
          ? 'flat'
          : 'good',
    move,
  }
}

/**
 * The one sentence that stops a review teaching the wrong lesson.
 *
 * The rating is hindsight — every card face up — and hindsight is the point of
 * a replay. But a call that was right on the price and lost is not a mistake,
 * and a call that was wrong on the price and got there is not a read. Where the
 * two disagree, this says so, using the price the pot actually laid
 * (`lib/coach.ts`, which sees only what you could see).
 *
 * Only your own calls and folds carry that second opinion: they are the only
 * moves scored from a snapshot of what was visible at the time.
 */
function priceNote(hand: ReviewHand, eventIndex: number, gained: number): string {
  const priced = hand.decisions.find((d) => d.eventIndex === eventIndex)
  if (!priced || priced.verdict === 'unknowable') return ''
  if (priced.verdict === 'right' && gained < 0) {
    return ` ${priceLine(priced)}, so the price justified it — they just had it.`
  }
  if (priced.verdict === 'wrong' && gained > 0) {
    return ` ${priceLine(priced)}, though, so it got there rather than being right.`
  }
  return ''
}
