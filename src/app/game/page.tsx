'use client'

import { Onboarding } from '@/components/onboarding/Onboarding'
import { Home } from '@/components/menu/Home'
import { useProfile } from '@/store/profile'
import { useHydrated } from '@/lib/useHydrated'

// The app itself: onboarding for first-timers, the venue lobby thereafter.
// The marketing landing page lives at "/"; this is where "Play" sends you.
export default function Page() {
  const created = useProfile((s) => s.created)
  const hydrated = useHydrated()

  if (!hydrated) return <div className="min-h-dvh" />
  return created ? <Home /> : <Onboarding />
}
