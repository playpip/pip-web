// The venue ladder — sit-and-go tournaments, low → high. To enter you need the
// buy-in in your Roll; the buy-in IS your starting stack ("your pot"). Everyone
// sits with equal stacks and plays until one player is left standing — the
// winner takes the prize. Bust and you're out.

import type { AiProfile } from '@/lib/poker/ai/policy'

/** Format tag shown on the venue card (side tables). */
export type VenueFormat = 'turbo' | 'hyper' | 'deep' | 'duel' | 'bounty'

export const FORMAT_LABELS: Record<VenueFormat, string> = {
  turbo: 'Turbo',
  hyper: 'Hyper',
  deep: 'Deep',
  duel: 'Heads-up',
  bounty: 'Bounty',
}

export interface Venue {
  id: string
  name: string
  tagline: string
  /** Chips to enter — deducted from your Roll, and your starting stack. */
  buyIn: number
  smallBlind: number
  bigBlind: number
  /** Total seats including the human. */
  seats: number
  /** Winner-take-all prize added to your Roll for taking the table down. */
  prize: number
  ai: AiProfile
  /** Accent used on the menu card. */
  accent: string
  /** Format tag (side tables) — purely display; mechanics come from the overrides below. */
  format?: VenueFormat
  /** Free to enter (the broke-player safety net); stacks come from `startingStack`. */
  freeroll?: boolean
  /** Table stack when it differs from the buy-in (freerolls, deep-stack tables). */
  startingStack?: number
  /** Set false to keep blinds flat all game (see config/blinds). Defaults to true. */
  escalation?: boolean
  /** Blinds rise every N hands (defaults to HANDS_PER_LEVEL in config/blinds). */
  handsPerLevel?: number
  /** Chips paid instantly for each opponent the player busts. */
  bounty?: number
  /** The Daily Deal: one seeded tournament a day, same shuffle for everyone. */
  daily?: boolean
}

// Low rungs escalate gently (handsPerLevel 12 → 9) — new players need room to
// play poker before the blinds force shove-or-fold. From the Casino up the
// default pacing applies and stack pressure becomes part of the difficulty.
export const VENUES: readonly Venue[] = [
  {
    id: 'garage',
    name: "Friends' Garage",
    tagline: 'Lowest stakes. Loose, forgiving reads.',
    buyIn: 100,
    smallBlind: 1,
    bigBlind: 2,
    seats: 4,
    prize: 400,
    handsPerLevel: 12,
    accent: '#7C8CF0',
    ai: { tightness: 0.15, aggression: 0.25, bluff: 0.05, iterations: 300, skill: 0.28 },
  },
  {
    id: 'pub',
    name: 'The Pub',
    tagline: 'Micro stakes. Friday-night amateurs.',
    buyIn: 300,
    smallBlind: 3,
    bigBlind: 6,
    seats: 5,
    prize: 1_500,
    handsPerLevel: 11,
    accent: '#5AA9E6',
    ai: { tightness: 0.22, aggression: 0.32, bluff: 0.06, iterations: 400, skill: 0.36 },
  },
  {
    id: 'poolhall',
    name: 'The Pool Hall',
    tagline: 'Low stakes. Hustlers between shots.',
    buyIn: 750,
    smallBlind: 5,
    bigBlind: 10,
    seats: 5,
    prize: 3_750,
    handsPerLevel: 10,
    accent: '#4FB477',
    ai: { tightness: 0.28, aggression: 0.4, bluff: 0.08, iterations: 550, skill: 0.44 },
  },
  {
    id: 'cardroom',
    name: 'The Card Room',
    tagline: 'Mid stakes. Tight, positional players.',
    buyIn: 2_000,
    smallBlind: 15,
    bigBlind: 30,
    seats: 6,
    prize: 12_000,
    handsPerLevel: 9,
    accent: '#E0A458',
    ai: { tightness: 0.38, aggression: 0.5, bluff: 0.11, iterations: 750, skill: 0.54 },
  },
  {
    id: 'casino',
    name: 'Downtown Casino',
    tagline: 'High stakes. Aggressive, bluff-aware.',
    buyIn: 5_000,
    smallBlind: 25,
    bigBlind: 50,
    seats: 6,
    prize: 30_000,
    accent: '#D9534F',
    ai: { tightness: 0.45, aggression: 0.58, bluff: 0.14, iterations: 950, skill: 0.64 },
  },
  {
    id: 'riverboat',
    name: 'The Riverboat',
    tagline: 'Sharp locals who float and barrel.',
    buyIn: 15_000,
    smallBlind: 75,
    bigBlind: 150,
    seats: 6,
    prize: 90_000,
    accent: '#17A2B8',
    ai: { tightness: 0.5, aggression: 0.62, bluff: 0.15, iterations: 1_100, skill: 0.74 },
  },
  {
    id: 'penthouse',
    name: 'The Penthouse',
    tagline: 'Invite-only. Patient, positional killers.',
    buyIn: 40_000,
    smallBlind: 200,
    bigBlind: 400,
    seats: 6,
    prize: 240_000,
    accent: '#C049D4',
    ai: { tightness: 0.52, aggression: 0.66, bluff: 0.16, iterations: 1_300, skill: 0.84 },
  },
  {
    id: 'montecarlo',
    name: 'Monte Carlo',
    tagline: 'Old-money pros. Balanced, relentless.',
    buyIn: 100_000,
    smallBlind: 500,
    bigBlind: 1_000,
    seats: 6,
    prize: 600_000,
    accent: '#E8B923',
    ai: { tightness: 0.55, aggression: 0.7, bluff: 0.17, iterations: 1_500, skill: 0.91 },
  },
  {
    id: 'vegas',
    name: 'Vegas Championship',
    tagline: 'Elite field. Semi-bluffs, traps, thin value.',
    buyIn: 300_000,
    smallBlind: 1_500,
    bigBlind: 3_000,
    seats: 6,
    prize: 1_800_000,
    accent: '#FF7A45',
    ai: { tightness: 0.58, aggression: 0.72, bluff: 0.18, iterations: 1_650, skill: 0.95 },
  },
  {
    id: 'mainevent',
    name: 'The Main Event',
    tagline: 'The final boss. Near-optimal, merciless.',
    buyIn: 1_000_000,
    smallBlind: 5_000,
    bigBlind: 10_000,
    seats: 6,
    prize: 6_000_000,
    accent: '#F0574E',
    ai: { tightness: 0.6, aggression: 0.75, bluff: 0.2, iterations: 1_800 },
  },
] as const

// Side tables — format twists off the main ladder, at low-to-mid stakes so they
// never gate progression. Same engine, different pressure: pacing, stack depth,
// seat count and knockout bounties are all just venue config.
export const SIDE_TABLES: readonly Venue[] = [
  {
    id: 'redeye',
    name: 'The Red-Eye',
    tagline: 'Turbo. Blinds up every three hands.',
    buyIn: 500,
    smallBlind: 5,
    bigBlind: 10,
    seats: 5,
    prize: 2_500,
    format: 'turbo',
    handsPerLevel: 3,
    accent: '#E06D8C',
    ai: { tightness: 0.25, aggression: 0.45, bluff: 0.07, iterations: 450, skill: 0.42 },
  },
  {
    id: 'study',
    name: 'The Study',
    tagline: 'Deep stacks, slow blinds. Patience poker.',
    buyIn: 1_000,
    startingStack: 2_000,
    smallBlind: 5,
    bigBlind: 10,
    seats: 5,
    prize: 5_000,
    format: 'deep',
    handsPerLevel: 9,
    accent: '#6E8B9E',
    ai: { tightness: 0.4, aggression: 0.35, bluff: 0.08, iterations: 550, skill: 0.5 },
  },
  {
    id: 'duel',
    name: 'The Duel',
    tagline: 'Heads-up. Just you and them.',
    buyIn: 750,
    smallBlind: 5,
    bigBlind: 10,
    seats: 2,
    prize: 1_500,
    format: 'duel',
    accent: '#9A7FD1',
    ai: { tightness: 0.35, aggression: 0.5, bluff: 0.1, iterations: 550, skill: 0.5 },
  },
  {
    id: 'docks',
    name: 'The Docks',
    tagline: 'Bounty table. Knockouts pay on the spot.',
    buyIn: 2_000,
    smallBlind: 15,
    bigBlind: 30,
    seats: 6,
    prize: 9_500,
    format: 'bounty',
    bounty: 500,
    accent: '#C9873D',
    ai: { tightness: 0.35, aggression: 0.5, bluff: 0.1, iterations: 700, skill: 0.56 },
  },
  {
    id: 'allnighter',
    name: 'The All-Nighter',
    tagline: 'Hyper. Shallow stacks, blinds every two hands.',
    buyIn: 1_500,
    startingStack: 900,
    smallBlind: 10,
    bigBlind: 20,
    seats: 5,
    prize: 7_500,
    format: 'hyper',
    handsPerLevel: 2,
    accent: '#8F6FE8',
    ai: { tightness: 0.3, aggression: 0.55, bluff: 0.09, iterations: 550, skill: 0.52 },
  },
  {
    id: 'chopshop',
    name: 'The Chop Shop',
    tagline: 'Turbo bounty. Fast blinds, heads on the block.',
    buyIn: 5_000,
    smallBlind: 30,
    bigBlind: 60,
    seats: 6,
    prize: 22_500,
    format: 'bounty',
    bounty: 1_500,
    handsPerLevel: 3,
    accent: '#D95F43',
    ai: { tightness: 0.38, aggression: 0.55, bluff: 0.11, iterations: 800, skill: 0.62 },
  },
  {
    id: 'vault',
    name: 'The Vault',
    tagline: 'High-stakes heads-up. Bring your whole game.',
    buyIn: 25_000,
    smallBlind: 150,
    bigBlind: 300,
    seats: 2,
    prize: 50_000,
    format: 'duel',
    accent: '#93A5B8',
    ai: { tightness: 0.48, aggression: 0.6, bluff: 0.14, iterations: 1_100, skill: 0.78 },
  },
] as const

// Two Garage buy-ins: losing your first tournament stings but doesn't send a
// brand-new player straight to the freeroll.
export const STARTING_ROLL = 200

// The broke-player safety net: a free sit-and-go that opens only when you can't
// afford the Garage. No buy-in, everyone gets a nominal stack, and the winner
// takes home enough to buy back into the ladder. You win your way back in —
// there is no free top-up. The table stack is never yours: leaving a freeroll
// cashes out nothing (only the winner's prize pays). Deliberately a speed bump,
// not a wall: heads-up vs the softest AI, blinds never escalate, so a decent
// player wins it more often than not. (See docs/game-flow.md.)
export const KITCHEN_TABLE: Venue = {
  id: 'kitchen',
  name: 'The Kitchen Table',
  tagline: 'Freeroll. Win your way back in.',
  buyIn: 0,
  startingStack: 100,
  smallBlind: 1,
  bigBlind: 2,
  seats: 2,
  prize: 150,
  freeroll: true,
  escalation: false,
  accent: '#64B98C',
  // Low skill is what makes this beatable: heads-up, a sound equity bot is
  // brutal however "loose" it is. This one misreads its hand and folds under
  // pressure — simulated ~75% win rate for a competent-casual player.
  ai: { tightness: 0.55, aggression: 0.15, bluff: 0.03, iterations: 80, skill: 0.3 },
}

// The Daily Deal — one tournament a day, dealt from a date-derived seed, so
// everyone in the world who sits down today plays the identical shuffle. The
// open, deterministic engine makes that provably true (see docs/game-flow.md).
// It costs a real buy-in — there is no free top-up — and it can be played once:
// abandoning counts as played (the shuffle is knowable, so re-deals would be
// an exploit). Same cards, same opponents — your play makes the difference.
export const THE_DAILY: Venue = {
  id: 'daily',
  name: 'The Daily',
  tagline: 'One deal a day. Same cards for everyone.',
  buyIn: 500,
  smallBlind: 5,
  bigBlind: 10,
  seats: 5,
  prize: 2_500,
  daily: true,
  accent: '#7C8CF0', // the pip periwinkle — it's the house special
  ai: { tightness: 0.3, aggression: 0.45, bluff: 0.08, iterations: 500, skill: 0.45 },
}

/** The freeroll opens only while the player can't afford the ladder's bottom rung. */
export function freerollOpen(roll: number): boolean {
  return roll < VENUES[0].buyIn
}

export function venueById(id: string): Venue | undefined {
  return [...VENUES, ...SIDE_TABLES, KITCHEN_TABLE, THE_DAILY].find((v) => v.id === id)
}

/** Can the player afford this venue's buy-in? */
export function canAfford(venue: Venue, roll: number): boolean {
  return roll >= venue.buyIn
}
