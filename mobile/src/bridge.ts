// The native half of the bridge. The web half is src/lib/nativeApp.ts in the
// web app, and the message types here must match its `NativeMessage`.
//
// The web deploys on every push and the app only ships on a store release, so
// a message type this build doesn't know is ignored, never an error.

import Constants from 'expo-constants'
import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

type Buzz = 'deal' | 'commit' | 'win' | 'finish' | 'bust'

type NativeMessage = { type: 'haptic'; buzz: Buzz }

/**
 * Runs before the page's own scripts, so `inApp()` is already true the first
 * time the web app asks.
 */
export const injectedFlag = `window.PipApp = ${JSON.stringify({
  platform: Platform.OS,
  version: Constants.expoConfig?.version ?? '0.0.0',
})}; true;`

/**
 * The web cues mapped to the platform's own haptics. Same brief as
 * src/lib/haptics.ts: taps, not buzzing. Lightest on the deal because it fires
 * every hand, and only `finish` is celebratory.
 */
const PLAY: Record<Buzz, () => Promise<void>> = {
  deal: () => Haptics.selectionAsync(),
  commit: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  win: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  finish: async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    await new Promise((r) => setTimeout(r, 120))
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  },
  bust: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
}

export function handleMessage(data: string) {
  let message: NativeMessage
  try {
    message = JSON.parse(data)
  } catch {
    return
  }
  switch (message.type) {
    case 'haptic':
      // The web side has already checked the setting, reduced motion and the
      // debounce. This only plays what it was sent.
      PLAY[message.buzz]?.().catch(() => {})
      return
  }
}
