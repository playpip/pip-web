'use client'

import { useMemo } from 'react'
import { dailyDateKey } from '@/lib/daily'
import { type DeepRead, deepRead } from '@/lib/deepCoach'
import { type FreeReportState, freeReportState } from '@/lib/membership/freeReport'
import { useHydrated } from '@/lib/useHydrated'
import { useProfile } from '@/store/profile'

/** The player's own report, and where they stand on the free one. */
export interface FreeReportView {
  /** False until the profile has loaded: nothing says anything about it before then. */
  ready: boolean
  /** The report as it stands, from their own hands. */
  read: DeepRead
  state: FreeReportState
  /** Hands counted towards it: `tendencies.handsDealt`, what `deepRead` waits on. */
  hands: number
  /** The UTC day key it was answered against. */
  today: string
}

/**
 * The free report, read off the profile.
 *
 * Only means anything to a player who is not a member: the callers check
 * `member` first, the same way the cards check it before `useTaste`.
 */
export function useFreeReport(): FreeReportView {
  const hydrated = useHydrated()
  const tendencies = useProfile((s) => s.tendencies)
  const stats = useProfile((s) => s.stats)
  const venueRecords = useProfile((s) => s.venueRecords)
  const rollHistory = useProfile((s) => s.rollHistory)
  const reviewStats = useProfile((s) => s.reviewStats)
  const record = useProfile((s) => s.freeReport)
  const read = useMemo(
    () => deepRead({ tendencies, stats, venueRecords, rollHistory, reviewStats }),
    [tendencies, stats, venueRecords, rollHistory, reviewStats],
  )
  const today = dailyDateKey()
  return {
    ready: hydrated,
    read,
    hands: tendencies.handsDealt,
    state: freeReportState(record, today, read),
    today,
  }
}
