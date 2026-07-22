// Card backs — a curated set of designs rather than free-form colour × pattern.
// Each is a deliberate pairing of a muted tone and a fine pattern, so every
// choice looks considered (iOS-grade restraint). The profile persists a design
// id; components look the design up with `cardBackById`.

export type CardPattern =
  | 'solid'
  | 'pinstripe'
  | 'crosshatch'
  | 'waves'
  | 'rings'
  | 'pips'
  | 'checker'
  | 'diamonds'
  | 'dots'

export interface CardBackDesign {
  id: string
  name: string
  color: string
  pattern: CardPattern
  /** Pattern + keyline ink. Light backs need dark ink. Defaults to 'light'. */
  ink?: 'light' | 'dark'
  /**
   * How a non-free back is unlocked. `venueWin` alone → earned free by winning
   * that venue. `price` alone → bought in the Chip Shop. Both → the win unlocks
   * the *right to buy*. Style, never edge (docs/shop.md).
   */
  unlock?: { venueWin?: string; price?: number }
}

// Slimmed to five (2026-07-18): the free set is a tight, distinct starter spread
// — one warm, one cool, one green, one tan, one light — with no two designs in
// the same family. The muted blues and greys (midnight, slate, ocean) moved to
// the Chip Shop's low tier: they read too close to the paid backs to give away,
// and a beginner needs something cheap to want. Removed ids fall back to the
// default. (Earlier cuts: graphite ≈ slate, sage ≈ ivy, rose, the old gold.)
export const CARD_BACKS: readonly CardBackDesign[] = [
  { id: 'pip', name: 'Pip', color: '#7E89D0', pattern: 'pips' },
  { id: 'ivy', name: 'Ivy', color: '#5F8A72', pattern: 'pinstripe' },
  { id: 'burgundy', name: 'Burgundy', color: '#82505A', pattern: 'diamonds' },
  { id: 'sand', name: 'Sand', color: '#C7B292', pattern: 'checker', ink: 'dark' },
  { id: 'cream', name: 'Cream', color: '#E7DFCE', pattern: 'pips', ink: 'dark' },
] as const

export const DEFAULT_CARD_BACK: CardBackDesign = CARD_BACKS[0]

// Earned backs — winning a ladder venue for the first time unlocks its back,
// free: the venue's accent in a fine pattern, a trophy you can play with.
// (See docs/shop.md; availability is derived from venueRecords, no new state.)
export const EARNED_BACKS: readonly CardBackDesign[] = [
  {
    id: 'back-garage',
    name: "Friends' Garage",
    color: '#7C8CF0',
    pattern: 'checker',
    unlock: { venueWin: 'garage' },
  },
  {
    id: 'back-pub',
    name: 'The Pub',
    color: '#5AA9E6',
    pattern: 'rings',
    unlock: { venueWin: 'pub' },
  },
  {
    id: 'back-poolhall',
    name: 'The Pool Hall',
    color: '#4FB477',
    pattern: 'dots',
    unlock: { venueWin: 'poolhall' },
  },
  {
    id: 'back-cardroom',
    name: 'The Card Room',
    color: '#E0A458',
    pattern: 'pips',
    unlock: { venueWin: 'cardroom' },
  },
  {
    id: 'back-casino',
    name: 'Downtown Casino',
    color: '#D9534F',
    pattern: 'diamonds',
    unlock: { venueWin: 'casino' },
  },
  {
    id: 'back-riverboat',
    name: 'The Riverboat',
    color: '#17A2B8',
    pattern: 'waves',
    unlock: { venueWin: 'riverboat' },
  },
  {
    id: 'back-penthouse',
    name: 'The Penthouse',
    color: '#C049D4',
    pattern: 'pinstripe',
    unlock: { venueWin: 'penthouse' },
  },
  {
    id: 'back-montecarlo',
    name: 'Monte Carlo',
    color: '#E8B923',
    pattern: 'crosshatch',
    unlock: { venueWin: 'montecarlo' },
  },
  {
    id: 'back-vegas',
    name: 'Vegas Championship',
    color: '#FF7A45',
    pattern: 'rings',
    unlock: { venueWin: 'vegas' },
  },
  {
    id: 'back-mainevent',
    name: 'The Main Event',
    color: '#F0574E',
    pattern: 'pips',
    unlock: { venueWin: 'mainevent' },
  },
] as const

// Shop backs — bought with the Roll (style costs progression, and that trade
// is the point). The low tier (under a Garage buy-in of chips) exists so a
// beginner has something to want within a win or two — the muted cool designs
// pulled from the free set live here. Gold Leaf is the hybrid: win the Riverboat
// to earn the right to buy it. The Millionaire is the prestige absurdity — the
// price IS the trophy. Ordered cheapest-first, the way the shop lists them.
export const SHOP_BACKS: readonly CardBackDesign[] = [
  {
    id: 'ocean',
    name: 'Ocean',
    color: '#57779B',
    pattern: 'waves',
    unlock: { price: 250 },
  },
  {
    id: 'rose',
    name: 'Rosé',
    color: '#C27B93',
    pattern: 'dots',
    unlock: { price: 400 },
  },
  {
    id: 'slate',
    name: 'Slate',
    color: '#5C6672',
    pattern: 'crosshatch',
    unlock: { price: 500 },
  },
  // New Lilac back
  {
  id: 'back-lilac',
  name: 'Lilac',
  color: '#B9B2C8',
  pattern: 'rings',
  ink: 'dark',
  unlock: { price: 600 },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    color: '#232936',
    pattern: 'pinstripe',
    unlock: { price: 750 },
  },
  {
    id: 'back-penny',
    name: 'Penny',
    color: '#8A5A44',
    pattern: 'dots',
    unlock: { price: 1_000 },
  },
  {
    id: 'back-powder',
    name: 'Powder',
    color: '#9FB6CD',
    pattern: 'waves',
    ink: 'dark',
    unlock: { price: 5_000 },
  },
  { id: 'back-noir', name: 'Noir', color: '#17171C', pattern: 'solid', unlock: { price: 10_000 } },
  {
    id: 'back-racing',
    name: 'Racing Green',
    color: '#3F6B52',
    pattern: 'pinstripe',
    unlock: { price: 25_000 },
  },
  {
    id: 'back-goldleaf',
    name: 'Gold Leaf',
    color: '#9A7B2D',
    pattern: 'diamonds',
    unlock: { venueWin: 'riverboat', price: 50_000 },
  },
  {
    id: 'back-millionaire',
    name: 'The Millionaire',
    color: '#CDAA3D',
    pattern: 'pips',
    unlock: { price: 1_000_000 },
  },
] as const

export const ALL_CARD_BACKS: readonly CardBackDesign[] = [
  ...CARD_BACKS,
  ...EARNED_BACKS,
  ...SHOP_BACKS,
]

const byId = new Map(ALL_CARD_BACKS.map((d) => [d.id, d]))

/** Look up a design by persisted id — unknown ids fall back to the default. */
export function cardBackById(id: string): CardBackDesign {
  return byId.get(id) ?? DEFAULT_CARD_BACK
}

/**
 * Is this design usable? Free designs always; earned ones once the venue is
 * won; priced ones once bought (a hybrid's venue win only gates the *purchase*).
 */
export function cardBackUnlocked(
  design: CardBackDesign,
  wonVenues: ReadonlySet<string>,
  owned: ReadonlySet<string>,
): boolean {
  if (!design.unlock) return true
  if (design.unlock.price !== undefined) return owned.has(design.id)
  return design.unlock.venueWin !== undefined && wonVenues.has(design.unlock.venueWin)
}

/**
 * The closest curated design to an arbitrary colour (RGB distance) — used to
 * migrate profiles from the old free-form colour × pattern picker.
 */
export function nearestCardBack(color: string | undefined): CardBackDesign {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return DEFAULT_CARD_BACK
  const rgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
  const [r, g, b] = rgb(color)
  let best = DEFAULT_CARD_BACK
  let bestDist = Infinity
  for (const design of CARD_BACKS) {
    const [dr, dg, db] = rgb(design.color)
    const dist = (r - dr) ** 2 + (g - dg) ** 2 + (b - db) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = design
    }
  }
  return best
}
