/**
 * The bridge to the store app's native shell (`mobile/`, EXPO-PLAN.md).
 *
 * In the iOS and Android apps Pip runs inside a web view, and a few things the
 * browser can't do well (haptics on iOS, store purchases, native sign-in) are
 * handed to the native side as messages. Everywhere else — the website, the
 * PWA — none of this exists and every caller falls back to the web behaviour.
 *
 * **Detection is by the bridge, never by user agent.** The shell injects
 * `window.PipApp` before the page's own scripts run, and react-native-webview
 * provides `window.ReactNativeWebView.postMessage`. Both must be present: the
 * flag alone could be faked by a page script, and the postMessage alone would
 * be true in anybody's web view.
 *
 * Keep the message list short. Each one is a contract between two codebases
 * that ship on different schedules: the web deploys on every push, the app only
 * on a store release. So the native side must ignore a message type it doesn't
 * know, and the web side must not rely on a reply that an older app can't send.
 */

import type { Buzz } from './haptics'

/** What the web side can ask of the shell. */
export type NativeMessage = { type: 'haptic'; buzz: Buzz }

interface PipAppFlag {
  platform: 'ios' | 'android'
  /** The app's own version, which is not the web build's. */
  version: string
}

type BridgeWindow = Window & {
  PipApp?: PipAppFlag
  ReactNativeWebView?: { postMessage: (data: string) => void }
}

function bridge(): BridgeWindow | null {
  if (typeof window === 'undefined') return null
  const w = window as BridgeWindow
  return w.PipApp && typeof w.ReactNativeWebView?.postMessage === 'function' ? w : null
}

/** Running inside the store app rather than a browser or the PWA. */
export function inApp(): boolean {
  return bridge() !== null
}

/** Send a message to the shell. Does nothing outside the app. */
export function postToApp(message: NativeMessage): void {
  bridge()?.ReactNativeWebView?.postMessage(JSON.stringify(message))
}
