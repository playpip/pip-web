'use client'

/**
 * "Last week: 312 hands over 4 days." Under the rating and the streak on Home,
 * for a player who played last week (lib/lastWeek). Plain text: nothing to
 * tap, nothing to dismiss, gone when the week turns.
 */

import { lastWeekLine, readTally } from '@/lib/lastWeek'
import { useHydrated } from '@/lib/useHydrated'

export function LastWeekLine() {
  // After hydration only: the tally is per device, and a prerendered page has none.
  const hydrated = useHydrated()
  if (!hydrated) return null
  const line = lastWeekLine(readTally(), Date.now())
  if (!line) return null
  return <p className="mt-1 text-sm text-muted-foreground">{line}</p>
}
