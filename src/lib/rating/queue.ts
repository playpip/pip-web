'use client'

// Hands waiting to go up to `submit-rating` (docs/rating.md). Device-local, in
// `localStorage` `pip.ratingQueue`, never synced: each device sends its own.
// Collected only while signed in, so a guest's hands never leave the device.

import type { SubmittedHand } from './maths'
import { MAX_HANDS_PER_SUBMIT } from './maths'

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

/** Drop the hands the server has now counted (or refused for good). */
export function dropThrough(at: number): void {
  write(readQueue().filter((h) => h.at > at))
}
