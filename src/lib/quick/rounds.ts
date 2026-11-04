// Quick games: the free round a day and the personal bests (2026-11-04).
//
// **Why a free round** (Will, 2026-11-04): quick games are the membership's,
// and a free player gets one whole round of each, every UTC day. The same
// shape as the free member table (lib/membership/taste): a real go at the
// thing, never a slice of one, and a plain card once it is used.
//
// **Why personal bests and nothing else.** Nobody sees anybody else's score,
// so there is no leaderboard to climb and nothing to buy a way up. A best is
// yours alone, kept on your profile and carried by sync.
//
// Pure and storage-free. The records live on the persisted profile
// (`quickRounds`, `quickBests`) and callers pass today's key in, so the tests
// need no clock.

/** Game id → the UTC day its free round was last spent (`dailyDateKey`). */
export type QuickRounds = Readonly<Record<string, string>>

/** Game id → the best score ever, by that game's own count. */
export type QuickBests = Readonly<Record<string, number>>

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/
const GAME_ID = /^[a-z][a-z0-9-]{0,39}$/

/** Is today's free round of this game still there? A record from an earlier day is no record. */
export function freeRoundLeft(
  rounds: QuickRounds | null | undefined,
  id: string,
  today: string,
): boolean {
  return rounds?.[id] !== today
}

/**
 * Spend today's free round of this game. Returns the record to store, or
 * `null` if today's is already spent. Spending one game's never spends
 * another's.
 */
export function spendFreeRound(
  rounds: QuickRounds | null | undefined,
  id: string,
  today: string,
): QuickRounds | null {
  if (!freeRoundLeft(rounds, id, today)) return null
  return { ...(rounds ?? {}), [id]: today }
}

/**
 * Two devices' records, merged for sync: per game, the later day wins, so a
 * spent round stays spent. Taking "never spent" over "spent today" would make
 * signing in on a second device a second round.
 *
 * Takes `unknown` because a synced row is not this store's output: anything
 * malformed is read as no record rather than trusted.
 */
export function mergeFreeRounds(left: unknown, right: unknown): QuickRounds {
  const out: Record<string, string> = {}
  for (const side of [cleanRounds(left), cleanRounds(right)]) {
    for (const [id, day] of Object.entries(side)) {
      if (!out[id] || day > out[id]) out[id] = day
    }
  }
  return out
}

/**
 * A finished round's score, folded into the bests. Returns the same object
 * when it is not a new best, so a store can skip the write. A score that is
 * not a finite, non-negative whole number is ignored.
 */
export function recordBest(
  bests: QuickBests | null | undefined,
  id: string,
  score: number,
): QuickBests {
  const current = bests ?? {}
  if (!validScore(score) || !GAME_ID.test(id)) return current
  const before = current[id]
  if (before !== undefined && before >= score) return current
  return { ...current, [id]: score }
}

/** Two devices' bests, merged for sync: per game, the higher one. */
export function mergeBests(left: unknown, right: unknown): QuickBests {
  const out: Record<string, number> = {}
  for (const side of [cleanBests(left), cleanBests(right)]) {
    for (const [id, score] of Object.entries(side)) {
      if (out[id] === undefined || score > out[id]) out[id] = score
    }
  }
  return out
}

function validScore(score: unknown): score is number {
  return typeof score === 'number' && Number.isInteger(score) && score >= 0
}

function cleanRounds(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [id, day] of Object.entries(value as Record<string, unknown>)) {
    if (GAME_ID.test(id) && typeof day === 'string' && DAY_KEY.test(day)) out[id] = day
  }
  return out
}

function cleanBests(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, number> = {}
  for (const [id, score] of Object.entries(value as Record<string, unknown>)) {
    if (GAME_ID.test(id) && validScore(score)) out[id] = score
  }
  return out
}
