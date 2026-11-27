// The shapes of a kept session and its hands (lib/review/session). Types only,
// so the room server can build them without the device's storage.

import type { HandRecord } from '@/lib/handRecord'
import type { GradedDecision } from './grade'

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
  /**
   * Set when this is a multiplayer game (lib/multiplayer/review), whose other
   * seats' cards are only known where a showdown turned them over.
   */
  room?: { code: string; kind: 'private' | 'quick' | 'slow' }
  /** Somebody else's game, opened from their profile (lib/games/api). */
  owner?: { handle: string; name: string }
}
