// Anonymous, cookieless product analytics — a thin wrapper around Umami's global.
//
// Two hard rules:
//   1. Fire-and-forget. Every call is a no-op if the script hasn't loaded (dev,
//      offline, blocked by a content blocker, or before the website id is
//      configured). Analytics must never affect gameplay.
//   2. No personal data, ever. We send event names only — no name, avatar, Roll,
//      or any identifier. See src/app/privacy/page.tsx for the promise this keeps.

type UmamiTrack = (event: string, data?: Record<string, unknown>) => void

declare global {
  interface Window {
    umami?: { track: UmamiTrack }
  }
}

/** Send an anonymous event. Silently does nothing if Umami isn't present. */
export function track(event: string) {
  if (typeof window === 'undefined') return
  window.umami?.track(event)
}

/**
 * Fire an event at most once per tab session (survives reloads within the tab,
 * resets on a new tab/session). Used for engagement signals like the first hand
 * of a session, where per-deal volume would drown out the signal we want.
 */
export function trackOnce(event: string) {
  if (typeof window === 'undefined') return
  const key = `pip.tracked.${event}`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    // sessionStorage can throw (Safari private mode); fall through and fire
    // without the dedupe rather than lose the event entirely.
  }
  track(event)
}
