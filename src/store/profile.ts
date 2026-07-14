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
}

const emptyStats = (): LifetimeStats => ({
  handsPlayed: 0,
  handsWon: 0,
  biggestPot: 0,
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
  /** Chosen face-down card design. */
  cardBack: CardBackDesign

  createProfile: (name: string, avatar: AvatarSpec) => void
  setName: (name: string) => void
  setAvatar: (avatar: AvatarSpec) => void
  setCardBack: (cardBack: CardBackDesign) => void
  adjustRoll: (delta: number) => void
  setRoll: (roll: number) => void
  mergeStats: (partial: Partial<LifetimeStats>) => void
  reset: () => void
}

const PERSIST_VERSION = 5
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
      cardBack: DEFAULT_CARD_BACK,

      createProfile: (name, avatar) =>
        set({
          created: true,
          name: name.trim() || 'Player',
          avatar,
        }),
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
      mergeStats: (partial) =>
        set((s) => ({ stats: { ...s.stats, ...mergeStatValues(s.stats, partial) } })),
      reset: () =>
        set({
          created: false,
          name: '',
          avatar: null,
          roll: STARTING_ROLL,
          peakRoll: STARTING_ROLL,
          stats: emptyStats(),
          cardBack: DEFAULT_CARD_BACK,
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
  if (partial.biggestPot !== undefined)
    next.biggestPot = Math.max(current.biggestPot, partial.biggestPot)
  return next
}
