// One full report, free, once (Will, 2026-11-02).
//
// **Why it exists.** In the week to 1 November the coaching report was the
// locked thing tapped most, by far, and nobody who tapped it had seen their
// own. The free member table (`taste.ts`) answered the same problem for the
// side tables: a whole thing, never a slice of one. This is that shape for the
// report. Every player who is not a member gets their own full report once,
// built from their own hands by the same `deepRead` a member's is, and then it
// locks again. Will ruled out a free trial, and this is not one: nothing is
// switched on that later switches off mid-use, and nothing else opens with it.
//
// **When it is ready.** Not at a hand count picked for marketing: at the point
// the report itself has something to say. `deepRead` refuses to say anything
// under `DEEP_MIN_HANDS` (120), and a report past that with no finding and no
// priced cost is an empty page. Spending the one free report on an empty page
// would be giving nothing and calling it a gift, so it waits for both.
//
// **"Once" is one UTC day.** It is spent when the player taps to open it, never
// on a page view, and it stays open until midnight UTC so a refresh, a trip to
// "See the hands" or a second look that evening is not a second report. The
// record is the day it was opened. After that day it is used for good.
//
// Pure and storage-free, like `taste.ts`. The record lives on the persisted
// profile (`freeReport`) and is merged on sync so a used report stays used.

import { DEEP_MIN_HANDS, type DeepRead } from '@/lib/deepCoach'

/** The free report, once opened: the UTC day it was opened on. */
export interface FreeReportRecord {
  /** UTC day key, e.g. "2026-11-02" (`dailyDateKey`). */
  date: string
}

/**
 * Where a non-member stands on their free report.
 *
 * - `waiting`: the report has nothing to say yet.
 * - `ready`: it has, and the free one has never been opened.
 * - `open`: opened today, so it is still theirs to read.
 * - `used`: opened on an earlier day. Locked, like today.
 */
export type FreeReportState = 'waiting' | 'ready' | 'open' | 'used'

/** Does the report have enough in it to be worth the one free look? */
export function reportHasSomethingToSay(read: DeepRead): boolean {
  return read.waitingFor === null && (read.leaks.length > 0 || read.cost !== null)
}

/** The state, from the record, today's key and the report as it stands. */
export function freeReportState(
  record: FreeReportRecord | null | undefined,
  today: string,
  read: DeepRead,
): FreeReportState {
  if (record) return record.date === today ? 'open' : 'used'
  return reportHasSomethingToSay(read) ? 'ready' : 'waiting'
}

/**
 * Open the free report today. Returns the record to store, the same record if
 * it is already open today, or `null` if it has been used or there is nothing
 * in it yet.
 */
export function openFreeReport(
  record: FreeReportRecord | null | undefined,
  today: string,
  read: DeepRead,
): FreeReportRecord | null {
  const state = freeReportState(record, today, read)
  if (state === 'open') return record ?? null
  if (state === 'ready') return { date: today }
  return null
}

/**
 * Two devices' records, merged for sync.
 *
 * The earlier day wins: an opened report stays opened, and signing in on a
 * second device can neither hand it back nor stretch the day it is open for.
 * A malformed record on either side is read as no record.
 */
export function mergeFreeReport(left: unknown, right: unknown): FreeReportRecord | null {
  const a = isFreeReportRecord(left) ? left : null
  const b = isFreeReportRecord(right) ? right : null
  if (!a) return b
  if (!b) return a
  return a.date <= b.date ? a : b
}

/** Is this a well-formed record? A synced row is not this store's output. */
export function isFreeReportRecord(value: unknown): value is FreeReportRecord {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
}

/**
 * What the lobby's progress card shows (2026-11-04), or `null` for nothing.
 *
 * Counted in `tendencies.handsDealt`, the number `deepRead` itself waits on,
 * so the card and the report page can never disagree about how far along a
 * player is. Nothing before the first hand: a brand-new player's lobby is busy
 * enough. Past the line with nothing to say yet, it says so rather than draw
 * progress towards a number that has already been passed. Once it is open or
 * used, the card has nothing new to tell them.
 */
export type FreeReportProgress =
  | { kind: 'counting'; hands: number; of: number }
  | { kind: 'almost' }
  | { kind: 'ready' }

export function freeReportProgress(
  state: FreeReportState,
  hands: number,
): FreeReportProgress | null {
  if (state === 'ready') return { kind: 'ready' }
  if (state !== 'waiting' || hands <= 0) return null
  return hands < DEEP_MIN_HANDS
    ? { kind: 'counting', hands, of: DEEP_MIN_HANDS }
    : { kind: 'almost' }
}

/** What the free report is called everywhere it is offered. One place so they agree. */
export const FREE_REPORT_COPY = {
  /** The membership page and the comparison: what a free player gets. */
  offer: `Your first full report is free, once you have played ${DEEP_MIN_HANDS} hands.`,
  /** A line in a list of what a free player gets. */
  line: `One full report on your play, at ${DEEP_MIN_HANDS} hands`,
  /** The comparison's free column. */
  short: `Once, at ${DEEP_MIN_HANDS} hands`,
  /** The end-of-run button, and the report page's heading, while it is ready. */
  ready: 'Your report is ready',
  /** The button on the report page that opens it. */
  action: 'Open my free report',
  /** Beside that button: what the tap is about to do. */
  note: 'One full report is free. It stays open until midnight UTC, then it comes with the membership.',
  /** The end-of-run button while it is open today. */
  open: 'See your report',
  /** Over the report while it is open. */
  banner: 'Your free report. It is open until midnight UTC.',
  /** The lobby's progress card: its label. */
  progress: 'Your free report',
  /** The lobby's progress card, past the hand count with nothing to say yet. */
  almost: 'A few more hands',
  /** Under that: why, in one line. */
  almostLine: 'It opens once it has found something in your play.',
  /** Once it has been used. */
  used: 'You have had your free report.',
} as const
