// The Pip Rating as the device keeps it (docs/rating.md): pure, so the store,
// the sync merge and the tests share one copy.

import {
  applyDecision,
  isProvisional,
  parseCore,
  type RatingCore,
  type RatingKind,
  emptyCore,
  ratingOf,
} from './maths'

/** Is the rating on screen in this build? Off until the backend is live. */
export function ratingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RATING === '1'
}

/** One rated decision, as the store hands it over and the server is sent it. */
export interface RatedDecision {
  kind: RatingKind
  loss: number
  stake: number
}

/** The rating on one UTC day, the last value it had that day. */
export interface RatingPoint {
  date: string
  rating: number
}

export interface PipRating {
  core: RatingCore
  /** The best established rating (null while provisional). */
  peak: number | null
  /** One point per UTC day played, oldest first, at most `HISTORY_DAYS`. */
  history: RatingPoint[]
  /** The rating when today's first rated decision came in, for "▲18 today". */
  dayStart: RatingPoint | null
  /** "Hide me from the leaderboard". Sent with every submission. */
  hidden: boolean
}

export const HISTORY_DAYS = 120

export function emptyRating(): PipRating {
  return { core: emptyCore(), peak: null, history: [], dayStart: null, hidden: false }
}

function withPoint(history: RatingPoint[], point: RatingPoint): RatingPoint[] {
  const kept = history.filter((p) => p.date !== point.date)
  return [...kept, point].sort((a, b) => a.date.localeCompare(b.date)).slice(-HISTORY_DAYS)
}

function peakOf(core: RatingCore, peak: number | null): number | null {
  if (isProvisional(core.decisions)) return peak
  return Math.max(peak ?? 0, ratingOf(core))
}

/** One finished hand's rated decisions in. `today` is the UTC day key. */
export function recordRatedHand(
  rating: PipRating,
  decisions: readonly RatedDecision[],
  today: string,
): PipRating {
  if (decisions.length === 0) return rating
  const before = ratingOf(rating.core)
  let core = rating.core
  for (const d of decisions) core = applyDecision(core, d.kind, d.loss, d.stake)
  return {
    ...rating,
    core,
    peak: peakOf(core, rating.peak),
    history: withPoint(rating.history, { date: today, rating: ratingOf(core) }),
    dayStart: rating.dayStart?.date === today ? rating.dayStart : { date: today, rating: before },
  }
}

/** The server's answer replaces the arithmetic: the board's number is the one shown. */
export function adoptServer(
  rating: PipRating,
  server: { core: unknown; peak: number | null; hidden: boolean },
  today: string,
): PipRating {
  const core = parseCore(server.core)
  return {
    ...rating,
    core,
    peak: server.peak ?? peakOf(core, rating.peak),
    hidden: server.hidden,
    history: withPoint(rating.history, { date: today, rating: ratingOf(core) }),
  }
}

/** Points since the start of today, or 0 if nothing was rated today. */
export function ratingToday(rating: PipRating, today: string): number {
  if (rating.dayStart?.date !== today) return 0
  return ratingOf(rating.core) - rating.dayStart.rating
}

/**
 * Two devices: the one that has rated more decisions wins outright, the way
 * a drill rating does (docs/sync.md). A mean of two ratings is a number
 * neither device earned. "Hide me" is kept if either side asked for it.
 */
export function mergeRatings(
  local: PipRating | null | undefined,
  remote: PipRating | null | undefined,
): PipRating {
  // Either side may have been written by another client: read both defensively.
  const a = parseRating(local)
  const b = parseRating(remote)
  const winner = b.core.decisions > a.core.decisions ? b : a
  return { ...winner, hidden: a.hidden || b.hidden }
}

/** Anything from storage or another device, read defensively. */
export function parseRating(value: unknown): PipRating {
  if (!value || typeof value !== 'object') return emptyRating()
  const v = value as Partial<PipRating>
  const points = (list: unknown): RatingPoint[] =>
    Array.isArray(list)
      ? list.filter(
          (p): p is RatingPoint =>
            !!p && typeof p.date === 'string' && typeof p.rating === 'number',
        )
      : []
  return {
    core: parseCore(v.core),
    peak: typeof v.peak === 'number' ? v.peak : null,
    history: points(v.history).slice(-HISTORY_DAYS),
    dayStart: points(v.dayStart ? [v.dayStart] : [])[0] ?? null,
    hidden: v.hidden === true,
  }
}
