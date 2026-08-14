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
import { usePathname } from 'next/navigation'
import {
  DEFAULT_TEXT_SCALE,
  effectiveTextScale,
  parseTextScale,
  rootFontSize,
  TABLE_MAX_TEXT_SCALE,
  TABLE_ROUTE_PREFIX,
  TEXT_SCALE_KEY,
  TEXT_SCALES,
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
  // The table caps at 150% (technology#57), so the applied size depends on the
  // route as well as the setting. Walking on to the felt at 200% steps down,
  // walking off steps back up, and the stored choice never changes.
  const pathname = usePathname()

  // Mirror onto <html> (the boot script did first paint).
  useEffect(() => {
    document.documentElement.style.fontSize = rootFontSize(effectiveTextScale(scale, pathname))
  }, [scale, pathname])

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
 *
 * It applies the table cap itself rather than leaving it to the provider: a
 * hard refresh on `/play/kitchen` resumes the table, and the provider's effect
 * runs after paint, so without this the felt draws once at 200% and then jumps.
 * The steps are written out from TEXT_SCALES so a new step cannot be added to
 * the setting and silently miss the boot.
 */
const BOOT_STEPS = TEXT_SCALES.filter((step) => step !== DEFAULT_TEXT_SCALE)
  .map((step) => `s==='${step}'`)
  .join('||')

export const TEXT_SCALE_BOOT_SCRIPT = `(function(){try{var s=localStorage.getItem('${TEXT_SCALE_KEY}');if(!(${BOOT_STEPS}))return;var n=+s;if(n>${TABLE_MAX_TEXT_SCALE}&&location.pathname.indexOf('${TABLE_ROUTE_PREFIX}')===0)n=${TABLE_MAX_TEXT_SCALE};document.documentElement.style.fontSize=n+'%'}catch(e){}})()`
