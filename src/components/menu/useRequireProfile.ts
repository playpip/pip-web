'use client'

import { useEffect } from 'react'
import { useProfile } from '@/store/profile'
import { ensurePlayer } from '@/components/onboarding/firstSeat'
import { useHydrated } from '@/lib/useHydrated'

/**
 * Gate for the lobby's sub-routes (Venues, The Rail, Side Tables). They're real
 * pages, so a deep link can land before a profile exists — those get a
 * placeholder player, the same one Play makes (onboarding/firstSeat), and stay
 * on the page they asked for. Returns false until we're hydrated AND created,
 * so callers can hold a Splash rather than flash an empty screen.
 */
export function useRequireProfile(): boolean {
  const hydrated = useHydrated()
  const created = useProfile((s) => s.created)
  useEffect(() => {
    if (hydrated && !created) ensurePlayer()
  }, [hydrated, created])
  return hydrated && created
}
