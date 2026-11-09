'use client'

// Allowing notifications on this device: slow games, the leaderboard and the
// streak (rooms/src/player.ts decides what is sent).
//
// Two ways, depending on where Pip is running:
//
// - **The store app** asks the system and hands back its Expo push token
//   (`pushToken` over the bridge, `mobile/src/bridge.ts`).
// - **A browser** subscribes through the service worker (`public/sw.js` shows
//   them), with the room server's VAPID key. On an iPhone that only works once
//   Pip is on the home screen (iOS 16.4+); Safari in a tab has no push.
//
// Either way the device goes to the room server, which keeps it with your
// account (`rooms/src/player.ts`), so a notice reaches every device you allowed.

import { appSupports, askApp, inApp } from './nativeApp'
import {
  fetchNotifySettings,
  registerDevice,
  saveNotifyPrefs,
  vapidKey,
} from './multiplayer/client'

export type PushSupport = 'app' | 'web' | 'install' | 'none'

/** How this device can be pushed to, if at all. `install`: an iPhone browser tab. */
export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'none'
  if (inApp()) return appSupports('push') ? 'app' : 'none'
  const web = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (web) return 'web'
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  return ios ? 'install' : 'none'
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * Ask to allow notifications here and register this device. Must run from a
 * tap: browsers refuse a permission prompt that nobody asked for.
 */
export async function enablePush(): Promise<'on' | 'denied' | 'unsupported' | 'failed'> {
  const support = pushSupport()
  if (support === 'app') {
    const reply = await askApp<{ token?: string; error?: string }>({ type: 'pushToken' })
    if (!reply.token) return reply.error === 'denied' ? 'denied' : 'failed'
    return (await registerDevice({ kind: 'expo', token: reply.token })) ? 'on' : 'failed'
  }
  if (support !== 'web') return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const key = await vapidKey()
  if (!key) return 'failed'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      }))
    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return 'failed'
    const ok = await registerDevice({
      kind: 'web',
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    })
    return ok ? 'on' : 'failed'
  } catch {
    return 'failed'
  }
}

const ASKED = 'pip.pushAsked'

/** Whether this device has been asked before, by the lobby or a slow game's table. */
export function pushAskedBefore(): boolean {
  try {
    return localStorage.getItem(ASKED) === '1'
  } catch {
    return true
  }
}

export function markPushAsked(): void {
  try {
    localStorage.setItem(ASKED, '1')
  } catch {
    // Private mode: asked again next time, which is no worse than now.
  }
}

/** The first time an account is seen here: quiet hours start in this device's timezone. */
export async function saveTimeZoneOnce(tz: string): Promise<{ push: boolean } | null> {
  const got = await fetchNotifySettings()
  if (!got) return null
  if (!got.set) await saveNotifyPrefs({ ...got.prefs, tz })
  return { push: got.prefs.push }
}

let refreshed = false

/**
 * Register this device again, once a session, where it is already allowed:
 * a browser that granted it, or the app after its one question (where asking
 * again shows nothing). Picks up a new token, and an account signed into
 * after the question was answered.
 */
export async function refreshPush(): Promise<void> {
  if (refreshed) return
  const support = pushSupport()
  const allowed =
    support === 'app'
      ? pushAskedBefore()
      : support === 'web' && Notification.permission === 'granted'
  if (!allowed) return
  refreshed = true
  if ((await enablePush()) === 'failed') refreshed = false
}
