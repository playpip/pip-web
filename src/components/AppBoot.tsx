'use client'

import { useEffect } from 'react'
import { useMembership } from '@/store/entitlement'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'

/**
 * One-time client boot work, mounted from the root layout:
 * - asks the browser to mark our storage persistent, so the local profile
 *   isn't evicted under storage pressure (Chrome/Firefox honor this; on iOS
 *   the real protection is installing the PWA)
 * - seeds a Roll-graph origin point for profiles that predate stat recording
 * - restores a sync session if there is one, and pulls
 * - watches that session for a membership, which costs nothing until there is one
 *
 * The service worker is registered separately in UpdatePrompt's hook, which also
 * watches for new deploys (see lib/useServiceWorker).
 */
export function AppBoot() {
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => {})

    const profile = useProfile.getState()
    if (profile.created && profile.rollHistory.length === 0) profile.recordRollPoint()

    // No-op unless the player has an account: with no stored session this
    // reads localStorage, finds nothing and stops. No request, no identity.
    void useSync.getState().init()

    // Subscribes to that session rather than going looking for one, so a
    // player with no account still makes no request of its own.
    useMembership.getState().start()
  }, [])
  return null
}
