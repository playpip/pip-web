'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ensurePlayer } from '@/components/onboarding/firstSeat'
import { Home } from '@/components/menu/Home'
import { ImportHandler } from '@/components/settings/ImportHandler'
import { Splash } from '@/components/Splash'
import { useProfile } from '@/store/profile'
import { useHydrated } from '@/lib/useHydrated'
import { IMPORT_PARAM } from '@/lib/transfer'

// The app itself: the venue lobby. The marketing landing page lives at "/".
//
// A first visit never sees this screen first: there is no player yet, so it
// goes to the welcome flow (`/welcome`), carrying the landing page's sign-in or
// sign-up link with it. A scanned transfer QR is the exception: it gets a
// placeholder player and the lobby, where the restore it asked for opens.
export default function Page() {
  const router = useRouter()
  const created = useProfile((s) => s.created)
  const hydrated = useHydrated()
  // Read once, on the first client render: ImportHandler strips its param in
  // its own effect, which runs before this page's.
  const [link] = useState(() => {
    if (typeof window === 'undefined') return { imported: false, account: null }
    const params = new URLSearchParams(window.location.search)
    return { imported: params.has(IMPORT_PARAM), account: params.get('account') }
  })

  useEffect(() => {
    if (!hydrated || created) return
    if (link.imported) ensurePlayer()
    else router.replace(link.account ? `/welcome?account=${link.account}` : '/welcome')
  }, [hydrated, created, link, router])

  // ImportHandler rides alongside so a scanned QR can offer a restore on a
  // fresh device.
  return (
    <>
      <ImportHandler />
      {hydrated && created ? <Home /> : <Splash />}
    </>
  )
}
