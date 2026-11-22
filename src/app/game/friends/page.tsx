'use client'

import { Suspense } from 'react'
import { FriendsScreen } from '@/components/social/FriendsScreen'
import { Splash } from '@/components/Splash'

// `/game/friends?tab=…`: friends, the inbox and search (docs/social.md).
export default function Page() {
  return (
    <Suspense fallback={<Splash />}>
      <FriendsScreen />
    </Suspense>
  )
}
