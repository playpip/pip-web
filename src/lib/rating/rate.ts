'use client'

// Where a finished hand meets the Pip Rating (docs/rating.md). Called by the
// game store with the hand's graded calls and folds; the store never learns
// who is signed in or whether the rating is on screen.

import { dailyDateKey } from '@/lib/daily'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'
import { adoptServer, ratingEnabled, type RatedDecision } from './local'
import { enqueue } from './queue'
import { submitRating } from './remote'

/** How long after a hand to send, so a session goes up in a few requests, not one per hand. */
const SEND_AFTER_MS = 20_000
let timer: ReturnType<typeof setTimeout> | null = null

/**
 * One finished hand's rated decisions in (`ratedDecisionsOf`): the device's
 * rating moves and the hand is queued. A guest's queue waits on the device
 * until they sign in; without it, the server would start them again from one
 * hand and the device would adopt that.
 */
export function rateHand(decisions: readonly RatedDecision[]): void {
  if (decisions.length === 0) return
  useProfile.getState().recordRatedDecisions([...decisions], dailyDateKey())
  if (!ratingEnabled()) return
  enqueue({ at: Date.now(), decisions: [...decisions] })
  if (useSync.getState().status !== 'signed-in') return
  if (!timer) timer = setTimeout(() => void sendRating(), SEND_AFTER_MS)
}

/** Send what is queued (or read the row back) and show the server's number. */
export async function sendRating(): Promise<void> {
  timer = null
  if (!ratingEnabled()) return
  const { name, avatar, rating } = useProfile.getState()
  const server = await submitRating({ name, avatar, hidden: rating.hidden })
  if (!server || server.core == null) return
  const now = useProfile.getState()
  now.setRating(adoptServer(now.rating, server, dailyDateKey()))
}
