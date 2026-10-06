'use client'

import { useSyncExternalStore } from 'react'
import { inApp } from './nativeApp'

const noopSubscribe = () => () => {}

/**
 * `inApp()` for rendering. False on the server and the first paint, so the
 * static build and the browser agree, and the real answer once mounted. For
 * copy that should say "app" in the store app and "browser" everywhere else.
 */
export function useInApp(): boolean {
  return useSyncExternalStore(noopSubscribe, inApp, () => false)
}
