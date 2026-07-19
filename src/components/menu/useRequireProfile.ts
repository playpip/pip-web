'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/store/profile'
import { useHydrated } from '@/lib/useHydrated'

/**
 * Gate for the lobby's sub-routes (Venues, The Rail, Side Tables). They're real
 * pages, so a deep link can land before a profile exists — bounce those back to
 * /game, where onboarding lives. Returns false until we're hydrated AND created,
 * so callers can hold a Splash rather than flash an empty screen.
 */
export function useRequireProfile(): boolean {
  const router = useRouter()
  const hydrated = useHydrated()
  const created = useProfile((s) => s.created)
  useEffect(() => {
    if (hydrated && !created) router.replace('/game')
  }, [hydrated, created, router])
  return hydrated && created
}
