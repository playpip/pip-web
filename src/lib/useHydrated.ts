'use client'

import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

/**
 * Returns false during SSR/first paint and true once mounted on the client.
 * Uses useSyncExternalStore (server snapshot = false) so there's no in-effect
 * setState and no hydration mismatch — the idiomatic client-only gate.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}
