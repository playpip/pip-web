'use client'

import { useSyncExternalStore } from 'react'

/** SSR-safe media-query hook (false on the server, live on the client). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const useIsMobile = () => useMediaQuery('(max-width: 820px)')
