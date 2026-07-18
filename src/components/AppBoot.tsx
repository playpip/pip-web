'use client'

import { useEffect } from 'react'
import { useProfile } from '@/store/profile'

/**
 * One-time client boot work, mounted from the root layout:
 * - asks the browser to mark our storage persistent, so the local profile
 *   isn't evicted under storage pressure (Chrome/Firefox honor this; on iOS
 *   the real protection is installing the PWA)
 * - seeds a Roll-graph origin point for profiles that predate stat recording
 *
 * The service worker is registered separately in UpdatePrompt's hook, which also
 * watches for new deploys (see lib/useServiceWorker).
 */
export function AppBoot() {
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => {})

    const profile = useProfile.getState()
    if (profile.created && profile.rollHistory.length === 0) profile.recordRollPoint()
  }, [])
  return null
}
