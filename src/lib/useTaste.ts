'use client'

import { dailyDateKey } from '@/lib/daily'
import { type TasteRecord, tasteLeft } from '@/lib/membership/taste'
import { useHydrated } from '@/lib/useHydrated'
import { useProfile } from '@/store/profile'

/** Where a non-member stands on today's free member game, for a gated card. */
export interface TasteView {
  /** False until the profile has loaded: a card says nothing about it before then. */
  ready: boolean
  /** Today's free game is still there. */
  left: boolean
  /** What it was spent on, if it has been. */
  record: TasteRecord | null
  /** The UTC day key everything here is answered against. */
  today: string
}

/**
 * Today's free member game, read off the profile.
 *
 * Only ever asked by a card that is already locked for the membership: what it
 * returns means nothing to a member, and the cards check `member` first.
 */
export function useTaste(): TasteView {
  const hydrated = useHydrated()
  const record = useProfile((s) => s.taste)
  const today = dailyDateKey()
  return { ready: hydrated, left: hydrated && tasteLeft(record, today), record, today }
}
