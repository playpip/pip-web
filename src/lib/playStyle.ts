// Play style — turns the hero's lifetime tendencies into the two axes every
// poker player is read on: how many hands they play (tight ↔ loose) and how
// they play them (passive ↔ aggressive). Pure: the profile store owns the raw
// SeatStats; this maps them onto the quadrant shown on /stats.

import type { SeatStats } from './reads'

/** Hands dealt before the chart is worth showing — below this it's all noise. */
export const STYLE_MIN_HANDS = 20

export type StyleKey = 'shark' | 'maniac' | 'rock' | 'station'

export interface PlayStyle {
  /** 0..1 — share of hands played voluntarily (loose = high). */
  looseness: number
  /** 0..1 — share of aggressive actions among bets/calls (aggressive = high). */
  aggression: number
  /** Fold-to-bet rate, 0..1 — a discipline read shown alongside. */
  foldToBet: number
  /** Hands the read is drawn from. */
  hands: number
  /** Enough sample to name an archetype? */
  ready: boolean
  key: StyleKey
  /** Archetype name, e.g. "The Shark". */
  name: string
  /** One-line description in Pip's voice. */
  blurb: string
}

// Quadrant splits. Looseness echoes the VPIP bands in reads.ts (tight < 0.3,
// loose > 0.55); we split at the midpoint. Aggression splits at an even 50/50.
const LOOSE_SPLIT = 0.42
const AGGRO_SPLIT = 0.5

const ARCHETYPES: Record<StyleKey, { name: string; blurb: string }> = {
  shark: {
    name: 'The Shark',
    blurb: 'Tight and aggressive — selective, then lethal when you commit.',
  },
  maniac: {
    name: 'The Maniac',
    blurb: 'Loose and aggressive — relentless pressure from every seat.',
  },
  rock: {
    name: 'The Rock',
    blurb: 'Tight and patient — you wait for the goods and let others hang themselves.',
  },
  station: {
    name: 'The Station',
    blurb: 'Loose and easygoing — you love a flop and hate to fold.',
  },
}

/** Read the hero's lifetime style off their tendencies. */
export function derivePlayStyle(t: SeatStats): PlayStyle {
  const hands = t.handsDealt
  const looseness = hands > 0 ? t.vpipHands / hands : 0
  const actions = t.raises + t.calls
  const aggression = actions > 0 ? t.raises / actions : 0
  const foldToBet = t.betsFaced > 0 ? t.foldsToBet / t.betsFaced : 0

  const loose = looseness >= LOOSE_SPLIT
  const aggressive = aggression >= AGGRO_SPLIT
  const key: StyleKey = aggressive ? (loose ? 'maniac' : 'shark') : loose ? 'station' : 'rock'

  return {
    looseness,
    aggression,
    foldToBet,
    hands,
    ready: hands >= STYLE_MIN_HANDS,
    key,
    ...ARCHETYPES[key],
  }
}
