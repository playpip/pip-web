'use client'

import { Suspense } from 'react'
import { GamesScreen } from '@/components/games/GamesScreen'
import { Splash } from '@/components/Splash'

// `/game/games`: your games; `/game/games?h=handle`: a player's. A query
// parameter because the site is a static export, like the profile.
export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <GamesScreen />
    </Suspense>
  )
}
