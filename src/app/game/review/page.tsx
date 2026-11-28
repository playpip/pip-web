'use client'

import { Suspense } from 'react'
import { ReviewScreen } from '@/components/review/ReviewScreen'
import { Splash } from '@/components/Splash'

// The session you just played, hand by hand — the membership's half of the
// coaching line, alongside the report. The free per-hand read stays where it
// is, on the handover banner, and the table that sends you here never asks who
// is paying (tests/membershipSurfaces.test.ts).
export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <ReviewScreen />
    </Suspense>
  )
}
