'use client'

import { Suspense } from 'react'
import { MultiplayerHub } from '@/components/room/MultiplayerHub'
import { Splash } from '@/components/Splash'

// Multiplayer: the open tables, a friend's code, or a table of your own.
// Reachable by everybody; joining needs only an account. `?with=<handle>`
// opens the form to challenge that friend, which `useSearchParams` reads,
// and it suspends the prerendered page without this boundary.
export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <MultiplayerHub />
    </Suspense>
  )
}
