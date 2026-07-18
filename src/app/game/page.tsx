'use client'

import { useState } from 'react'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { TutorialOffer } from '@/components/onboarding/TutorialOffer'
import { Home } from '@/components/menu/Home'
import { useProfile } from '@/store/profile'
import { useHydrated } from '@/lib/useHydrated'

// The app itself: onboarding for first-timers, the venue lobby thereafter.
// The marketing landing page lives at "/"; this is where "Play" sends you.
export default function Page() {
  const created = useProfile((s) => s.created)
  const hydrated = useHydrated()
  // The tutorial offer is a step in the create flow, held in memory only — it
  // exists solely in the render pass after createProfile succeeds, so it can
  // never reappear or nag (no persisted flag needed; `created` gates the flow).
  const [offering, setOffering] = useState(false)

  if (!hydrated) return <div className="min-h-dvh" />
  if (!created) return <Onboarding onCreated={() => setOffering(true)} />
  if (offering) return <TutorialOffer onDeclined={() => setOffering(false)} />
  return <Home />
}
