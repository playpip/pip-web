'use client'

import { tableFinishById } from '@/config/shop'
import { useHydrated } from '@/lib/useHydrated'
import { useProfile } from '@/store/profile'

/**
 * The owned table finish, behind every screen of the app — the menu, the
 * review, lessons, drills — not only the table (Will, 2026-10-03). Mounted once
 * from the root layout, fixed under everything, so a page shows it by simply
 * not painting a background of its own. The marketing pages paint one, and so
 * stay plain.
 *
 * Flat, no texture, ever: translucent colour glowing over the near-black
 * background.
 *
 * Client-only: the finish lives in the persisted profile, which the server
 * never sees.
 */
export function FeltBackdrop() {
  const hydrated = useHydrated()
  const finish = tableFinishById(useProfile((s) => s.tableFinish))
  if (!hydrated || !finish) return null

  const background = `radial-gradient(120% 90% at 50% 42%, ${finish.swatch}66, ${finish.swatch}24 78%), linear-gradient(${finish.swatch}1a, ${finish.swatch}1a)`

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ background }} />
  )
}
