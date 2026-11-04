// Each quick game's two analytics events: a round started, a round finished.
// Written as literal `trackOnce('quick-<id>-started')` calls, one entry per
// game, so the privacy test can find them (tests/analyticsClaims.test.ts) and
// /privacy has to say them. At most once per tab, like the funnel, so a report
// over them counts tabs rather than rounds. Names only: no scores.

export interface QuickEvents {
  started: () => void
  finished: () => void
}

/** By quick game id (config/quickGames). */
export const QUICK_EVENTS: Readonly<Record<string, QuickEvents>> = {}
