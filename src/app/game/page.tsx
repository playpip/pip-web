'use client'

import { useState } from 'react'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { TutorialOffer } from '@/components/onboarding/TutorialOffer'
import { Home } from '@/components/menu/Home'
import { ImportHandler } from '@/components/settings/ImportHandler'
import { Splash } from '@/components/Splash'
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

  if (!hydrated) return <Splash />
  // ImportHandler rides alongside every state so a scanned QR can offer a
  // restore even mid-onboarding on a fresh device.
  return (
    <>
      <ImportHandler />
      {!created ? (
        <Onboarding onCreated={() => setOffering(true)} />
      ) : offering ? (
        <TutorialOffer onDeclined={() => setOffering(false)} />
      ) : (
        <Home />
      )}
    </>
  )
}
