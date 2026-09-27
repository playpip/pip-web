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
   * the *right to buy*. `membersOnly` alone → comes with the membership and
   * locks again if it lapses. `membersOnly` **with** a `price` → the member
   * shelf: the membership opens the right to buy, chips you won still buy it,
   * and it stays yours afterwards (docs/shop.md rule 3, rewritten 2026-09-21).
   * Style, never edge, whichever it is.
   */
  unlock?: { venueWin?: string; price?: number; membersOnly?: true }
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
    id: 'lilac',
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

// Member backs — four designs that come with the membership.
//
// **The ids are not venue ids and never were.** They were named after four
// member rooms that have since collapsed into one Deep Stack card, and the
// designs outlived the rooms because a card back is a card back. Renaming an id
// orphans a player's saved choice for nothing, so the ids stayed and the names
// were freed from the rooms.
//
// **Their own shelf, and never a Chip Shop price.** Pearl sells for chips you
// won and nothing on her shelves is ever payable in cash (docs/shop.md rule 3).
// These carry no `price` at all, which is what keeps the two economies from
// touching: there is no exchange rate between a membership and a souvenir.
//
// They sit in `ALL_CARD_BACKS` and so appear, locked, in the Style picker for
// everybody. That is the same call the member rooms make and for the same
// reason — you cannot want what you cannot see, and hiding it would make the
// strip silently rearrange itself the day somebody joins. The picker is a
// strip with no `X of N`, so nothing here enlarges a free player's denominator;
// the shelves that *do* count are in ChipsDialog and these are not on them.
export const MEMBER_BACKS: readonly CardBackDesign[] = [
  {
    id: 'back-lockin',
    name: 'Lock-In',
    color: '#B5835A',
    pattern: 'crosshatch',
    unlock: { membersOnly: true },
  },
  {
    id: 'back-backroom',
    name: 'Back Room',
    color: '#3F8F7A',
    pattern: 'diamonds',
    unlock: { membersOnly: true },
  },
  {
    id: 'back-rematch',
    name: 'Nightcap',
    color: '#7A6FD1',
    pattern: 'rings',
    unlock: { membersOnly: true },
  },
  {
    id: 'back-lastorders',
    name: 'Last Orders',
    color: '#D4614A',
    pattern: 'waves',
    unlock: { membersOnly: true },
  },
] as const

// The member shelf — backs the membership lets you *buy*, not backs it gives
// you. Chips you won still pay for them, at prices that sit above the open
// shelf because the shelf they are on is smaller.
//
// **Bought is bought, and a lapse does not take these back.** That is the whole
// difference between this list and the one above it, and it is the reason the
// two are separate arrays rather than one array with a price on some rows:
// somebody reading this file should be able to see which member cosmetics
// survive a cancelled membership without running the predicate in their head.
export const MEMBER_SHOP_BACKS: readonly CardBackDesign[] = [
  {
    id: 'back-oyster',
    name: 'Oyster',
    color: '#C9CFD4',
    pattern: 'dots',
    ink: 'dark',
    unlock: { membersOnly: true, price: 20_000 },
  },
  {
    id: 'back-cask',
    name: 'Cask',
    color: '#6A4A2F',
    pattern: 'pinstripe',
    unlock: { membersOnly: true, price: 75_000 },
  },
  {
    id: 'back-eclipse',
    name: 'Eclipse',
    color: '#1B1D2B',
    pattern: 'rings',
    unlock: { membersOnly: true, price: 250_000 },
  },
] as const

/**
 * Every design, **and this order is the order the Style picker draws them in**.
 *
 * The member backs come first (Will, 2026-09-21: "move the card backs you get
 * to the front so I can see them"). They used to be last, which meant the four
 * things a membership adds to this screen were four scroll-lengths off the
 * right-hand edge of a strip most players never scrolled — visible in the sense
 * that a thing at the bottom of a drawer is visible.
 *
 * This is a reorder inside a screen the player opened, not a prompt: nothing
 * appears over anything, nothing returns after being dismissed, and a locked
 * back still just says what it is (docs/membership.md, "what a gated surface
 * looks like"). If it ever grows a button, it has stopped being that.
 */
export const ALL_CARD_BACKS: readonly CardBackDesign[] = [
  ...MEMBER_BACKS,
  ...MEMBER_SHOP_BACKS,
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
 * won; priced ones once bought (a hybrid's venue win only gates the *purchase*);
 * member ones while the membership is live.
 *
 * `member` is last and defaults to false so that the answer for every design
 * that predates the membership is unchanged by the argument existing. A design
 * with no `unlock` is still free to everybody, which is the direction that
 * matters: the default must never be "paid".
 *
 * **An included member back locks again when a membership lapses**, and that is
 * correct rather than harsh — it is a cosmetic, the profile keeps the id, and
 * picking it up again is re-subscribing. What it must never do is take a
 * *bought* back away, which is why `price` is asked about before `membersOnly`
 * below and not after: a member-shelf design was paid for in chips that cannot
 * be bought with money, and chips do not expire.
 */
export function cardBackUnlocked(
  design: CardBackDesign,
  wonVenues: ReadonlySet<string>,
  owned: ReadonlySet<string>,
  member = false,
): boolean {
  if (!design.unlock) return true
  if (design.unlock.price !== undefined) return owned.has(design.id)
  if (design.unlock.membersOnly) return member
  return design.unlock.venueWin !== undefined && wonVenues.has(design.unlock.venueWin)
}

/**
 * Is the Buy button live on this design?
 *
 * The mirror of `cosmeticPurchasable` in config/cosmetics, kept here because a
 * card back's gate has a third door the other categories do not: Gold Leaf
 * needs a Riverboat win as well as the chips. The refusals are ordered the way
 * a person would say them — you are not a member, then you have not won it,
 * then you cannot afford it — so the first true thing is the one shown.
 */
export function cardBackPurchasable(
  design: CardBackDesign,
  wonVenues: ReadonlySet<string>,
  owned: ReadonlySet<string>,
  member = false,
): boolean {
  const unlock = design.unlock
  if (!unlock?.price || owned.has(design.id)) return false
  if (unlock.membersOnly && !member) return false
  return !unlock.venueWin || wonVenues.has(unlock.venueWin)
}

/** Does this design wear the members' foil? True for both member shelves. */
export function isMemberBack(design: CardBackDesign): boolean {
  return design.unlock?.membersOnly === true
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
