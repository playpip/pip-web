'use client'

// Text size, wired the same way as the theme: an inline boot script from the
// SERVER layout sets the root font size before first paint, and this provider
// owns the state afterwards. See theme-provider.tsx for why the split exists.
//
// Pre-paint matters more here than it does for colour. Root font size is what
// every rem in the app is measured against, so applying it after hydration
// would reflow the entire page in front of the reader on every single load.
//
// It is stored per device, not on the profile, and that is deliberate:
//   - it describes this screen, exactly like dark mode does, and a phone and a
//     desktop want different answers. Syncing it would push one device's answer
//     onto the other, and last-write-wins would then flip it back and forth.
//   - the profile store hydrates after paint (zustand persist), so reading it
//     from there would guarantee the reflow the boot script exists to avoid.
//   - it costs no PERSIST_VERSION bump, which haptics and drills-progress are
//     both queued for.

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  DEFAULT_TEXT_SCALE,
  parseTextScale,
  rootFontSize,
  TEXT_SCALE_KEY,
  type TextScale,
} from '@/lib/textScale'

interface TextScaleContextValue {
  scale: TextScale
  setScale: (scale: TextScale) => void
}

const TextScaleContext = createContext<TextScaleContextValue>({
  scale: DEFAULT_TEXT_SCALE,
  setScale: () => {},
})

export function useTextScale(): TextScaleContextValue {
  return useContext(TextScaleContext)
}

const readStored = (): TextScale => {
  if (typeof window === 'undefined') return DEFAULT_TEXT_SCALE
  try {
    return parseTextScale(localStorage.getItem(TEXT_SCALE_KEY))
  } catch {
    return DEFAULT_TEXT_SCALE
  }
}

export function TextScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScaleState] = useState<TextScale>(readStored)

  // Mirror onto <html> (the boot script did first paint).
  useEffect(() => {
    document.documentElement.style.fontSize = rootFontSize(scale)
  }, [scale])

  const setScale = useCallback((next: TextScale) => {
    setScaleState(next)
    try {
      localStorage.setItem(TEXT_SCALE_KEY, String(next))
    } catch {}
  }, [])

  return (
    <TextScaleContext.Provider value={{ scale, setScale }}>{children}</TextScaleContext.Provider>
  )
}

/**
 * The no-flash boot: sets the root font size before first paint. Rendered as an
 * inline <script> by the server layout. Mirrors readStored above.
 *
 * 100 is left alone rather than written out, so a reader who has never touched
 * the setting keeps whatever their browser's own default font size is.
 */
export const TEXT_SCALE_BOOT_SCRIPT = `(function(){try{var s=localStorage.getItem('${TEXT_SCALE_KEY}');if(s==='125'||s==='150'||s==='200')document.documentElement.style.fontSize=s+'%'}catch(e){}})()`
