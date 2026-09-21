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

const VARIANT_LABELS: Record<Variant, string> = {
  holdem: "Hold'em",
  omaha: 'Omaha',
  shortdeck: 'Short Deck',
  omahahilo: 'Omaha Hi-Lo',
  draw: 'Five-Card Draw',
}

/**
 * The one word a venue wears beside its name — on the card corner and in the
 * info dialog's title.
 *
 * **The game outranks the format.** The Big Pot is registered as a `deep` table
 * and is genuinely deep, but it is also the only table in the app that does not
 * deal Hold'em, and a badge reading "Deep" spent that slot on the less
 * surprising of the two facts. A player should not have to open a dialog to
 * find out they are about to be dealt four cards (Will, 2026-09-20).
 *
 * Hold'em is never labelled: it is the whole rest of the game, so saying so
 * would put a badge on twenty-odd cards to distinguish none of them.
 */
export function venueTag(venue: Venue): string | null {
  if (venue.variant && venue.variant !== 'holdem') return VARIANT_LABELS[venue.variant]
  return venue.format ? FORMAT_LABELS[venue.format] : null
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

// Side tables — format twists off the main ladder. Same engine, different
// pressure: pacing, stack depth, seat count and knockout bounties are all just
// venue config.
//
// **The rooms themselves, before the gate.** Declared free-shaped and gated in
// one place below, rather than seven `membersOnly: true` lines somebody has to
// remember — see SIDE_TABLES.
const SIDE_TABLE_ROOMS: readonly Venue[] = [
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

/**
 * The side tables, every one of them the membership's (Will, 2026-09-20).
 *
 * **The gate is applied here rather than typed into each room**, and that is the
 * point: rule 1 now says *every* side table is behind the check, so an eighth
 * room added next year is a member room on the day it is added rather than on
 * the day somebody notices. A flag that has to be remembered seven times is a
 * flag that will be forgotten an eighth (technology#55, inverted).
 *
 * These seven shipped free and were moved behind the check before Stripe
 * existed, so nobody had paid for them or chosen Pip because of them. That is
 * the only circumstance in which this was allowed and it is written up in full
 * in docs/membership.md — including why it does not happen again.
 */
export const SIDE_TABLES: readonly Venue[] = SIDE_TABLE_ROOMS.map((room) => ({
  ...room,
  membersOnly: true,
}))

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

// `DEEP_STACK_DEFAULT`, `deepStackFamily()` and `isDeepStack()` lived here until
// 2026-09-20. They were the hard-coded version of one idea — a card with several
// rooms priced behind it — and the dialog asked `isDeepStack(venue)` to know
// whether to offer a picker, which is a question that needed a fresh special
// case for every family after the first. `SIDE_SHELF` below is the general
// form; `familyOf()` replaces all three.

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
 * Short Deck — thirty-six cards, and two rules that come with them.
 *
 * The deuces through fives are gone, which makes flushes rare enough to outrank
 * a full house and leaves the ace to play low under the six. Both live in
 * `lib/poker/shortDeck.ts` with the tests that prove them; nothing about them
 * is configurable here, because a table that was half-converted would be a
 * different game to the one it says it is.
 *
 * **Deep on purpose**, like Omaha next door: hands run into each other far more
 * often on a short deck, so a short stack turns every one of them into a race.
 * Twice the buy-in, and the opposition is the ladder rung at the same price —
 * taken whole rather than invented, the rule every added table follows.
 */
export const SHORT_DECK_TABLES: readonly Venue[] = [
  {
    id: 'shortdeck-1000',
    name: 'Short Deck',
    tagline: 'Thirty-six cards. Flushes beat full houses.',
    buyIn: 1_000,
    startingStack: 2_000,
    smallBlind: 5,
    bigBlind: 10,
    seats: 6,
    prize: 6_000,
    handsPerLevel: 10,
    membersOnly: true,
    variant: 'shortdeck',
    accent: '#D95F43',
    ai: { tightness: 0.3, aggression: 0.45, bluff: 0.09, iterations: 600, skill: 0.5 },
  },
  {
    id: 'shortdeck-5000',
    name: 'Short Deck',
    tagline: 'Thirty-six cards. Flushes beat full houses.',
    buyIn: 5_000,
    startingStack: 10_000,
    smallBlind: 25,
    bigBlind: 50,
    seats: 6,
    prize: 30_000,
    handsPerLevel: 10,
    membersOnly: true,
    variant: 'shortdeck',
    accent: '#D95F43',
    ai: { tightness: 0.38, aggression: 0.55, bluff: 0.12, iterations: 950, skill: 0.64 },
  },
  {
    id: 'shortdeck-20000',
    name: 'Short Deck',
    tagline: 'Thirty-six cards. Flushes beat full houses.',
    buyIn: 20_000,
    startingStack: 40_000,
    smallBlind: 100,
    bigBlind: 200,
    seats: 6,
    prize: 120_000,
    handsPerLevel: 10,
    membersOnly: true,
    variant: 'shortdeck',
    accent: '#D95F43',
    ai: { tightness: 0.45, aggression: 0.62, bluff: 0.15, iterations: 1_200, skill: 0.78 },
  },
] as const

/**
 * Omaha Hi-Lo — the same four cards, and half the pot going the other way.
 *
 * Every pot splits between the best high hand and the best *low*: five cards,
 * eight or lower, no pairs, ace counting as one, and still exactly two from
 * your hand. When nobody makes one the high hand takes the lot, which is about
 * half the time. `lib/poker/hiLo.ts` owns the rules and the tests own the
 * arithmetic — a pot cut in two is the one place in this engine where chips
 * could quietly stop adding up.
 *
 * Deep, and for the same reason The Big Pot is: a drawing game on a short stack
 * is a coin flip. Opposition taken from the ladder rung at the same price.
 */
export const HI_LO_TABLES: readonly Venue[] = [
  {
    id: 'hilo-2000',
    name: 'The Split',
    tagline: 'Omaha Hi-Lo. Half the pot goes to the worst hand.',
    buyIn: 2_000,
    startingStack: 4_000,
    smallBlind: 15,
    bigBlind: 30,
    seats: 6,
    prize: 12_000,
    handsPerLevel: 10,
    membersOnly: true,
    variant: 'omahahilo',
    accent: '#4FB477',
    ai: { tightness: 0.38, aggression: 0.5, bluff: 0.11, iterations: 750, skill: 0.54 },
  },
  {
    id: 'hilo-10000',
    name: 'The Split',
    tagline: 'Omaha Hi-Lo. Half the pot goes to the worst hand.',
    buyIn: 10_000,
    startingStack: 20_000,
    smallBlind: 50,
    bigBlind: 100,
    seats: 6,
    prize: 60_000,
    handsPerLevel: 10,
    membersOnly: true,
    variant: 'omahahilo',
    accent: '#4FB477',
    ai: { tightness: 0.47, aggression: 0.6, bluff: 0.14, iterations: 1_050, skill: 0.7 },
  },
] as const

/**
 * Five-Card Draw — no board, and the only hand nobody else can read.
 *
 * Five cards each, one betting round, a discard, another betting round, and a
 * showdown. Nothing is ever face up until the end, so the only information at
 * the table is how many cards each player asked for — which makes it the one
 * game here where the bluff is the whole point rather than a tool.
 *
 * **Five seats, and that is arithmetic rather than taste.** Five hands of five
 * is twenty-five cards, and five players drawing five each is twenty-five more:
 * fifty, against a fifty-two-card deck. A sixth seat needs sixty and the engine
 * throws mid-hand. `tests/draw.test.ts` pins the sum.
 */
export const DRAW_TABLES: readonly Venue[] = [
  {
    id: 'draw-1000',
    name: 'The Parlour',
    tagline: 'Five-Card Draw. No board, nothing to read but the discards.',
    buyIn: 1_000,
    startingStack: 2_000,
    smallBlind: 5,
    bigBlind: 10,
    seats: 5,
    prize: 5_000,
    handsPerLevel: 10,
    membersOnly: true,
    variant: 'draw',
    accent: '#8F6FE8',
    ai: { tightness: 0.32, aggression: 0.46, bluff: 0.12, iterations: 600, skill: 0.5 },
  },
  {
    id: 'draw-5000',
    name: 'The Parlour',
    tagline: 'Five-Card Draw. No board, nothing to read but the discards.',
    buyIn: 5_000,
    startingStack: 10_000,
    smallBlind: 25,
    bigBlind: 50,
    seats: 5,
    prize: 25_000,
    handsPerLevel: 10,
    membersOnly: true,
    variant: 'draw',
    accent: '#8F6FE8',
    ai: { tightness: 0.42, aggression: 0.56, bluff: 0.16, iterations: 950, skill: 0.64 },
  },
] as const

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

// --- the side-tables shelf ---------------------------------------------------
//
// **One card per thing that is different, with the prices behind it**
// (Will, 2026-09-20). The shelf used to be ten venue cards in a flat grid, and
// it told you neither of the two things you needed: "The Docks" does not say
// *bounty*, and a row of buy-ins running 500 to 25,000 in no order does not say
// whether any of it is above or below where you play.
//
// So the cards are now families. A family is one idea — Fast, Heads-Up, Bounty,
// Deep, a whole different game — and the rooms inside it are the same idea at
// different prices, picked on the second screen of the info dialog. That is the
// shape Deep Stack already had and the one that survived contact with a player
// (see VenueInfoDialog); this generalises it rather than inventing anything.
//
// **No new art was commissioned.** Every family wears art that already existed,
// which is why `art` is a separate field from `id` — the family called Fast is
// not a venue called redeye, it just borrows its painting.

/** Which half of the shelf a family belongs to. */
export type ShelfSection = 'games' | 'twists'

/** One card on the side-tables shelf: an idea, and the rooms that price it. */
export interface TableFamily extends MembersOnly {
  id: string
  name: string
  tagline: string
  /** An existing venue-art id to wear. Families do not have art of their own. */
  art: string
  accent: string
  /** The corner word, where the name does not already say it. */
  tag?: string
  section: ShelfSection
  /** What is different about this family, for the dialog. One paragraph. */
  note: string
  /** The rooms behind the card, cheapest first. One is a perfectly good family. */
  rooms: readonly Venue[]
}

/** A gated side-table room by id — throws rather than silently dropping a card. */
function sideTable(id: string): Venue {
  const room = SIDE_TABLES.find((v) => v.id === id)
  if (!room) throw new Error(`no side table with id ${id}`)
  return room
}

/**
 * Everything the side-tables shelf shows, in display order.
 *
 * **One list, read by the page, the two sections it renders, and the lobby tile
 * that counts it.** The tile used to count `SIDE_TABLES` directly and said
 * "7 formats" over a page rendering nine the day the membership's tables landed
 * there (Will, 2026-09-19). A count derived from a different list than the one
 * being rendered is a fact that goes quietly wrong, so there is one list.
 *
 * The builder is not here: it is not a family of rooms, and the page appends it
 * as a tile of its own.
 */
export const SIDE_SHELF: readonly TableFamily[] = [
  {
    id: 'omaha',
    name: 'The Big Pot',
    tagline: 'Pot-Limit Omaha. Four cards, use exactly two.',
    art: 'bigpot',
    accent: '#5B7FC7',
    tag: 'Omaha',
    section: 'games',
    membersOnly: true,
    note: 'Four cards in your hand instead of two, and at showdown you must use exactly two of them with exactly three from the board. No more, no less: four to a flush on the board plus one in your hand is nothing here. Four cards make far more big hands, so one pair rarely wins and straights and flushes are ordinary. Pot-limit means the largest bet allowed is the size of the pot, so nobody shoves all-in before the flop. Stacks start deep because Omaha is a drawing game and short ones turn it into a coin flip.',
    rooms: [BIG_POT],
  },
  {
    id: 'shortdeck',
    name: 'Short Deck',
    tagline: 'Thirty-six cards. A flush beats a full house.',
    art: 'chopshop',
    accent: '#D95F43',
    tag: 'Short Deck',
    section: 'games',
    membersOnly: true,
    note: 'The deuces through the fives are thrown away before the deal, and two rules come with the thirty-six cards that are left. A flush now beats a full house, because nine of each suit instead of thirteen makes flushes the rarer hand. And the ace plays low under the six, so A-6-7-8-9 is a straight — a nine-high one, not an ace-high one. Everything else is the Hold’em you already know, except that far more of it connects.',
    rooms: [...SHORT_DECK_TABLES],
  },
  {
    id: 'hilo',
    name: 'The Split',
    tagline: 'Omaha Hi-Lo. Half the pot goes to the worst hand.',
    art: 'vault',
    accent: '#4FB477',
    tag: 'Hi-Lo',
    section: 'games',
    membersOnly: true,
    note: 'Omaha, and then every pot is cut in half. One half goes to the best hand as usual; the other goes to the best *low* — five cards of different ranks, all eight or lower, with the ace counting as one. Straights and flushes do not stop a hand being low, so 5-4-3-2-A is both the best low there is and a straight. You still have to use exactly two from your hand for each half, and they are rarely the same two. When nobody makes a qualifying low, which is about half the time, the high hand takes the lot.',
    rooms: [...HI_LO_TABLES],
  },
  {
    id: 'draw',
    name: 'The Parlour',
    tagline: 'Five-Card Draw. No board, nothing to read but the discards.',
    art: 'allnighter',
    accent: '#8F6FE8',
    tag: 'Draw',
    section: 'games',
    membersOnly: true,
    note: 'The oldest game in the room and the least like the rest of this app. Five cards each, all face down, and no board — so there is nothing on the table to read and nothing to share. One round of betting, then everybody throws away as many cards as they like and takes replacements, then one more round, then you show. The only information anybody gets all hand is how many cards you asked for, which is why standing pat on nothing is a real play here rather than a stunt.',
    rooms: [...DRAW_TABLES],
  },
  {
    id: 'fast',
    name: 'Fast',
    tagline: 'The clock is the opponent.',
    art: 'redeye',
    accent: '#E06D8C',
    tag: 'Fast',
    section: 'twists',
    membersOnly: true,
    note: 'The blinds come for you. The Red-Eye moves them every three hands; the All-Nighter every two and seats you short to begin with. Patience stops being a virtue somewhere around the second level.',
    rooms: [sideTable('redeye'), sideTable('allnighter')],
  },
  {
    id: 'headsup',
    name: 'Heads-Up',
    tagline: 'One opponent. Every hand contested.',
    art: 'duel',
    accent: '#9A7FD1',
    tag: 'Heads-up',
    section: 'twists',
    membersOnly: true,
    note: 'Two seats, no hiding in the middle, and you are in every pot whether you like it or not. Fold too much and the blinds eat you; the Vault does it for thirty times the money.',
    rooms: [sideTable('duel'), sideTable('vault')],
  },
  {
    id: 'bounty',
    name: 'Bounty',
    tagline: 'A price on every head.',
    art: 'docks',
    accent: '#C9873D',
    tag: 'Bounty',
    section: 'twists',
    membersOnly: true,
    note: 'Bust somebody and their bounty pays into your Roll on the spot, on top of the chips you just took off them. The Chop Shop pays three times as much and runs the blinds up fast, so the heads are worth more and there is less time to collect them.',
    rooms: [sideTable('docks'), sideTable('chopshop')],
  },
  {
    id: 'deep',
    name: 'Deep',
    tagline: 'More chips than the buy-in, and a slow clock.',
    art: 'study',
    accent: '#B5835A',
    tag: 'Deep',
    section: 'twists',
    membersOnly: true,
    note: 'Everyone sits with more chips than they paid and the blinds climb slowly, so hands get played rather than shoved. The Study doubles the usual stack; the Deep Stack rooms triple it and slow the clock further.',
    rooms: [DEEP_STACK_TABLES[0], sideTable('study'), ...DEEP_STACK_TABLES.slice(1)],
  },
]

/** The families in one half of the shelf, in order. */
export function familiesIn(section: ShelfSection): readonly TableFamily[] {
  return SIDE_SHELF.filter((f) => f.section === section)
}

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
  ...SHORT_DECK_TABLES,
  ...HI_LO_TABLES,
  ...DRAW_TABLES,
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

/**
 * The tables whose sessions are kept for review: the core game, and only the
 * core game.
 *
 * **A list of ids rather than a shape test**, because the question "which
 * tables" is a product decision and a shape test would answer it by accident.
 * A Deep Stack room and a ladder rung are the same shape; one is reviewed and
 * one is not, and there is nowhere else that difference could be written down.
 *
 * The four it names are the four rule 1 protects — the ladder, the Rail, the
 * Daily and the freeroll — plus the requirement that the table deals Hold'em.
 * The review's arithmetic is `lib/coach.ts`'s, which prices a call against
 * two-card equity, so Omaha, Short Deck, Hi-Lo and Draw are excluded until
 * somebody writes the maths rather than being quietly graded by the wrong one.
 *
 * Side tables, Deep Stack, the challenge tables and anything built in the
 * builder are out by omission, which is the answer Will gave: the review is for
 * the game you actually climb.
 */
const REVIEWED_VENUE_IDS: ReadonlySet<string> = new Set(
  [...VENUES, ...RING_TABLES, THE_DAILY, KITCHEN_TABLE].map((v) => v.id),
)

/** Is this a table whose session the review keeps? */
export function reviewableVenue(venue: Venue): boolean {
  if (venue.variant && venue.variant !== 'holdem') return false
  return REVIEWED_VENUE_IDS.has(venue.id)
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
