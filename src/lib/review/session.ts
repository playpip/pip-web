/**
 * The session you just played, kept so it can be reviewed.
 *
 * **One session, and the next one replaces it** (Will, 2026-09-20). Not a
 * library, not an inbox, nothing with a date on it you could fall behind on —
 * `lib/recap.ts` made the same call about runs and the reasoning is the same:
 * a history is the thing that turns a report into pressure. What this adds over
 * the recap is that the hands themselves survive, so the review can show you
 * the spot rather than describe it.
 *
 * **Collected for everybody, shown to members.** Nothing in here asks who is
 * paying, and the game store that fills it is forbidden from knowing
 * (`tests/membershipSurfaces.test.ts`). That is worth the few kilobytes: a
 * player who joins on a Tuesday gets a review of Tuesday's session and a report
 * with a year of counting behind it, rather than an empty screen and an
 * instruction to go and play.
 *
 * Kept in `localStorage` rather than in the store so it survives the refresh
 * that the table snapshot already survives, and so the review screen — which is
 * not the table and never mounts the game store — can read it.
 */

import type { HandRecord } from '@/store/game'
import type { Scored } from '@/lib/coach'
import { type GradedDecision, gradeDecision, isMistake } from './grade'

const REVIEW_KEY = 'pip.review'

/**
 * How many hands one session keeps.
 *
 * A cap, because an afternoon at a cash table has no end and `localStorage` is
 * five megabytes for the whole app. At roughly 1.5KB a hand this is under
 * 450KB, and 300 hands is far longer than any tournament runs. **When it bites
 * it drops the oldest hands and says so on the screen** — a review claiming to
 * be your session while quietly holding half of it would be the dishonest
 * version of this compromise.
 */
export const MAX_REVIEW_HANDS = 300

export interface ReviewHand {
  record: HandRecord
  /** Every priced decision in the hand, graded. Empty is normal and common. */
  decisions: GradedDecision[]
}

export type SessionOutcome =
  | { kind: 'stood-up'; rollDelta: number }
  | { kind: 'busted'; place: number | null; seats: number }
  | { kind: 'won'; seats: number }

export interface ReviewSession {
  venueId: string
  venueName: string
  /** The venue's accent, carried so the screen need not resolve the venue. */
  accent: string
  /** Tournament or cash table — they finish in different ways. */
  cash: boolean
  startedAt: number
  /** Null while the session is still being played. */
  endedAt: number | null
  outcome: SessionOutcome | null
  hands: ReviewHand[]
  /** Hands played beyond `MAX_REVIEW_HANDS`, dropped from the front. */
  dropped: number
}

// --- storage ---------------------------------------------------------------

export function loadReview(): ReviewSession | null {
  try {
    const raw = localStorage.getItem(REVIEW_KEY)
    return raw ? (JSON.parse(raw) as ReviewSession) : null
  } catch {
    return null
  }
}

function save(session: ReviewSession) {
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(session))
  } catch {
    /* storage full or unavailable — the review is simply not kept */
  }
}

export function clearReview() {
  try {
    localStorage.removeItem(REVIEW_KEY)
  } catch {
    /* nothing to do */
  }
}

/**
 * Open a session. Called at sit-down, and it throws the last one away.
 *
 * Deliberately not "start one if none exists": sitting down is the moment the
 * previous session stopped being the one you are playing, and keeping it until
 * the first hand lands would mean a player who sat down and stood up again
 * reviewing somebody else's table.
 */
export function startReviewSession(venue: {
  id: string
  name: string
  accent: string
  cash?: boolean
}) {
  save({
    venueId: venue.id,
    venueName: venue.name,
    accent: venue.accent,
    cash: venue.cash === true,
    startedAt: Date.now(),
    endedAt: null,
    outcome: null,
    hands: [],
    dropped: 0,
  })
}

/**
 * Add a finished hand to the open session.
 *
 * Takes decisions already scored — the store pays for that pass once and spends
 * it on the free read as well (see `readFrom` in lib/coach.ts). No-ops when no
 * session is open, which is every table the review does not cover.
 */
export function appendReviewHand(record: HandRecord, scored: readonly Scored[]): ReviewHand | null {
  const session = loadReview()
  if (!session || session.endedAt !== null) return null
  const hand: ReviewHand = {
    record,
    decisions: scored.map((s) => gradeDecision(s, record.bigBlind)),
  }
  session.hands.push(hand)
  while (session.hands.length > MAX_REVIEW_HANDS) {
    session.hands.shift()
    session.dropped++
  }
  save(session)
  return hand
}

/**
 * Close the session off.
 *
 * Only the first call counts. A tournament stamps itself the moment the last
 * chip goes, and the `leave()` that follows a player pressing Home must not
 * relabel a knockout as a walk to the door. A cash table is the other way
 * round: busting there is not the end of anything (you can rebuy and sit
 * straight back down), so only standing up closes it.
 */
export function endReviewSession(outcome: SessionOutcome) {
  const session = loadReview()
  if (!session || session.endedAt !== null) return
  session.endedAt = Date.now()
  session.outcome = outcome
  save(session)
}

// --- reading it ------------------------------------------------------------

export interface SessionTally {
  hands: number
  /** Hands that carried a decision the price could settle. */
  handsWithDecisions: number
  priced: number
  right: number
  wrong: number
  /** Spots the estimate could not call either way. Counted, never hidden. */
  close: number
  /** Big blinds given up at the spots that went the wrong way. Positive. */
  bbGivenUp: number
  /** Big blinds won at the spots that went the right way. */
  bbWon: number
  /** Net chips across the session, from the hero's per-hand deltas. */
  chips: number
}

/** The session's numbers. Pure, derived, never stored. */
export function tallySession(session: ReviewSession): SessionTally {
  const tally: SessionTally = {
    hands: session.hands.length,
    handsWithDecisions: 0,
    priced: 0,
    right: 0,
    wrong: 0,
    close: 0,
    bbGivenUp: 0,
    bbWon: 0,
    chips: 0,
  }
  for (const hand of session.hands) {
    tally.chips += hand.record.heroDelta ?? 0
    if (hand.decisions.length > 0) tally.handsWithDecisions++
    for (const d of hand.decisions) {
      tally.priced++
      if (d.verdict === 'unknowable') tally.close++
      else if (d.verdict === 'right') {
        tally.right++
        tally.bbWon += d.bb
      } else {
        tally.wrong++
        tally.bbGivenUp += Math.abs(d.bb)
      }
    }
  }
  return tally
}

/** The worst decision in a hand, for the grade shown against it in the list. */
export function handGrade(hand: ReviewHand): GradedDecision | null {
  if (hand.decisions.length === 0) return null
  const mistakes = hand.decisions.filter((d) => isMistake(d.grade))
  const pool = mistakes.length > 0 ? mistakes : hand.decisions
  return pool.reduce((a, b) => (Math.abs(b.bb) > Math.abs(a.bb) ? b : a))
}
