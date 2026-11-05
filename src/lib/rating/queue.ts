'use client'

// Hands waiting to go up to `submit-rating` (docs/rating.md). Device-local, in
// `localStorage` `pip.ratingQueue`, never synced: each device sends its own.
// Collected for a guest too, and sent only once they sign in, so the server
// can replay a guest's play instead of starting their rating again.

import type { SubmittedHand } from './maths'
import { MAX_DECISIONS_PER_HOUR, MAX_HAND_AGE_MS, MAX_HANDS_PER_SUBMIT } from './maths'

/** Margin under the server's age limit, for a slow request or a clock a little ahead. */
const AGE_MARGIN_MS = 60 * 60 * 1000

const KEY = 'pip.ratingQueue'

export function readQueue(): SubmittedHand[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function write(list: SubmittedHand[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_HANDS_PER_SUBMIT)))
  } catch {
    // Storage full or blocked: the rating on the device still moves.
  }
}

export function enqueue(hand: SubmittedHand): void {
  write([...readQueue(), hand])
}

/**
 * What to send now: the queue without hands the server would refuse as too
 * old, and only as many of the oldest as fit under the hourly limit. One
 * refused hand refuses a whole submission, and a submission over the hourly
 * limit can never pass, so either would cost every hand queued.
 */
export function sendable(queue: readonly SubmittedHand[], now: number): SubmittedHand[] {
  const fresh = queue.filter((h) => h.at >= now - MAX_HAND_AGE_MS + AGE_MARGIN_MS)
  const out: SubmittedHand[] = []
  let decisions = 0
  for (const hand of fresh) {
    decisions += hand.decisions.length
    if (decisions > MAX_DECISIONS_PER_HOUR) break
    out.push(hand)
  }
  return out
}

/** Drop the hands the server has now counted (or refused for good). */
export function dropThrough(at: number): void {
  write(readQueue().filter((h) => h.at > at))
}

/** Forget hands too old for the server to count, so they never block the rest. */
export function dropStale(now: number): void {
  const queue = readQueue()
  const fresh = queue.filter((h) => h.at >= now - MAX_HAND_AGE_MS + AGE_MARGIN_MS)
  if (fresh.length !== queue.length) write(fresh)
}
