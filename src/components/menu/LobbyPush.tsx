'use client'

// Asking to send notifications, the first time you reach the lobby (Will,
// 2026-11-09): your move in a slow game, somebody passing you on the board,
// your streak ending.
//
// - **The app** puts up the system's own question straight away, once, signed
//   in or not. The token is registered with the account now, or on the first
//   lobby visit after signing in (`refreshPush`).
// - **A browser** needs a tap before it may ask, so a signed-in player gets
//   Pip's card (PushPrompt) with the browser's prompt behind its button.
//   Signed out there is nobody to send them to, so nothing is asked.
//
// Either way a device already allowed is registered again once a session.

import { useEffect } from 'react'
import { deviceTimeZone } from '@/components/settings/SlowGamesSection'
import { PushPrompt } from '@/components/room/PushPrompt'
import { devSignedIn, roomsConfigured } from '@/lib/multiplayer/client'
import {
  enablePush,
  markPushAsked,
  pushAskedBefore,
  pushSupport,
  refreshPush,
  saveTimeZoneOnce,
} from '@/lib/push'
import { useHydrated } from '@/lib/useHydrated'
import { useSync } from '@/store/sync'

/** Long enough for the lobby to be on screen before the system's question covers it. */
const APP_ASK_DELAY_MS = 1200

export function LobbyPush() {
  const hydrated = useHydrated()
  const signedIn = useSync((s) => s.status === 'signed-in') || devSignedIn()
  const support = hydrated && roomsConfigured() ? pushSupport() : 'none'

  useEffect(() => {
    if (support === 'none' || support === 'install') return
    // The web card saves it itself (PushPrompt).
    if (signedIn && support === 'app') void saveTimeZoneOnce(deviceTimeZone())
    if (support === 'app' && !pushAskedBefore()) {
      const timer = setTimeout(() => {
        markPushAsked()
        void enablePush()
      }, APP_ASK_DELAY_MS)
      return () => clearTimeout(timer)
    }
    if (signedIn) void refreshPush()
  }, [support, signedIn])

  if (support !== 'web' || !signedIn) return null
  return (
    <div className="mt-4 w-full max-w-md">
      <PushPrompt question="Notifications for your streak and the board?" />
    </div>
  )
}
