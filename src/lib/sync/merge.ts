// The merge policy for cross-device sync. Pure functions, no network, no
// browser APIs, so every rule here is testable in isolation (tests/syncMerge).
//
// The problem: two devices both played offline. The phone says Roll 4,200, the
// laptop says 900. There is no clever answer, only a chosen one, and it has to
// be a rule a player can predict rather than something that quietly eats a good
// night. See docs/sync.md.
//
// The chosen rule, in one sentence: everything that can only grow merges in the
// player's favour, and the two fields that can't (`roll` and `stats`) follow one
// side that the player picks when the devices actually disagree.
//
// Why not a real three-way merge: it needs a common ancestor snapshot per
// device, which is a much bigger build for a single-player game where one device
// is almost always the active one. If players complain, that's the upgrade path.

import type {
  CastRecord,
  DrillRecord,
  ProfileState,
  RollPoint,
  ShapeRecord,
  VenueRecord,
} from '@/store/profile'
import type { SeatStats } from '@/lib/reads'
import { STARTING_ROLL } from '@/config/venues'

/** The persisted half of the profile — the data fields, none of the actions. */
export type ProfileData = Omit<
  ProfileState,
  {
    [K in keyof ProfileState]: ProfileState[K] extends (...args: never[]) => unknown ? K : never
  }[keyof ProfileState]
>

/** Which side wins the fields that can't merge. */
export type Side = 'local' | 'remote'

/** Roll history is capped in the store; the merge has to respect the same cap. */
const ROLL_HISTORY_CAP = 300

/**
 * Merge two profiles.
 *
 * Additive fields always merge in the player's favour regardless of `side` —
 * they are monotonic, so gaining them can never cost anyone anything. Only
 * `roll` and `stats` follow the chosen side, plus the cosmetics and ephemera,
 * which are last-write-wins by nature and too cheap to prompt about.
 */
export function mergeProfiles(local: ProfileData, remote: ProfileData, side: Side): ProfileData {
  const winner = side === 'local' ? local : remote
  const loser = side === 'local' ? remote : local

  return {
    // Chosen side. `roll` is the currency: adding invents chips, max() rewards
    // keeping a losing session unsynced, so the player picks.
    roll: winner.roll,
    // `stats` are lifetime counters. max() per counter loses the smaller
    // device's hands; summing double-counts everything before the split. Both
    // are wrong, so they follow the same side as the Roll and stay coherent
    // with it rather than being independently wrong.
    stats: winner.stats,
    tendencies: winner.tendencies,

    // Monotonic — always the better of the two.
    peakRoll: Math.max(local.peakRoll, remote.peakRoll),

    // Union. Awards keep the earliest timestamp: you earned it when you earned
    // it, and the other device just hadn't heard yet.
    awards: mergeAwards(local.awards, remote.awards),
    owned: Array.from(new Set([...local.owned, ...remote.owned])),

    // Challenges. `challengeWins` is a union like the awards it mirrors: you
    // beat them, and a device that hasn't heard is not evidence you didn't.
    // `challengesPlayed` is monotonic, so max() like `peakRoll`.
    //
    // The order is local's first, then remote's extras. It is meant to be
    // earliest-beaten-first and there are no timestamps to reconstruct that
    // across devices, so it is best-effort. It only steers which rematch comes
    // up once a whole band is cleared, and never who is challengeable.
    challengeWins: Array.from(new Set([...local.challengeWins, ...remote.challengeWins])),
    challengesPlayed: Math.max(local.challengesPlayed, remote.challengesPlayed),

    // Union by timestamp, re-sorted, capped from the front like the store does.
    rollHistory: mergeRollHistory(local.rollHistory, remote.rollHistory),

    // Per-key best-of.
    venueRecords: mergeVenueRecords(local.venueRecords, remote.venueRecords),
    castRecords: mergeCastRecords(local.castRecords, remote.castRecords),
    drills: mergeDrills(local.drills, remote.drills),

    // Onboarding is one-way: if either device says you're a player, you are.
    created: local.created || remote.created,

    // Cosmetics and ephemera — last write wins, and the chosen side is the last
    // write by definition.
    name: winner.name,
    avatar: winner.avatar,
    cardBack: winner.cardBack,
    deckFace: winner.deckFace,
    tableFinish: winner.tableFinish,
    tableTalk: winner.tableTalk,
    handCoaching: winner.handCoaching,
    haptics: winner.haptics,
    cameFromFreeroll: winner.cameFromFreeroll,

    // The Daily is once per UTC day and abandoning counts as played, so the
    // record that says "played today" has to win or syncing becomes a re-roll.
    daily: mergeDaily(local.daily, remote.daily),

    // Anything added to ProfileState since this was written follows the chosen
    // side rather than silently vanishing on first sync.
    ...pickUnhandled(winner, loser),
  }
}

/**
 * Do the two sides disagree about anything the player would notice losing?
 *
 * Only asked when the remote row moved without this device. Cosmetics don't
 * count: nobody wants a dialog because they changed their card back on the bus.
 */
export function hasDivergence(local: ProfileData, remote: ProfileData): boolean {
  if (local.roll !== remote.roll) return true
  return (
    local.stats.handsPlayed !== remote.stats.handsPlayed ||
    local.stats.tournamentsEntered !== remote.stats.tournamentsEntered
  )
}

/**
 * Has this device got anything of its own to lose?
 *
 * A profile fresh out of onboarding is not progress. It is the shape of a
 * player — a name, an avatar, the starting Roll — with nothing behind it, and
 * signing in on it is a restore rather than a merge.
 *
 * Merging there is actively wrong, not merely unnecessary. `createProfile`
 * seeds `rollHistory` with an origin point stamped `Date.now()`, which is later
 * than every point in the account's real history, so the union sorts it last
 * and the graph ends in a cliff back down to the starting Roll. `awards` and
 * `owned` take the same shape of damage: onboarding's empty sets union
 * harmlessly, but the account's row is the only side that holds truth and it
 * should simply be adopted.
 *
 * Deliberately strict — every clause has to hold. A false negative just falls
 * back to merging, which is the behaviour this replaces; a false positive would
 * drop something the player actually did.
 */
export function isPristine(p: ProfileData): boolean {
  return (
    p.roll === STARTING_ROLL &&
    p.peakRoll === STARTING_ROLL &&
    p.stats.handsPlayed === 0 &&
    p.stats.tournamentsEntered === 0 &&
    // At most the single origin point `createProfile` seeds.
    p.rollHistory.length <= 1 &&
    Object.keys(p.awards).length === 0 &&
    Object.keys(p.venueRecords).length === 0 &&
    Object.keys(p.castRecords).length === 0 &&
    p.owned.length === 0 &&
    p.daily === null &&
    // Drills are reachable without ever sitting down, so a rating is progress
    // even on a profile that has played no hands. Without this clause, signing
    // in on that device adopts the account's row and the rating is gone.
    Object.keys(p.drills ?? {}).length === 0
  )
}

/** What the conflict dialog shows about one side. Display only. */
export interface SideSummary {
  roll: number
  handsPlayed: number
}

export function summarise(p: ProfileData): SideSummary {
  return { roll: p.roll, handsPlayed: p.stats.handsPlayed }
}

// --- field rules -----------------------------------------------------------

function mergeAwards(a: Record<string, number>, b: Record<string, number>) {
  const out: Record<string, number> = { ...a }
  for (const [id, earnedAt] of Object.entries(b)) {
    const mine = out[id]
    out[id] = mine === undefined ? earnedAt : Math.min(mine, earnedAt)
  }
  return out
}

function mergeRollHistory(a: RollPoint[], b: RollPoint[]): RollPoint[] {
  const byTime = new Map<number, RollPoint>()
  for (const p of [...a, ...b]) {
    // Same instant on two devices is a genuine tie; keep the higher Roll so the
    // graph never dips because of a sync rather than a hand.
    const seen = byTime.get(p.t)
    if (!seen || p.roll > seen.roll) byTime.set(p.t, p)
  }
  return Array.from(byTime.values())
    .sort((x, y) => x.t - y.t)
    .slice(-ROLL_HISTORY_CAP)
}

function mergeVenueRecords(
  a: Record<string, VenueRecord>,
  b: Record<string, VenueRecord>,
): Record<string, VenueRecord> {
  const out: Record<string, VenueRecord> = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id]
    const y = b[id]
    if (!x || !y) {
      out[id] = (x ?? y) as VenueRecord
      continue
    }
    out[id] = {
      // Counters can't be summed (the pre-split entries would double-count) so
      // they take the better of the two, same reasoning as `stats`.
      entered: Math.max(x.entered, y.entered),
      won: Math.max(x.won, y.won),
      bestFinish: minDefined(x.bestFinish, y.bestFinish),
      fastestWinHands: minDefined(x.fastestWinHands, y.fastestWinHands),
    }
  }
  return out
}

function mergeCastRecords(
  a: Record<string, CastRecord>,
  b: Record<string, CastRecord>,
): Record<string, CastRecord> {
  const out: Record<string, CastRecord> = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id]
    const y = b[id]
    if (!x || !y) {
      out[id] = (x ?? y) as CastRecord
      continue
    }
    out[id] = { stats: maxSeatStats(x.stats, y.stats), kos: Math.max(x.kos, y.kos) }
  }
  return out
}

/**
 * Drill progress, per kind.
 *
 * Counters and the personal best take the better of the two, same reasoning as
 * `venueRecords`: summing double-counts everything answered before the split.
 *
 * **The rating follows the side that answered more, and does not average.** It
 * is not monotonic — the whole point is that it goes down when you get an easy
 * spot wrong — so max() would quietly ratchet it up every time two devices met,
 * and the mean of two ratings is a number neither device ever earned. More
 * answers is the better reading of the same player, so it wins.
 */
function mergeDrills(
  a: Record<string, DrillRecord>,
  b: Record<string, DrillRecord>,
): Record<string, DrillRecord> {
  const out: Record<string, DrillRecord> = {}
  for (const id of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    const x = a?.[id]
    const y = b?.[id]
    if (!x || !y) {
      out[id] = (x ?? y) as DrillRecord
      continue
    }
    out[id] = {
      answered: Math.max(x.answered, y.answered),
      correct: Math.max(x.correct, y.correct),
      rating: x.answered >= y.answered ? x.rating : y.rating,
      bestRun: Math.max(x.bestRun, y.bestRun),
      shapes: mergeShapes(x.shapes, y.shapes),
    }
  }
  return out
}

/**
 * The per-shape counters, merged the same way the totals above are: the better
 * of the two, shape by shape.
 *
 * Taking the whole map from one side would be the other candidate, and it loses
 * every shape the other device is ahead on. Per-shape `max` keeps
 * `correct <= answered` on every row, because it holds on each side and the
 * larger of two `correct` cannot exceed the larger of two `answered`. It does
 * let the rows add up to more than the kind's `answered`, which is the same
 * arithmetic the totals already accept from `max` and the reason nothing
 * displays that sum.
 */
function mergeShapes(
  a: Record<string, ShapeRecord> | undefined,
  b: Record<string, ShapeRecord> | undefined,
): Record<string, ShapeRecord> {
  const out: Record<string, ShapeRecord> = {}
  for (const shape of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    const x = a?.[shape]
    const y = b?.[shape]
    if (!x || !y) {
      out[shape] = (x ?? y) as ShapeRecord
      continue
    }
    out[shape] = {
      answered: Math.max(x.answered, y.answered),
      correct: Math.max(x.correct, y.correct),
    }
  }
  return out
}

function mergeDaily(a: ProfileData['daily'], b: ProfileData['daily']) {
  if (!a) return b
  if (!b) return a
  // Different days: the later one is the current record.
  if (a.date !== b.date) return a.date > b.date ? a : b
  // Same day: a finished run beats an abandoned one, then the longer run.
  if (a.place !== null && b.place === null) return a
  if (b.place !== null && a.place === null) return b
  return a.hands >= b.hands ? a : b
}

function maxSeatStats(a: SeatStats, b: SeatStats): SeatStats {
  return {
    handsDealt: Math.max(a.handsDealt, b.handsDealt),
    vpipHands: Math.max(a.vpipHands, b.vpipHands),
    raises: Math.max(a.raises, b.raises),
    calls: Math.max(a.calls, b.calls),
    betsFaced: Math.max(a.betsFaced, b.betsFaced),
    foldsToBet: Math.max(a.foldsToBet, b.foldsToBet),
    showdowns: Math.max(a.showdowns, b.showdowns),
  }
}

function minDefined(a: number | null, b: number | null): number | null {
  if (a === null) return b
  if (b === null) return a
  return Math.min(a, b)
}

/**
 * Anything the rules above didn't name follows the winning side. Reached only
 * if ProfileState grows a field and nobody updated `mergeProfiles` — better a
 * defensible default than a field that silently disappears on first sync.
 */
function pickUnhandled(winner: ProfileData, loser: ProfileData): Partial<ProfileData> {
  const handled = new Set([
    'roll',
    'stats',
    'tendencies',
    'peakRoll',
    'awards',
    'owned',
    'rollHistory',
    'venueRecords',
    'castRecords',
    'created',
    'name',
    'avatar',
    'cardBack',
    'deckFace',
    'tableFinish',
    'tableTalk',
    'handCoaching',
    'haptics',
    'cameFromFreeroll',
    'daily',
    'challengeWins',
    'challengesPlayed',
    'drills',
  ])
  const out: Record<string, unknown> = {}
  for (const key of new Set([...Object.keys(winner), ...Object.keys(loser)])) {
    if (handled.has(key)) continue
    out[key] = (winner as Record<string, unknown>)[key] ?? (loser as Record<string, unknown>)[key]
  }
  return out as Partial<ProfileData>
}
