'use client'

import { useCallback } from 'react'
import { dailyDateKey } from '@/lib/daily'
import { freeRoundLeft } from '@/lib/quick/rounds'
import { useHydrated } from '@/lib/useHydrated'
import { useMembership } from '@/store/entitlement'
import { useProfile } from '@/store/profile'

/** Where a player stands on one quick game, for its card and its page. */
export interface QuickRoundView {
  /** False until the profile and the membership have both answered: say nothing before then. */
  ready: boolean
  member: boolean
  /** A member, or a free player with today's round unspent. */
  canPlay: boolean
  /** A free player whose round today is still there. */
  freeLeft: boolean
  /** The best score ever at this game, or null. */
  best: number | null
  /**
   * Start a round: true if it may go ahead. A member always may; a free player
   * spends today's round here, at the tap, never on a page view.
   */
  begin: () => boolean
}

/** Today's round of one quick game, read off the profile and the membership. */
export function useQuickRound(id: string): QuickRoundView {
  const hydrated = useHydrated()
  const checked = useMembership((s) => s.checked)
  const member = useMembership((s) => s.member)
  const rounds = useProfile((s) => s.quickRounds)
  const best = useProfile((s) => s.quickBests?.[id] ?? null)
  const today = dailyDateKey()
  const freeLeft = hydrated && !member && freeRoundLeft(rounds, id, today)
  const begin = useCallback(() => {
    if (useMembership.getState().member) return true
    return useProfile.getState().spendQuickRound(id, dailyDateKey())
  }, [id])
  return {
    ready: hydrated && checked,
    member,
    canPlay: member || freeLeft,
    freeLeft,
    best,
    begin,
  }
}
