'use client'

import { useEffect, useRef, useState } from 'react'

// How often to re-check for a new deploy while the app stays open (an installed
// PWA can run for days). Also checked whenever the tab becomes visible again.
const UPDATE_INTERVAL_MS = 60 * 60 * 1000

/**
 * Registers the offline service worker (production only) and surfaces when a new
 * version is waiting. `applyUpdate()` tells the waiting worker to take over; the
 * page reloads once it does. See public/sw.js for the other half of the dance.
 */
export function useServiceWorkerUpdate(): { updateReady: boolean; applyUpdate: () => void } {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const reloading = useRef(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | null = null

    // A worker is "ready to apply" only when one is already controlling the page
    // — otherwise it's the first install, which activates silently (no prompt).
    const offerIfWaiting = (sw: ServiceWorker | null) => {
      if (sw && navigator.serviceWorker.controller) setWaiting(sw)
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg
        offerIfWaiting(reg.waiting)
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed') offerIfWaiting(installing)
          })
        })
      })
      .catch(() => {})

    // The waiting worker called skipWaiting → it now controls us → reload once
    // so every open tab lands on the new assets together. The catch: the FIRST
    // install also fires controllerchange (via clients.claim in the worker's
    // activate), and reloading there is the first-visit double-load — the page
    // already shows the current assets. Tell the two apart by whether a worker
    // was controlling us *just before* this change: an update replaces an
    // existing controller (reload); the initial claim replaces nothing (don't).
    // Tracked live, not captured once, so a fresh tab that gets claimed and then
    // sees an in-session update still reloads on the update.
    let controlled = Boolean(navigator.serviceWorker.controller)
    const onControllerChange = () => {
      const wasControlled = controlled
      controlled = true
      if (reloading.current || !wasControlled) return
      reloading.current = true
      location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    const check = () => registration?.update().catch(() => {})
    const interval = setInterval(check, UPDATE_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [])

  return {
    updateReady: waiting !== null,
    applyUpdate: () => waiting?.postMessage({ type: 'SKIP_WAITING' }),
  }
}
