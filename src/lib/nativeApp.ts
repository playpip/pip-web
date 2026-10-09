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
 * on a store release. So the native side ignores a message type it doesn't
 * know, and the web side checks `appSupports` before relying on one.
 */

import type { Buzz } from './haptics'

/** What the web side can ask of the shell. */
export type NativeMessage = { type: 'haptic'; buzz: Buzz }

/**
 * Requests that expect an answer. Each carries an id, added by `askApp`, and
 * the shell replies with it (`window.__pipAppReply`).
 */
export type NativeRequest =
  | { type: 'signIn'; provider: 'google' | 'apple' }
  | { type: 'products' }
  | { type: 'purchase'; plan: 'monthly' | 'annual'; userId: string }
  | { type: 'restore'; userId: string }

/**
 * What an install can do, as the shell lists it in `PipApp.supports`. Sign-in
 * is per provider, because a build only offers Google once its client is set
 * up, and purchases only once the store is.
 */
export type AppCapability = 'haptic' | 'signIn:apple' | 'signIn:google' | 'purchase'

interface PipAppFlag {
  platform: 'ios' | 'android'
  /** The app's own version, which is not the web build's. */
  version: string
  /** What this build handles. */
  supports?: AppCapability[]
}

type BridgeWindow = Window & {
  PipApp?: PipAppFlag
  ReactNativeWebView?: { postMessage: (data: string) => void }
  __pipAppReply?: (id: string, payload: unknown) => void
}

function bridge(): BridgeWindow | null {
  if (typeof window === 'undefined') return null
  const w = window as BridgeWindow
  return w.PipApp && typeof w.ReactNativeWebView?.postMessage === 'function' ? w : null
}

/** Which store app, or null in a browser. */
export function appPlatform(): PipAppFlag['platform'] | null {
  return bridge()?.PipApp?.platform ?? null
}

/** Running inside the store app rather than a browser or the PWA. */
export function inApp(): boolean {
  return bridge() !== null
}

/**
 * Whether this install of the app handles a message type. Check before relying
 * on one: the website ships ahead of the app, and people keep old builds for
 * months, so a feature that needs a newer app must fall back to the web flow
 * when this is false.
 */
export function appSupports(capability: AppCapability): boolean {
  return bridge()?.PipApp?.supports?.includes(capability) ?? false
}

/** Send a message to the shell. Does nothing outside the app. */
export function postToApp(message: NativeMessage): void {
  bridge()?.ReactNativeWebView?.postMessage(JSON.stringify(message))
}

/** Requests waiting for the shell's answer, by id. */
const waiting = new Map<string, (payload: unknown) => void>()

/**
 * Ask the shell for something and wait for its answer: a sign-in, the store's
 * prices, a purchase. Rejects outside the app. There is no timeout: a sign-in
 * or a purchase waits on the player, for as long as the system sheet is open.
 */
export function askApp<T>(request: NativeRequest): Promise<T> {
  const w = bridge()
  if (!w?.ReactNativeWebView) return Promise.reject(new Error('Not in the app'))
  if (!w.__pipAppReply) {
    w.__pipAppReply = (id, payload) => {
      waiting.get(id)?.(payload)
      waiting.delete(id)
    }
  }
  const id = `${request.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return new Promise<T>((resolve) => {
    waiting.set(id, (payload) => resolve(payload as T))
    w.ReactNativeWebView?.postMessage(JSON.stringify({ ...request, id }))
  })
}
