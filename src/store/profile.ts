// Persistent player profile — the only thing we keep in localStorage. Versioned
// with a migration hook so the save format can evolve without wiping progress,
// and so it's a clean seam to swap for a real backend later.

'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AvatarSpec } from '@/lib/avatar'
import { STARTING_ROLL } from '@/config/venues'
import { DEFAULT_CARD_BACK, type CardBackDesign } from '@/config/cardBacks'

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
  /** Chosen face-down card design. */
  cardBack: CardBackDesign
  /** Earned award chips: id → epoch ms earned (see lib/awards). */
  awards: Record<string, number>
  /** Comeback flag: the current run started with a Kitchen Table win. */
  cameFromFreeroll: boolean

  createProfile: (name: string, avatar: AvatarSpec) => void
  setName: (name: string) => void
  setAvatar: (avatar: AvatarSpec) => void
  setCardBack: (cardBack: CardBackDesign) => void
  adjustRoll: (delta: number) => void
  setRoll: (roll: number) => void
  /** Record newly earned award chips (already-owned ids are left untouched). */
  grantAwards: (ids: string[]) => void
  setCameFromFreeroll: (value: boolean) => void
  mergeStats: (partial: Partial<LifetimeStats>) => void
  /** Sample the current Roll onto the history graph. */
  recordRollPoint: () => void
  recordVenueEntry: (venueId: string) => void
  recordVenueResult: (venueId: string, finish: number, hands: number) => void
  reset: () => void
}

export const PERSIST_VERSION = 7
const PERSIST_KEY = 'pip.profile'

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
      cardBack: DEFAULT_CARD_BACK,
      awards: {},
      cameFromFreeroll: false,

      createProfile: (name, avatar) =>
        set((s) => ({
          created: true,
          name: name.trim() || 'Player',
          avatar,
          rollHistory: [{ t: Date.now(), roll: s.roll }],
        })),
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
      mergeStats: (partial) =>
        set((s) => ({ stats: { ...s.stats, ...mergeStatValues(s.stats, partial) } })),
      recordRollPoint: () =>
        set((s) => ({
          rollHistory: [...s.rollHistory, { t: Date.now(), roll: s.roll }].slice(-ROLL_HISTORY_CAP),
        })),
      recordVenueEntry: (venueId) =>
        set((s) => {
          const rec = s.venueRecords[venueId] ?? emptyVenueRecord()
          return { venueRecords: { ...s.venueRecords, [venueId]: { ...rec, entered: rec.entered + 1 } } }
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
          cardBack: DEFAULT_CARD_BACK,
          awards: {},
          cameFromFreeroll: false,
        }),
    }),
    {
      name: PERSIST_KEY,
      version: PERSIST_VERSION,
      migrate: (persisted, fromVersion) => {
        const s = persisted as ProfileState
        // v1 → v2: card-back customization added.
        if (fromVersion < 2 && !s.cardBack) s.cardBack = DEFAULT_CARD_BACK
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
        return s
      },
    },
  ),
)

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
