'use client'

// Where a finished hand meets the Pip Rating (docs/rating.md). Called by the
// game store with the hand's graded calls and folds; the store never learns
// who is signed in or whether the rating is on screen.

import type { GradedDecision } from '@/lib/review/grade'
import { dailyDateKey } from '@/lib/daily'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'
import { ratedLoss, ratedStake, ratingKindOf } from './index'
import { adoptServer, ratingEnabled, type RatedDecision } from './local'
import { enqueue } from './queue'
import { submitRating } from './remote'

/** How long after a hand to send, so a session goes up in a few requests, not one per hand. */
const SEND_AFTER_MS = 20_000
let timer: ReturnType<typeof setTimeout> | null = null

/** One finished hand's graded decisions in: the device's rating moves, and a signed-in one is queued. */
export function rateHand(graded: readonly GradedDecision[], bigBlind: number): void {
  const decisions: RatedDecision[] = graded
    .map((d) => ({ kind: ratingKindOf(d), loss: ratedLoss(d), stake: ratedStake(d, bigBlind) }))
    .filter((d) => d.stake >= 1)
  if (decisions.length === 0) return
  useProfile.getState().recordRatedDecisions(decisions, dailyDateKey())
  if (!ratingEnabled() || useSync.getState().status !== 'signed-in') return
  enqueue({ at: Date.now(), decisions })
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
