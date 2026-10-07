'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ensurePlayer, firstSeatHref } from '@/components/onboarding/firstSeat'
import { Home } from '@/components/menu/Home'
import { ImportHandler } from '@/components/settings/ImportHandler'
import { Splash } from '@/components/Splash'
import { useProfile } from '@/store/profile'
import { useHydrated } from '@/lib/useHydrated'
import { IMPORT_PARAM } from '@/lib/transfer'

// The app itself: the venue lobby. The marketing landing page lives at "/".
//
// A first visit never sees this screen first (Will, 2026-10-07): there is no
// player yet, so it goes straight to the first table, which makes one
// (onboarding/firstSeat). The exceptions are the links that came here to do
// something with an account — the landing page's sign-in and sign-up, and a
// scanned transfer QR — which get a placeholder player and the lobby, where the
// dialog they asked for opens.
export default function Page() {
  const router = useRouter()
  const created = useProfile((s) => s.created)
  const hydrated = useHydrated()
  // Read once, on the first client render: ImportHandler strips its param in
  // its own effect, which runs before this page's.
  const [accountLink] = useState(() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    return params.has('account') || params.has(IMPORT_PARAM)
  })

  useEffect(() => {
    if (!hydrated || created) return
    if (accountLink) ensurePlayer()
    else router.replace(firstSeatHref())
  }, [hydrated, created, accountLink, router])

  // ImportHandler rides alongside so a scanned QR can offer a restore on a
  // fresh device.
  return (
    <>
      <ImportHandler />
      {hydrated && created ? <Home /> : <Splash />}
    </>
  )
}
