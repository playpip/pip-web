'use client'

import { Suspense } from 'react'
import { WelcomeFlow } from '@/components/onboarding/WelcomeFlow'
import { Splash } from '@/components/Splash'
import { useHydrated } from '@/lib/useHydrated'

// `/welcome`: where Play takes somebody with no player yet (onboarding/firstSeat).
export default function Page() {
  const hydrated = useHydrated()
  if (!hydrated) return <Splash />
  return (
    <Suspense fallback={<Splash />}>
      <WelcomeFlow />
    </Suspense>
  )
}
