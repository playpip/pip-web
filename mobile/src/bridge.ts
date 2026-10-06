// The native half of the bridge. The web half is src/lib/nativeApp.ts in the
// web app, and the message types here must match its `NativeMessage`.
//
// The web deploys on every push and the app only ships on a store release, so
// a message type this build doesn't know is ignored, never an error.

import Constants from 'expo-constants'
import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

// Every sound cue plus the two tournament endings. Matches `Buzz` in the web
// app's src/lib/haptics.ts.
type Buzz =
  | 'tap'
  | 'deal'
  | 'draw'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'fold'
  | 'allin'
  | 'win'
  | 'lose'
  | 'turn'
  | 'finish'
  | 'bust'

type NativeMessage = { type: 'haptic'; buzz: Buzz }

/**
 * Runs before the page's own scripts, so `inApp()` is already true the first
 * time the web app asks.
 */
export const injectedFlag = `window.PipApp = ${JSON.stringify({
  platform: Platform.OS,
  version: Constants.expoConfig?.version ?? '0.0.0',
})}; true;`

const { ImpactFeedbackStyle: Impact, NotificationFeedbackType: Notify } = Haptics

const impact = (style: Haptics.ImpactFeedbackStyle) => () => Haptics.impactAsync(style)

/** Taps with gaps between them, in milliseconds: [tap, gap, tap, gap, tap]. */
function sequence(...steps: (number | (() => Promise<void>))[]) {
  return async () => {
    for (const step of steps) {
      if (typeof step === 'number') await new Promise((r) => setTimeout(r, step))
      else await step()
    }
  }
}

/**
 * The web cues in the platform's own haptics, each shaped like its sound (the
 * same brief as PATTERNS in src/lib/haptics.ts): short blips are one tap,
 * rising sweeps build, falling ones fade. Lightest on the cues that fire most.
 */
const PLAY: Record<Buzz, () => Promise<void>> = {
  tap: () => Haptics.selectionAsync(),
  deal: impact(Impact.Soft),
  draw: () => Haptics.selectionAsync(),
  check: impact(Impact.Soft),
  call: impact(Impact.Light),
  bet: sequence(impact(Impact.Light), 50, impact(Impact.Medium)),
  raise: sequence(impact(Impact.Light), 45, impact(Impact.Medium), 45, impact(Impact.Rigid)),
  fold: sequence(impact(Impact.Light), 60, impact(Impact.Soft)),
  allin: sequence(
    impact(Impact.Light),
    60,
    impact(Impact.Medium),
    60,
    impact(Impact.Rigid),
    60,
    impact(Impact.Heavy),
  ),
  win: () => Haptics.notificationAsync(Notify.Success),
  lose: sequence(impact(Impact.Medium), 90, impact(Impact.Soft)),
  turn: impact(Impact.Rigid),
  finish: sequence(() => Haptics.notificationAsync(Notify.Success), 120, impact(Impact.Light)),
  bust: impact(Impact.Medium),
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
