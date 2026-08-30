// Persistent player profile — the only thing we keep in localStorage. Versioned
// with a migration hook so the save format can evolve without wiping progress,
// and so it's a clean seam to swap for a real backend later.

'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AvatarSpec } from '@/lib/avatar'
import { emptySeatStats, type SeatStats } from '@/lib/reads'
import { STARTING_ROLL } from '@/config/venues'
import { DEFAULT_CARD_BACK, nearestCardBack } from '@/config/cardBacks'
import { STARTING_RATING, nextRating } from '@/lib/drills/rating'
import { track } from '@/lib/analytics'

export interface LifetimeStats {
  handsPlayed: number
  handsWon: number
  biggestPot: number
  /** Hands won at a showdown. */
  showdownsWon: number
  tournamentsEntered: number
  tournamentsWon: number
}

const emptyStats = (): LifetimeStats => ({
  handsPlayed: 0,
  handsWon: 0,
  biggestPot: 0,
  showdownsWon: 0,
  tournamentsEntered: 0,
  tournamentsWon: 0,
})

/** One point on the Roll-over-time graph. */
export interface RollPoint {
  t: number
  roll: number
}

/** Kept to a sane size — old points age out of the front. */
const ROLL_HISTORY_CAP = 300

export interface VenueRecord {
  entered: number
  won: number
  /** Best finishing position (1 = won it). */
  bestFinish: number | null
  /** Fewest hands a win took. */
  fastestWinHands: number | null
}

const emptyVenueRecord = (): VenueRecord => ({
  entered: 0,
  won: 0,
  bestFinish: null,
  fastestWinHands: null,
})

/** Career history with one cast character (see config/cast.ts). */
export interface CastRecord {
  /** Tendencies observed across every session — reads that persist. */
  stats: SeatStats
  /** Times you've taken their last chip. */
  kos: number
}

const emptyCastRecord = (): CastRecord => ({ stats: emptySeatStats(), kos: 0 })

/**
 * What one drill kind knows about you. Four numbers, and every one of them is a
 * mirror rather than a lever (see lib/drills/rating.ts):
 *
 * - none of them decays, because nothing in the drills layer can read the clock;
 * - none of them is an allowance, because the free kind is never metered;
 * - `bestRun` is a personal best and not a streak. A streak is a thing you lose
 *   by not turning up. This is a thing you did, and it stays done.
 */
export interface DrillRecord {
  /** Spots answered, ever. */
  answered: number
  /** How many of those were right. */
  correct: number
  /** The rating, on the same scale as the spots (lib/drills/rating.ts). */
  rating: number
  /** The longest unbroken run of correct answers, ever. */
  bestRun: number
  /**
   * The same two counters again, split by what settled the spot (the `SpotKind`
   * vocabulary in lib/drills/rating.ts). Read by lib/drills/shapes.ts.
   *
   * `Record<string, …>` rather than `Record<SpotKind, …>` on purpose, and for
   * the same reason `drills` itself is keyed by `string`: this is persisted
   * data, so a shape that is renamed or retired leaves rows here that no longer
   * type-check as a `SpotKind` and must not stop an old profile loading.
   * Anything reading it joins against a kind's ladder and ignores the rest.
   */
  shapes: Record<string, ShapeRecord>
}

/** What one shape of spot knows about you. Two counters, nothing derived. */
export interface ShapeRecord {
  answered: number
  correct: number
}

/** Today's Daily Deal — one play per UTC day; abandoning counts as played. */
export interface DailyRecord {
  /** UTC day key, e.g. "2026-07-16". */
  date: string
  /** Which daily this was (#1 = the epoch day). */
  dayNo: number
  /** Finishing place (1 = won), or null if abandoned mid-tournament. */
  place: number | null
  /** Hands the run lasted. */
  hands: number
}

export interface ProfileState {
  /** Onboarding complete? */
  created: boolean
  name: string
  avatar: AvatarSpec | null
  /** The Roll — your bankroll, and your table stack in the cash game. */
  roll: number
  /** Highest Roll ever reached — drives your rank/title. */
  peakRoll: number
  stats: LifetimeStats
  /** The Roll sampled at tournament results and cash-outs (drives the stats graph). */
  rollHistory: RollPoint[]
  /** Per-venue records: entries, wins, best finish, fastest win. */
  venueRecords: Record<string, VenueRecord>
  /** Lifetime tendencies of the hero — feeds the play-style chart on /stats. */
  tendencies: SeatStats
  /** Chosen face-down card design (a curated id — see config/cardBacks). */
  cardBack: string
  /** Earned award chips: id → epoch ms earned (see lib/awards). */
  awards: Record<string, number>
  /** Comeback flag: the current run started with a Kitchen Table win. */
  cameFromFreeroll: boolean
  /** Career history per cast character: reads that persist across sessions. */
  castRecords: Record<string, CastRecord>
  /** Rare one-line character flavour at the table (see docs/cast.md). */
  tableTalk: boolean
  /** One honest read on the hand you just played (see lib/coach). On by default. */
  handCoaching: boolean
  /** Short vibration on the physical moments (see lib/haptics). Off by default. */
  haptics: boolean
  /** The most recent Daily Deal played (only today's gates anything). */
  daily: DailyRecord | null
  /** Chip Shop purchases (item ids). Style, never edge — see docs/shop.md. */
  owned: string[]
  /** Equipped deck face: 'classic' or an owned face id (e.g. 'face-fourcolor'). */
  deckFace: string
  /** Equipped table finish (an owned finish id), or null for the plain table. */
  tableFinish: string | null
  /** Cast characters beaten in a challenge, earliest first: the scalp collection. */
  challengeWins: string[]
  /**
   * Challenges completed, win or lose. Drives who is up next: rotating on
   * *played* rather than *won* is what stops a character you can't beat
   * becoming a wall (see lib/challenge).
   */
  challengesPlayed: number
  /**
   * Drill progress, keyed by drill kind id (see config/drills.ts). Absent until
   * the first answer, so a player who has never opened a drill carries nothing.
   */
  drills: Record<string, DrillRecord>

  createProfile: (name: string, avatar: AvatarSpec) => void
  setName: (name: string) => void
  setAvatar: (avatar: AvatarSpec) => void
  setCardBack: (cardBack: string) => void
  adjustRoll: (delta: number) => void
  setRoll: (roll: number) => void
  /** Record newly earned award chips (already-owned ids are left untouched). */
  grantAwards: (ids: string[]) => void
  setCameFromFreeroll: (value: boolean) => void
  /** Fold a hand's observed tendencies into each character's career record. */
  mergeCastStats: (deltas: Record<string, Partial<SeatStats>>) => void
  /** You took this character's last chip. */
  recordCastKnockout: (characterId: string) => void
  /** A challenge finished. Any outcome rotates the challenger; only a win records the scalp. */
  recordChallenge: (characterId: string, won: boolean) => void
  /**
   * One drill answered. `run` is the length of the current unbroken run of
   * correct answers *including* this one, which the screen already holds.
   *
   * The rating arithmetic lives in lib/drills/rating.ts and is called from
   * here, so there is one place a spot can move the number and it is the same
   * place that counts the spot. Returns nothing: what the screen shows is
   * derived from the record, never from a second copy of the sum.
   */
  recordDrill: (
    kindId: string,
    correct: boolean,
    difficulty: number,
    run: number,
    shape: string,
  ) => void
  setTableTalk: (value: boolean) => void
  setHandCoaching: (value: boolean) => void
  setHaptics: (value: boolean) => void
  /** Buy a Chip Shop item: deducts the price, records ownership. No-op if owned or short. */
  buyItem: (id: string, price: number) => void
  setDeckFace: (id: string) => void
  setTableFinish: (id: string | null) => void
  /** Sitting down at today's Daily — marks it played immediately. */
  recordDailyStart: (date: string, dayNo: number) => void
  /** Final placing for the daily started on `date` (ignored if dates mismatch). */
  recordDailyResult: (date: string, place: number, hands: number) => void
  mergeStats: (partial: Partial<LifetimeStats>) => void
  /** Add a hand's worth of hero tendencies onto the lifetime totals. */
  mergeTendencies: (delta: Partial<SeatStats>) => void
  /** Sample the current Roll onto the history graph. */
  recordRollPoint: () => void
  recordVenueEntry: (venueId: string) => void
  recordVenueResult: (venueId: string, finish: number, hands: number) => void
  reset: () => void
}

export const PERSIST_VERSION = 16
const PERSIST_KEY = 'pip.profile'

/** A kind you have never answered a spot from. */
export const emptyDrillRecord = (): DrillRecord => ({
  answered: 0,
  correct: 0,
  rating: STARTING_RATING,
  bestRun: 0,
  shapes: {},
})

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      created: false,
      name: '',
      avatar: null,
      roll: STARTING_ROLL,
      peakRoll: STARTING_ROLL,
      stats: emptyStats(),
      rollHistory: [],
      venueRecords: {},
      tendencies: emptySeatStats(),
      cardBack: DEFAULT_CARD_BACK.id,
      awards: {},
      cameFromFreeroll: false,
      castRecords: {},
      tableTalk: true,
      handCoaching: true,
      haptics: false,
      daily: null,
      owned: [],
      deckFace: 'classic',
      tableFinish: null,
      challengeWins: [],
      challengesPlayed: 0,
      drills: {},

      createProfile: (name, avatar) => {
        // Activation — the one moment a visitor becomes a player. Anonymous.
        track('profile-created')
        set((s) => ({
          created: true,
          name: name.trim() || 'Player',
          avatar,
          rollHistory: [{ t: Date.now(), roll: s.roll }],
        }))
      },
      setName: (name) => set({ name: name.trim() || 'Player' }),
      setAvatar: (avatar) => set({ avatar }),
      setCardBack: (cardBack) => set({ cardBack }),
      adjustRoll: (delta) =>
        set((s) => {
          const roll = Math.max(0, s.roll + delta)
          return { roll, peakRoll: Math.max(s.peakRoll, roll) }
        }),
      setRoll: (roll) =>
        set((s) => {
          const next = Math.max(0, Math.round(roll))
          return { roll: next, peakRoll: Math.max(s.peakRoll, next) }
        }),
      grantAwards: (ids) =>
        set((s) => {
          const fresh = ids.filter((id) => s.awards[id] === undefined)
          if (fresh.length === 0) return s
          const now = Date.now()
          const awards = { ...s.awards }
          for (const id of fresh) awards[id] = now
          return { awards }
        }),
      setCameFromFreeroll: (value) => set({ cameFromFreeroll: value }),
      mergeCastStats: (deltas) =>
        set((s) => {
          const ids = Object.keys(deltas)
          if (ids.length === 0) return s
          const castRecords = { ...s.castRecords }
          for (const id of ids) {
            const rec = castRecords[id] ?? emptyCastRecord()
            castRecords[id] = { ...rec, stats: addTendencies(rec.stats, deltas[id]) }
          }
          return { castRecords }
        }),
      recordCastKnockout: (characterId) =>
        set((s) => {
          const rec = s.castRecords[characterId] ?? emptyCastRecord()
          return { castRecords: { ...s.castRecords, [characterId]: { ...rec, kos: rec.kos + 1 } } }
        }),
      recordChallenge: (characterId, won) =>
        set((s) => ({
          challengesPlayed: s.challengesPlayed + 1,
          challengeWins:
            won && !s.challengeWins.includes(characterId)
              ? [...s.challengeWins, characterId]
              : s.challengeWins,
        })),
      recordDrill: (kindId, correct, difficulty, run, shape) =>
        set((s) => {
          const rec = s.drills[kindId] ?? emptyDrillRecord()
          const was = rec.shapes?.[shape] ?? { answered: 0, correct: 0 }
          return {
            drills: {
              ...s.drills,
              [kindId]: {
                answered: rec.answered + 1,
                correct: rec.correct + (correct ? 1 : 0),
                // `rec.answered` is the count before this spot, which is what
                // the K-factor is asking about.
                rating: nextRating(rec.rating, difficulty, correct, rec.answered),
                bestRun: Math.max(rec.bestRun, run),
                // The same answer counted a second time, by shape. Counted here
                // rather than derived anywhere, for the reason the rating is:
                // one place moves the numbers, and it is the place that sees
                // the answer.
                shapes: {
                  ...rec.shapes,
                  [shape]: {
                    answered: was.answered + 1,
                    correct: was.correct + (correct ? 1 : 0),
                  },
                },
              },
            },
          }
        }),
      setTableTalk: (value) => set({ tableTalk: value }),
      setHandCoaching: (value) => set({ handCoaching: value }),
      setHaptics: (value) => set({ haptics: value }),
      buyItem: (id, price) =>
        set((s) => {
          // Spending never moves peakRoll — rank is about winnings, not thrift.
          if (s.owned.includes(id) || s.roll < price) return s
          return { owned: [...s.owned, id], roll: s.roll - price }
        }),
      setDeckFace: (id) => set({ deckFace: id }),
      setTableFinish: (id) => set({ tableFinish: id }),
      recordDailyStart: (date, dayNo) => set({ daily: { date, dayNo, place: null, hands: 0 } }),
      recordDailyResult: (date, place, hands) =>
        set((s) => (s.daily?.date === date ? { daily: { ...s.daily, place, hands } } : s)),
      mergeStats: (partial) =>
        set((s) => ({ stats: { ...s.stats, ...mergeStatValues(s.stats, partial) } })),
      mergeTendencies: (delta) => set((s) => ({ tendencies: addTendencies(s.tendencies, delta) })),
      recordRollPoint: () =>
        set((s) => ({
          rollHistory: [...s.rollHistory, { t: Date.now(), roll: s.roll }].slice(-ROLL_HISTORY_CAP),
        })),
      recordVenueEntry: (venueId) =>
        set((s) => {
          const rec = s.venueRecords[venueId] ?? emptyVenueRecord()
          return {
            venueRecords: { ...s.venueRecords, [venueId]: { ...rec, entered: rec.entered + 1 } },
          }
        }),
      recordVenueResult: (venueId, finish, hands) =>
        set((s) => {
          const rec = s.venueRecords[venueId] ?? emptyVenueRecord()
          const won = finish === 1
          return {
            venueRecords: {
              ...s.venueRecords,
              [venueId]: {
                ...rec,
                won: rec.won + (won ? 1 : 0),
                bestFinish: rec.bestFinish === null ? finish : Math.min(rec.bestFinish, finish),
                fastestWinHands: won
                  ? rec.fastestWinHands === null
                    ? hands
                    : Math.min(rec.fastestWinHands, hands)
                  : rec.fastestWinHands,
              },
            },
          }
        }),
      reset: () =>
        set({
          created: false,
          name: '',
          avatar: null,
          roll: STARTING_ROLL,
          peakRoll: STARTING_ROLL,
          stats: emptyStats(),
          rollHistory: [],
          venueRecords: {},
          tendencies: emptySeatStats(),
          cardBack: DEFAULT_CARD_BACK.id,
          awards: {},
          cameFromFreeroll: false,
          castRecords: {},
          tableTalk: true,
          handCoaching: true,
          haptics: false,
          daily: null,
          owned: [],
          deckFace: 'classic',
          tableFinish: null,
          challengeWins: [],
          challengesPlayed: 0,
          drills: {},
        }),
    }),
    {
      name: PERSIST_KEY,
      version: PERSIST_VERSION,
      migrate: (persisted, fromVersion) => migrateProfile(persisted, fromVersion),
    },
  ),
)

/**
 * Bring a persisted profile up to PERSIST_VERSION.
 *
 * Exported because localStorage is no longer the only source of a stored
 * profile: a synced row can have been written by an older client on another
 * device, and it has to go through the same chain before anything merges it
 * (see lib/sync). Mutates and returns the object it is given.
 */
export function migrateProfile(persisted: unknown, fromVersion: number): ProfileState {
  const s = persisted as ProfileState
  // v1 → v2: card-back customization added.
  if (fromVersion < 2 && !s.cardBack) s.cardBack = DEFAULT_CARD_BACK.id
  // v2 → v3: cash-game economy — rank (peakRoll).
  if (fromVersion < 3) {
    s.peakRoll = Math.max(s.roll ?? STARTING_ROLL, STARTING_ROLL)
  }
  // v3 → v4: selectable currency added (payday removed).
  // v4 → v5: currency removed again — balances are always chips.
  if (fromVersion < 5) {
    delete (s as ProfileState & { currency?: string }).currency
  }
  // v5 → v6: award chips + the freeroll comeback flag.
  if (fromVersion < 6) {
    s.awards = {}
    s.cameFromFreeroll = false
  }
  // v6 → v7: stats history (roll graph, venue records, richer counters).
  if (fromVersion < 7) {
    s.rollHistory = []
    s.venueRecords = {}
    s.stats = { ...emptyStats(), ...s.stats }
  }
  // v7 → v8: curated card backs — map the old free-form colour choice
  // onto the nearest design in the new set.
  if (fromVersion < 8) {
    const legacy = s.cardBack as unknown as { color?: string } | string
    s.cardBack = typeof legacy === 'string' ? legacy : nearestCardBack(legacy?.color).id
  }
  // v8 → v9: lifetime hero tendencies (play-style chart).
  if (fromVersion < 9) s.tendencies = emptySeatStats()
  // v9 → v10: the charm release — cast career records, table talk, the
  // Daily Deal, and the Chip Shop (all shipped together, one bump).
  if (fromVersion < 10) {
    s.castRecords = {}
    s.tableTalk = true
    s.daily = null
    s.owned = []
    s.deckFace = 'classic'
    s.tableFinish = null
  }
  // v10 → v11: three muted card backs (ocean, slate, midnight) moved from
  // the free set into the Chip Shop. Grandfather existing players — they
  // had these free, so they keep them — while new profiles must buy them.
  if (fromVersion < 11) {
    const freed = ['ocean', 'slate', 'midnight']
    s.owned = Array.from(new Set([...(s.owned ?? []), ...freed]))
  }
  // v11 -> v12: challengers. Both fields start empty. An existing player has
  // beaten nobody yet, and starting `challengesPlayed` at 0 puts everyone on
  // the same first challenger rather than a position derived from old play.
  if (fromVersion < 12) {
    s.challengeWins = []
    s.challengesPlayed = 0
  }
  // v12 -> v13: per-hand coaching. On for everyone, new and existing: it is
  // quiet by design (most hands have no read in them) and a player who does
  // not want it will find the toggle faster than they would find the setting
  // that was silently off.
  if (fromVersion < 13) s.handCoaching = true
  // v13 -> v14: haptics. Off, for everyone. Sound and table talk both default
  // on because neither can startle you; a vibration can, and one that nobody
  // asked for reads as a casino tell in an app whose whole pitch is calm.
  if (fromVersion < 14) s.haptics = false
  // v14 -> v15: drill progress. Empty for everyone, including a player who has
  // already answered spots on a build that kept nothing: there is no record of
  // those to honour, and seeding a rating from the tables would be a claim
  // about how somebody reads a showdown made out of how they play a hand.
  if (fromVersion < 15) s.drills = {}
  // v15 -> v16: the per-shape split of the drill counters. Empty on every
  // existing record, and it cannot be anything else: the totals do not say
  // which shapes they were, and there is no honest way to guess. So a player
  // who has answered two hundred spots starts this breakdown at zero and fills
  // it again from here. That is the cost of not having counted it the first
  // time, and inventing a split out of the shape frequencies would put numbers
  // on the screen that describe the generator rather than the player.
  if (fromVersion < 16) {
    for (const rec of Object.values(s.drills ?? {})) rec.shapes = {}
  }
  return s
}

function mergeStatValues(
  current: LifetimeStats,
  partial: Partial<LifetimeStats>,
): Partial<LifetimeStats> {
  const next: Partial<LifetimeStats> = {}
  if (partial.handsPlayed) next.handsPlayed = current.handsPlayed + partial.handsPlayed
  if (partial.handsWon) next.handsWon = current.handsWon + partial.handsWon
  if (partial.showdownsWon) next.showdownsWon = current.showdownsWon + partial.showdownsWon
  if (partial.tournamentsEntered)
    next.tournamentsEntered = current.tournamentsEntered + partial.tournamentsEntered
  if (partial.tournamentsWon) next.tournamentsWon = current.tournamentsWon + partial.tournamentsWon
  if (partial.biggestPot !== undefined)
    next.biggestPot = Math.max(current.biggestPot, partial.biggestPot)
  return next
}

function addTendencies(current: SeatStats, delta: Partial<SeatStats>): SeatStats {
  return {
    handsDealt: current.handsDealt + (delta.handsDealt ?? 0),
    vpipHands: current.vpipHands + (delta.vpipHands ?? 0),
    raises: current.raises + (delta.raises ?? 0),
    calls: current.calls + (delta.calls ?? 0),
    betsFaced: current.betsFaced + (delta.betsFaced ?? 0),
    foldsToBet: current.foldsToBet + (delta.foldsToBet ?? 0),
    showdowns: current.showdowns + (delta.showdowns ?? 0),
  }
}
