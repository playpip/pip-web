// The venue ladder — sit-and-go tournaments, low → high. To enter you need the
// buy-in in your Roll; the buy-in IS your starting stack ("your pot"). Everyone
// sits with equal stacks and plays until one player is left standing — the
// winner takes the prize. Bust and you're out.

import type { MembersOnly } from '@/config/membership'
import type { AiProfile } from '@/lib/poker/ai/policy'
import type { Variant } from '@/lib/poker/handEval'

/** Format tag shown on the venue card (side tables). */
export type VenueFormat = 'turbo' | 'hyper' | 'deep' | 'duel' | 'bounty'

export const FORMAT_LABELS: Record<VenueFormat, string> = {
  turbo: 'Turbo',
  hyper: 'Hyper',
  deep: 'Deep',
  duel: 'Heads-up',
  bounty: 'Bounty',
}

export interface Venue extends MembersOnly {
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
  /**
   * Cash / ring table: fixed blinds, no prize, no elimination. Opponents rebuy
   * to the table stack so the table stays full, and you stand up with your
   * chips whenever you like. A place you dip into, not a tournament you finish.
   */
  cash?: boolean
  /**
   * Which game this table deals. Absent means Hold'em.
   *
   * One field, because everything that differs about Omaha follows from it:
   * four cards instead of two, the two-from-hand showdown rule, and pot-limit
   * betting. A table cannot be half-converted.
   */
  variant?: Variant
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
    seats: 3,
    prize: 300,
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
    // skill 1 is the top of the scale and the only rung that gets it: the final
    // boss plays its best game. It was previously left off, which meant the same
    // thing by way of AiProfile's default — stated here because an omission and a
    // decision are indistinguishable in a config file (technology#68).
    ai: { tightness: 0.6, aggression: 0.75, bluff: 0.2, iterations: 1_800, skill: 1 },
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

// The Rail — cash / ring tables. Unlike the ladder, these never end and have no
// prize: you sit down with a stack (a slice of your Roll), play any number of
// hands, and stand up with whatever's in front of you. Opponents rebuy so the
// table stays full; bust and you can rebuy or walk. Difficulty is the stake:
// Micro is loose-passive, the nosebleeds are sharks, so a player of any level
// finds an honest game just by picking their stake. That describes how the
// seats play, not how anyone does against them: no room on the Rail has ever
// had its beatability measured (technology#82). Every room is 100 big blinds
// deep and blinds never escalate. (See docs/game-flow.md.)
// Skill mirrors the post-rebalance ladder (~0.06 softer per rung): these tables
// were authored after that retune, so their numbers were dialled to match it.
// The canon four each sat 10x apart, which left a Micro grinder with an 800 roll
// nowhere honest to sit. Small / Club / Big fill the geometric midpoints, so every
// step is now ~3x, and their AI profiles are interpolated from their neighbours.
export const RING_TABLES: readonly Venue[] = [
  {
    id: 'ring-micro',
    name: 'Micro Ring',
    tagline: 'Loosest cash game. Sit down, stand up anytime.',
    buyIn: 200,
    startingStack: 200,
    smallBlind: 1,
    bigBlind: 2,
    seats: 5,
    prize: 0,
    cash: true,
    escalation: false,
    accent: '#7C8CF0',
    // Loose-passive on purpose: calls too much, rarely bluffs. That half is
    // measured: tests/ai.test.ts bands every table in ALL_VENUES on VPIP and PFR,
    // this one included, so it fails if the profile drifts out of the band.
    // Whether a beginner *beats* it has never been measured and this file should
    // not imply it has. `pnpm sim` cannot answer it: it plays a cash table as a
    // freezeout and every ring prize is 0, so its win-rate and EV columns say
    // nothing here (technology#81). The claim players actually see is the
    // tagline, and it is deliberately weaker than this comment used to be.
    ai: { tightness: 0.16, aggression: 0.2, bluff: 0.04, iterations: 350, skill: 0.24 },
  },
  {
    id: 'ring-small',
    name: 'Small Ring',
    tagline: 'Cash game. Loose, with a bit more bite.',
    buyIn: 600,
    startingStack: 600,
    smallBlind: 3,
    bigBlind: 6,
    seats: 5,
    prize: 0,
    cash: true,
    escalation: false,
    accent: '#5AA9E6',
    ai: { tightness: 0.24, aggression: 0.31, bluff: 0.06, iterations: 500, skill: 0.36 },
  },
  {
    id: 'ring-low',
    name: 'Low Ring',
    tagline: 'Cash game. Friday-night regulars.',
    buyIn: 2_000,
    startingStack: 2_000,
    smallBlind: 10,
    bigBlind: 20,
    seats: 6,
    prize: 0,
    cash: true,
    escalation: false,
    accent: '#4FB477',
    ai: { tightness: 0.32, aggression: 0.42, bluff: 0.09, iterations: 700, skill: 0.49 },
  },
  {
    id: 'ring-club',
    name: 'Club Ring',
    tagline: 'Cash game. Thinking players, still exploitable.',
    buyIn: 6_000,
    startingStack: 6_000,
    smallBlind: 30,
    bigBlind: 60,
    seats: 6,
    prize: 0,
    cash: true,
    escalation: false,
    accent: '#E8B923',
    ai: { tightness: 0.41, aggression: 0.52, bluff: 0.12, iterations: 900, skill: 0.61 },
  },
  {
    id: 'ring-mid',
    name: 'Mid Ring',
    tagline: 'Cash game. Solid, bluff-aware players.',
    buyIn: 20_000,
    startingStack: 20_000,
    smallBlind: 100,
    bigBlind: 200,
    seats: 6,
    prize: 0,
    cash: true,
    escalation: false,
    accent: '#E0A458',
    ai: { tightness: 0.5, aggression: 0.62, bluff: 0.15, iterations: 1_150, skill: 0.74 },
  },
  {
    id: 'ring-big',
    name: 'Big Ring',
    tagline: 'Big cash. Sharp, patient, hard to bluff.',
    buyIn: 60_000,
    startingStack: 60_000,
    smallBlind: 300,
    bigBlind: 600,
    seats: 6,
    prize: 0,
    cash: true,
    escalation: false,
    accent: '#FF7A45',
    ai: { tightness: 0.54, aggression: 0.67, bluff: 0.16, iterations: 1_350, skill: 0.82 },
  },
  {
    id: 'ring-high',
    name: 'High Ring',
    tagline: 'Nosebleed cash. Sharks only.',
    buyIn: 200_000,
    startingStack: 200_000,
    smallBlind: 1_000,
    bigBlind: 2_000,
    seats: 6,
    prize: 0,
    cash: true,
    escalation: false,
    accent: '#D9534F',
    ai: { tightness: 0.57, aggression: 0.72, bluff: 0.18, iterations: 1_600, skill: 0.89 },
  },
] as const

// Challenge tables: where a cast member's standing challenge is played out.
// One per band, heads-up, and the character is NOT part of the config: the
// venue supplies the stakes and the difficulty, `lib/challenge` supplies who is
// sitting opposite. Same split as everywhere else: skill is venue-owned, the
// character brings their delta and their face (see docs/venues.md).
//
// Buy-ins deliberately sit *between* the ladder rungs rather than on them. A
// challenge pays ~2.5x where a ladder duel pays 2x, so putting one at The
// Duel's 750 would leave The Duel with no reason to exist. Stacks are 50-75bb,
// the same depth as the other heads-up tables.
//
// These are reachable (`ALL_VENUES`, and therefore `venueById` and the static
// export) as of the card landing, but reaching one by guessing the URL is not
// enough to play it: `PlayClient` turns you away unless the table matches the
// challenge you actually have standing, so a 2.5x heads-up game is never a
// repeatable farm (technology#22).
export const CHALLENGE_TABLES: readonly Venue[] = [
  {
    id: 'challenge-low',
    name: 'The Challenge',
    tagline: 'Heads-up. They asked for this.',
    buyIn: 500,
    smallBlind: 5,
    bigBlind: 10,
    seats: 2,
    prize: 1_250,
    format: 'duel',
    accent: '#9A7FD1',
    ai: { tightness: 0.28, aggression: 0.42, bluff: 0.08, iterations: 500, skill: 0.4 },
  },
  {
    id: 'challenge-mid',
    name: 'The Challenge',
    tagline: 'Heads-up. They asked for this.',
    buyIn: 8_000,
    smallBlind: 60,
    bigBlind: 120,
    seats: 2,
    prize: 20_000,
    format: 'duel',
    accent: '#8F6FE8',
    ai: { tightness: 0.42, aggression: 0.55, bluff: 0.12, iterations: 850, skill: 0.62 },
  },
  {
    id: 'challenge-high',
    name: 'The Challenge',
    tagline: 'Heads-up. They asked for this.',
    buyIn: 50_000,
    smallBlind: 350,
    bigBlind: 700,
    seats: 2,
    prize: 125_000,
    format: 'duel',
    accent: '#C049D4',
    ai: { tightness: 0.52, aggression: 0.65, bluff: 0.16, iterations: 1_200, skill: 0.8 },
  },
] as const

// Member tables — what the membership adds to the side tables.
//
// **Two cards, not five.** This started as a `MEMBER_TABLES` array of five rooms
// with its own lobby tile and its own browser page, and that was one tile too
// many on a home screen whose job is to make *tables* prominent: six 16:10 tiles
// across the row made every one of them smaller (Will, 2026-09-19). The rooms
// were mostly variations on stack depth, so they collapse into one card that
// asks you how deep you want to play for — and the one that was not a depth
// variation, Pot-Limit Omaha, is a format twist and belongs on the side tables
// with the other format twists.
//
// **They are ordinary tables in every way that touches a hand.** Same engine,
// same shuffle, same AI policy, same economy: `prize = buyIn × seats`, exactly as
// on the ladder. Anyone who suspects otherwise can read this array and the engine
// beside it, which is the argument open source does for us (docs/brand.md).
//
// **They are ranked**, and that is not pay-to-win — see docs/membership.md.

/**
 * Deep Stack, at every stake it is offered at.
 *
 * One card on the side tables, and the info dialog swaps between these. They are
 * **five real registered venues rather than one venue with a dynamic buy-in**,
 * and that is the whole reason this is cheap: every route is generated at build
 * time under the static export, nothing new has to persist, `venueById` resolves
 * a deep link on its own, and `tests/ai.test.ts` bands each profile the day it
 * lands. A dynamic buy-in would have bought a persisted field, a migration and a
 * resolution step in `PlayClient` to save four config entries.
 *
 * Three times the buy-in in chips and a twelve-hand level, at every stake: deep
 * is the point, so it is the thing that does not vary. The opposition is the
 * ladder rung at the same price, taken whole rather than invented — the same
 * rule a built table follows (config/customTable.ts).
 */
export const DEEP_STACK_TABLES: readonly Venue[] = [
  {
    id: 'deepstack-750',
    name: 'Deep Stack',
    tagline: 'Three times the chips, and a slow clock.',
    buyIn: 750,
    startingStack: 2_250,
    smallBlind: 5,
    bigBlind: 10,
    seats: 6,
    prize: 4_500,
    format: 'deep',
    handsPerLevel: 12,
    membersOnly: true,
    accent: '#B5835A',
    ai: { tightness: 0.28, aggression: 0.4, bluff: 0.08, iterations: 550, skill: 0.44 },
  },
  {
    id: 'deepstack-2000',
    name: 'Deep Stack',
    tagline: 'Three times the chips, and a slow clock.',
    buyIn: 2_000,
    startingStack: 6_000,
    smallBlind: 15,
    bigBlind: 30,
    seats: 6,
    prize: 12_000,
    format: 'deep',
    handsPerLevel: 12,
    membersOnly: true,
    accent: '#B5835A',
    ai: { tightness: 0.38, aggression: 0.5, bluff: 0.11, iterations: 750, skill: 0.54 },
  },
  {
    id: 'deepstack-5000',
    name: 'Deep Stack',
    tagline: 'Three times the chips, and a slow clock.',
    buyIn: 5_000,
    startingStack: 15_000,
    smallBlind: 25,
    bigBlind: 50,
    seats: 6,
    prize: 30_000,
    format: 'deep',
    handsPerLevel: 12,
    membersOnly: true,
    accent: '#B5835A',
    ai: { tightness: 0.45, aggression: 0.58, bluff: 0.14, iterations: 950, skill: 0.64 },
  },
  {
    id: 'deepstack-15000',
    name: 'Deep Stack',
    tagline: 'Three times the chips, and a slow clock.',
    buyIn: 15_000,
    startingStack: 45_000,
    smallBlind: 75,
    bigBlind: 150,
    seats: 6,
    prize: 90_000,
    format: 'deep',
    handsPerLevel: 12,
    membersOnly: true,
    accent: '#B5835A',
    ai: { tightness: 0.5, aggression: 0.62, bluff: 0.15, iterations: 1_100, skill: 0.74 },
  },
  {
    id: 'deepstack-40000',
    name: 'Deep Stack',
    tagline: 'Three times the chips, and a slow clock.',
    buyIn: 40_000,
    startingStack: 120_000,
    smallBlind: 200,
    bigBlind: 400,
    seats: 6,
    prize: 240_000,
    format: 'deep',
    handsPerLevel: 12,
    membersOnly: true,
    accent: '#B5835A',
    ai: { tightness: 0.52, aggression: 0.66, bluff: 0.16, iterations: 1_300, skill: 0.84 },
  },
] as const

/** The stake the Deep Stack card shows, and the one its dialog opens on. */
export const DEEP_STACK_DEFAULT = DEEP_STACK_TABLES[1]

/** Every stake Deep Stack is offered at, cheapest first. */
export function deepStackFamily(): readonly Venue[] {
  return DEEP_STACK_TABLES
}

/** Is this one of the Deep Stack stakes? Drives the dialog's stake picker. */
export function isDeepStack(venue: Venue): boolean {
  return DEEP_STACK_TABLES.some((v) => v.id === venue.id)
}

/**
 * The Big Pot — Pot-Limit Omaha, and the only table that deals a different game.
 *
 * Deep on purpose: Omaha is a drawing game and short stacks turn it into a coin
 * flip. Its opponents are the Downtown Casino's, because that is what a 5,000
 * buy-in seats you against everywhere else — a known approximation, since their
 * equity reading is genuinely Omaha but their personalities were banded against
 * two cards. See docs/poker-engine.md → Variants.
 */
export const BIG_POT: Venue = {
  id: 'bigpot',
  name: 'The Big Pot',
  tagline: 'Pot-Limit Omaha. Four cards, use exactly two.',
  buyIn: 5_000,
  startingStack: 10_000,
  smallBlind: 25,
  bigBlind: 50,
  seats: 6,
  prize: 30_000,
  format: 'deep',
  handsPerLevel: 10,
  membersOnly: true,
  variant: 'omaha',
  accent: '#5B7FC7',
  ai: { tightness: 0.45, aggression: 0.58, bluff: 0.14, iterations: 950, skill: 0.64 },
}

/**
 * The placeholder that gives a built table a route to be played at.
 *
 * A static export generates routes from `ALL_VENUES` at build time, and a table
 * the player composes in a browser cannot be in that list — so one fixed id is,
 * and `/play/custom` resolves it against the spec on the profile at run time
 * (see PlayClient and config/customTable.ts). **Nothing plays these numbers.**
 * They exist so that `venueById('custom')` is not undefined between the route
 * mounting and the real venue being built, and so the tile has something to
 * measure. If a hand is ever dealt from this object, the resolution step has
 * been skipped and that is a bug rather than a cheap table.
 */
export const CUSTOM_TABLE_ROUTE: Venue = {
  id: 'custom',
  name: 'Your table',
  tagline: 'Built by you.',
  buyIn: 0,
  smallBlind: 0,
  bigBlind: 0,
  seats: 2,
  prize: 0,
  membersOnly: true,
  accent: '#8A8F98',
  ai: { tightness: 0.3, aggression: 0.4, bluff: 0.08, iterations: 300, skill: 0.3 },
}

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
  // 25bb heads-up (was 50bb): flat blinds mean a fold-heavy opponent transfers
  // chips slowly, so a deep stack made the freeroll a long grind even though
  // it's easy. Halving the stack halves the hands-to-win without touching AI
  // skill or blinds — still soft, just quicker to close out.
  startingStack: 50,
  smallBlind: 1,
  bigBlind: 2,
  seats: 2,
  prize: 150,
  freeroll: true,
  escalation: false,
  accent: '#64B98C',
  // Low skill is what makes this beatable: heads-up, a sound equity bot is
  // brutal however "loose" it is. This one misreads its hand and folds under
  // pressure — and since the AI now ranges its opponent (folding more to a
  // bettor), heads-up it plays soft enough that a competent player wins it
  // ~95%+. That's the intent: the freeroll is a speed bump, a near-gimme back
  // onto the ladder, not a wall.
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

/**
 * Everything the side-tables shelf shows, free and paid, in display order.
 *
 * **One list, read by both the page and the lobby tile that counts it.** The
 * tile used to count `SIDE_TABLES` directly and said "7 formats" on a shelf
 * showing nine the day the membership's tables landed there (Will, 2026-09-19).
 * A count derived from a different list than the one being rendered is a fact
 * that goes quietly wrong, so there is now only one list.
 *
 * The builder is not here: it is not a venue, and it is appended by the page as
 * a tile of its own.
 */
export const SIDE_SHELF: readonly Venue[] = [...SIDE_TABLES, DEEP_STACK_DEFAULT, BIG_POT]

/**
 * Every table a player can sit at, in one list.
 *
 * It exists so route resolution and route *generation* cannot drift: under the
 * static export, an id that `venueById` knows but `generateStaticParams` never
 * emitted is a 404 with a fully green build. Both read this.
 *
 * **The member tables are in here, and that is on purpose.** Their routes are
 * generated for everybody, exactly like the challenge tables above: a static
 * export cannot generate a route conditionally on something it learns in the
 * browser, so leaving them out would make a member's own table a 404 on the
 * frame before their row comes back. The refusal is a screen, not a missing
 * page — `refuseSitDown()` is what actually turns a non-member away, and it is
 * read by the browser and the route both.
 *
 * **All five Deep Stack stakes are here and only one of them is browsable.** The
 * side-tables page shows `DEEP_STACK_DEFAULT` as a single card and the info
 * dialog swaps between the rest, so the other four need routes without needing
 * tiles. That is the trade that keeps the stake a choice without inventing any
 * persisted state.
 */
export const ALL_VENUES: readonly Venue[] = [
  ...VENUES,
  ...SIDE_TABLES,
  ...RING_TABLES,
  ...CHALLENGE_TABLES,
  ...DEEP_STACK_TABLES,
  BIG_POT,
  KITCHEN_TABLE,
  THE_DAILY,
  CUSTOM_TABLE_ROUTE,
]

export function venueById(id: string): Venue | undefined {
  return ALL_VENUES.find((v) => v.id === id)
}

/** Can the player afford this venue's buy-in? */
export function canAfford(venue: Venue, roll: number): boolean {
  return roll >= venue.buyIn
}

/** The table stack a venue seats you with (game.ts derives it the same way). */
function tableStack(venue: Venue): number {
  return venue.startingStack ?? venue.buyIn
}

/**
 * What a stack is worth in Roll chips when you stand up.
 *
 * At almost every table it is the stack, because the buy-in *is* the starting
 * stack. The two that override it deal chips that are not Roll chips: The Study
 * sells a 2,000 stack for 1,000, the All-Nighter a 900 stack for 1,500. Paying
 * those back at face value printed 1,000 chips for sitting down and standing up
 * again at one, and ate 600 at the other, whichever way the hands went
 * (technology#89).
 *
 * A freeroll pays back nothing: those are the house's chips and only the prize
 * cashes, which is what stops the Kitchen Table being farmed for its stack.
 */
export function cashOutValue(venue: Venue, stack: number): number {
  if (venue.freeroll) return 0
  const stackSize = tableStack(venue)
  if (stackSize <= 0 || stackSize === venue.buyIn) return stack
  return Math.round(stack * (venue.buyIn / stackSize))
}
