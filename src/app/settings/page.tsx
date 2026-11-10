'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SettingsScreen } from '@/components/settings/SettingsScreen'
import { useProfile } from '@/store/profile'
import { useHydrated } from '@/lib/useHydrated'

export default function Page() {
  const router = useRouter()
  const created = useProfile((s) => s.created)
  const hydrated = useHydrated()

  // No profile yet → there's nothing to set; send them to the app to onboard.
  useEffect(() => {
    if (hydrated && !created) router.replace('/game')
  }, [hydrated, created, router])

  if (!hydrated || !created) return <div className="min-h-dvh" />
  return <SettingsScreen />
}
