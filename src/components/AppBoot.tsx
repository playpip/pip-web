'use client'

import { useEffect } from 'react'

/**
 * One-time client boot work, mounted from the root layout:
 * - registers the offline service worker (production only)
 * - asks the browser to mark our storage persistent, so the local profile
 *   isn't evicted under storage pressure (Chrome/Firefox honor this; on iOS
 *   the real protection is installing the PWA)
 */
export function AppBoot() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    void navigator.storage?.persist?.().catch(() => {})
  }, [])
  return null
}
