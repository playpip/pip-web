'use client'

import { useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'

// Where the way out of a drill goes.
//
// A drill used to have one exit, the drills index, because that was the only
// way in. Stats and the coaching report now link straight to a kind, and
// sending somebody who came from their graph to a shelf they never opened is
// the back button lying about where it goes. So a link from elsewhere says so
// (`?from=stats`), and the exit goes back there and is labelled for it.

const ORIGINS: Record<string, { href: string; label: string }> = {
  stats: { href: '/stats', label: 'Stats' },
  report: { href: '/game/report', label: 'Report' },
}

const INDEX = { href: '/game/drills', label: 'Drills' }

/** The screens that link into a drill and want to be returned to. */
export type DrillOrigin = 'stats' | 'report'

/** A link into a drill kind that brings you back to where you left from. */
export function drillHref(kindId: string, from?: DrillOrigin): string {
  return from ? `/game/drills/${kindId}?from=${from}` : `/game/drills/${kindId}`
}

const noop = () => () => {}

/**
 * Did this page arrive by a navigation inside the app?
 *
 * `history.length` cannot say: a tab that visited another site first has a
 * long history whose previous entry is not ours. The document's own load entry
 * can — it records the URL the page was first loaded at, so if that is not
 * where we are now, the router brought us here from a page of ours.
 */
function arrivedInApp(): boolean {
  const [load] = performance.getEntriesByType('navigation')
  return Boolean(load) && load.name !== window.location.href
}

/**
 * The exit's label and what pressing it does.
 *
 * The query string is read through `useSyncExternalStore` rather than
 * `useSearchParams`, because the latter suspends under the static export and
 * the drill routes are prerendered. Nothing on the server knows the origin, so
 * the prerendered bar says "Drills" and settles on hydration — the same frame
 * everything else on the felt appears in.
 */
export function useDrillExit(): { label: string; leave: () => void } {
  const router = useRouter()
  const from = useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).get('from'),
    () => null,
  )
  const origin = from && Object.hasOwn(ORIGINS, from) ? ORIGINS[from] : null

  return {
    label: (origin ?? INDEX).label,
    leave: () => {
      // Back rather than push when we know where they came from, so stats
      // opens at the card they tapped and not at the top. A drill never
      // changes the URL, so the previous entry is the page that linked here —
      // but only if we got here inside the app. Opened cold (a shared link, a
      // reload) the previous entry is another site or a blank tab.
      if (origin && arrivedInApp()) router.back()
      else router.push((origin ?? INDEX).href)
    },
  }
}
