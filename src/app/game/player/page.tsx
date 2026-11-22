'use client'

import { Suspense } from 'react'
import { PlayerScreen } from '@/components/social/PlayerScreen'
import { Splash } from '@/components/Splash'

// `/game/player?h=handle`: one public profile. The handle is a query parameter
// because the site is a static export, like the room code.
export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <PlayerScreen />
    </Suspense>
  )
}
