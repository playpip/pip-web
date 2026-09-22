// The Chip Shop — where the Roll buys style, and only ever style. The rule
// that governs everything here (docs/shop.md): the shop sells STYLE AND STORY,
// NEVER EDGE. No odds, no information, no insurance, no re-buys — and award
// chips are never for sale. Spending trades progression for taste; that trade
// is the point.

import type { AwardDef } from '@/lib/awards'
import { AVATAR_RINGS, DEALER_BUTTONS, SOUND_PACKS, type Cosmetic } from './cosmetics'
import { MEMBER_BACKS, MEMBER_SHOP_BACKS, SHOP_BACKS, type CardBackDesign } from './cardBacks'
import { KITCHEN_TABLE, SIDE_TABLES, VENUES } from './venues'

export type ShopItemKind = 'back' | 'face' | 'finish' | 'souvenir' | 'ring' | 'button' | 'sound'

export interface ShopItem {
  id: string
  kind: ShopItemKind
  name: string
  /** One dry line under the name. */
  blurb: string
  /**
   * Chips. **Zero is a real price here**, and it was not before: the shelves
   * now carry free stock — the Hairline ring, the Hush pack, the Big Index
   * deck, the Baize finish — so that the new categories are not four more
   * things a free player can only look at. A zero-priced row shows "Use", never
   * a disabled Buy.
   */
  price: number
  /** Winning this venue unlocks the right to buy (souvenirs, hybrid backs). */
  requiresVenueWin?: string
  /**
   * The member shelf. With a `price`, the membership opens the right to buy and
   * chips still buy it; without one, it simply comes with the membership. See
   * the table on `Cosmetic` in config/cosmetics.ts — that is the whole economy.
   */
  membersOnly?: boolean
  /** Display accent (finishes, souvenirs). */
  swatch?: string
  /** Souvenirs render as chips (AwardChip) — the motif stamped in the centre. */
  glyph?: string
}

// --- deck faces ----------------------------------------------------------------

export const DECK_FACES: readonly ShopItem[] = [
  {
    // **Free, and it has to be.** A bigger rank is the change somebody makes
    // because they cannot comfortably read the small one, and a readability
    // option behind a price is a toll on the players least able to skip it.
    // The same argument the Hush sound pack makes (config/cosmetics.ts), and
    // the reason neither of them is ever given a price "later".
    id: 'face-bigindex',
    kind: 'face',
    name: 'Big Index Deck',
    blurb: 'A larger rank in the corner. Free, and always will be.',
    price: 0,
  },
  {
    id: 'face-contrast',
    kind: 'face',
    name: 'High-Contrast Deck',
    blurb: 'Ink like it means it.',
    price: 3_000,
  },
  {
    id: 'face-fourcolor',
    kind: 'face',
    name: 'Four-Colour Deck',
    blurb: 'Diamonds blue, clubs green. Misread nothing.',
    price: 5_000,
  },
  {
    id: 'face-minimal',
    kind: 'face',
    name: 'Minimal Deck',
    blurb: 'Light type, small suit, nothing shouting. Comes with the membership.',
    price: 0,
    membersOnly: true,
  },
] as const

// --- table finishes --------------------------------------------------------------

export interface TableFinish extends ShopItem {
  swatch: string
}

export const TABLE_FINISHES: readonly TableFinish[] = [
  {
    // The one everybody pictures when you say "card table", given away so that
    // the plain felt is a choice rather than the only thing a free player has.
    id: 'finish-baize',
    kind: 'finish',
    name: 'Baize',
    blurb: 'The green you were already imagining. Free.',
    price: 0,
    swatch: '#2F6B4F',
  },
  {
    id: 'finish-slate',
    kind: 'finish',
    name: 'Slate',
    blurb: 'Cool, grey, all business.',
    price: 2_500,
    swatch: '#5C6672',
  },
  {
    id: 'finish-walnut',
    kind: 'finish',
    name: 'Walnut',
    blurb: 'The warm one. Someone’s study, somewhere.',
    price: 7_500,
    swatch: '#6B4A36',
  },
  {
    id: 'finish-midnight',
    kind: 'finish',
    name: 'Midnight',
    blurb: 'For all-nighters that stay classy.',
    price: 15_000,
    swatch: '#232936',
  },
  {
    id: 'finish-forest',
    kind: 'finish',
    name: 'Forest',
    blurb: 'A card room in the trees.',
    price: 25_000,
    swatch: '#33584A',
  },
  {
    id: 'finish-oxblood',
    kind: 'finish',
    name: 'Oxblood',
    blurb: 'Old leather, older money.',
    price: 50_000,
    swatch: '#5E3138',
  },
  {
    id: 'finish-smoke',
    kind: 'finish',
    name: 'Smoke',
    blurb: 'Grey with something violet in it. Comes with the membership.',
    price: 0,
    membersOnly: true,
    swatch: '#5A5566',
  },
  {
    id: 'finish-marble',
    kind: 'finish',
    name: 'Marble',
    blurb: 'Cold, pale and wildly impractical to play cards on.',
    price: 120_000,
    membersOnly: true,
    swatch: '#8E9AA6',
  },
] as const

export function tableFinishById(id: string | null): TableFinish | undefined {
  return TABLE_FINISHES.find((f) => f.id === id)
}

// --- souvenirs --------------------------------------------------------------------
// Win a venue and its souvenir appears in the shop; chips buy it; it sits on
// the shelf in your profile. Earned unlocks the item, bought completes it.
// Every table has one — including the side tables and the Kitchen Table
// (winning the freeroll deserves a memento more than most wins do).

const SOUVENIR_NAMES: Record<string, { name: string; blurb: string; glyph: string }> = {
  garage: { name: 'The Spare Key', blurb: 'Gus says you’ve earned a copy.', glyph: 'KEY' },
  pub: { name: 'A Beermat', blurb: 'Slightly damp. Deeply sentimental.', glyph: 'ALE' },
  poolhall: {
    name: 'The Cue Ball',
    blurb: 'Sofia never missed with it. You did once.',
    glyph: '○',
  },
  cardroom: { name: 'A Dealer Button', blurb: 'Position, to go.', glyph: 'D' },
  casino: { name: 'A Casino Die', blurb: 'Rolled once, framed forever.', glyph: '⚄' },
  riverboat: { name: 'The Brass Bell', blurb: 'Rings like the river provides.', glyph: '☸' },
  penthouse: { name: 'A Skyline Postcard', blurb: 'Wish you were still up here.', glyph: '✉' },
  montecarlo: { name: 'A Marble Chip', blurb: 'Cool to the touch, comme il faut.', glyph: '●' },
  vegas: { name: 'A Marquee Bulb', blurb: 'Still warm from the sign.', glyph: '✶' },
  mainevent: { name: 'The Bracelet', blurb: 'The one Kenji doesn’t have.', glyph: '◎' },
  redeye: { name: 'A Boarding Pass', blurb: 'Window seat. No sleep.', glyph: '✈' },
  study: { name: 'The Bookmark', blurb: 'Page three hundred. Patience.', glyph: '§' },
  duel: { name: 'A Thrown Glove', blurb: 'Picked up, kept.', glyph: '⚔' },
  docks: { name: 'A Cargo Hook', blurb: 'Jun’s spare. Don’t ask.', glyph: '⚓' },
  allnighter: {
    name: 'An Empty Thermos',
    blurb: 'Astrid wants it back. She won’t get it.',
    glyph: '3AM',
  },
  chopshop: { name: 'A Kitchen Timer', blurb: 'Elaine’s. It still dings.', glyph: '✂' },
  vault: { name: 'The Cracked Lock', blurb: 'Sable almost smiled.', glyph: '×2' },
  kitchen: { name: 'A Tea Towel', blurb: 'Uncle Ray insisted.', glyph: 'TEA' },
}

const venueSouvenir = (venue: { id: string; buyIn: number; accent: string }): ShopItem => ({
  id: `souvenir-${venue.id}`,
  kind: 'souvenir' as const,
  name: SOUVENIR_NAMES[venue.id]?.name ?? venue.id,
  blurb: SOUVENIR_NAMES[venue.id]?.blurb ?? '',
  // Half the buy-in, floored so the freeroll's tea towel still costs something.
  price: Math.max(25, Math.round(venue.buyIn / 2)),
  requiresVenueWin: venue.id,
  swatch: venue.accent,
  glyph: SOUVENIR_NAMES[venue.id]?.glyph ?? '·',
})

export const SOUVENIRS: readonly ShopItem[] = [
  ...[...VENUES, ...SIDE_TABLES, KITCHEN_TABLE].map(venueSouvenir),
  // The one absurdity on the souvenir shelf — no win required, just means.
  {
    id: 'souvenir-goldenpip',
    kind: 'souvenir',
    name: 'The Golden Pip',
    blurb: 'It’s a pip. It’s gold. It does nothing at all.',
    price: 5_000_000,
    swatch: '#CDAA3D',
    glyph: '♦',
  },
]

/**
 * Souvenirs wear the award-chip template (docs/awards.md's "one chip, many
 * faces") — bought chips on the same shelf as the earned ones, visually
 * distinct only by their venue accents and motifs.
 */
export function souvenirAward(item: ShopItem): AwardDef {
  const venue = item.requiresVenueWin
    ? [...VENUES, ...SIDE_TABLES, KITCHEN_TABLE].find((v) => v.id === item.requiresVenueWin)
    : undefined
  return {
    id: item.id,
    kind: 'moment',
    name: item.name,
    how: venue
      ? `Win ${venue.name}, then buy it at the Chip Shop`
      : 'Sold at the Chip Shop. No win required — just means',
    color: item.swatch ?? '#CDAA3D',
    glyph: item.glyph ?? '·',
  }
}

// --- shop backs (from the card-back set) --------------------------------------------

const BACK_BLURBS: Record<string, string> = {
  // The four that come with the membership. They are not *sold*, but they are
  // listed: every other category shows its included item on the members' shelf
  // reading "With the membership", and four card backs missing from that shelf
  // made the membership look smaller than it is (Will, 2026-09-22).
  'back-lockin': 'The door is shut and nobody is going home.',
  'back-backroom': 'Quieter than the room you came from.',
  'back-rematch': 'One more, then bed. Allegedly.',
  'back-lastorders': 'The bell went twenty minutes ago.',
  'back-oyster': 'Pale grey, faintly iridescent.',
  'back-cask': 'Stored somewhere dark for a long time.',
  'back-eclipse': 'Rings round a hole. The expensive one.',
  ocean: 'The deep end, gently.',
  rose: 'A soft touch at the table.',
  slate: 'Cool, grey, all business.',
  lilac: 'Quiet, and in no hurry.',
  midnight: 'Lights low, focus high.',
  'back-penny': 'Everyone’s first splurge.',
  'back-powder': 'Soft as a fold.',
  'back-noir': 'Black on black. Says nothing, loudly.',
  'back-racing': 'Goes faster. (It doesn’t.)',
  'back-goldleaf': 'Won on the river, gilded on land.',
  'back-millionaire': 'Costs a million. Does nothing else.',
}

const backItem = (design: CardBackDesign): ShopItem => ({
  id: design.id,
  kind: 'back',
  name: design.name,
  blurb: BACK_BLURBS[design.id] ?? '',
  price: design.unlock?.price ?? 0,
  requiresVenueWin: design.unlock?.venueWin,
  membersOnly: design.unlock?.membersOnly,
  swatch: design.color,
})

// --- rings, buttons and packs ------------------------------------------------
//
// The three categories added on 2026-09-21 live in config/cosmetics.ts as their
// own registries and become shop rows here. The registry is the source of truth
// and this is a projection of it: a ring's price is written once, next to the
// ring, and the shop reads it. The alternative — a second list of the same
// items with their own prices — is the failure docs/membership.md already
// names about the price living in four files.

const cosmeticItem =
  (kind: ShopItemKind) =>
  (item: Cosmetic): ShopItem => ({
    id: item.id,
    kind,
    name: item.name,
    blurb: item.blurb,
    price: item.price,
    membersOnly: item.membersOnly,
  })

export const SHOP_ITEMS: readonly ShopItem[] = [
  ...SHOP_BACKS.map(backItem),
  // Included first, then the ones with a price: the members' shelf reads
  // "here is what comes with it" before "here is what it lets you buy", which
  // is the order somebody weighing the membership wants them in.
  ...MEMBER_BACKS.map(backItem),
  ...MEMBER_SHOP_BACKS.map(backItem),
  ...DECK_FACES,
  ...TABLE_FINISHES,
  ...AVATAR_RINGS.map(cosmeticItem('ring')),
  ...DEALER_BUTTONS.map(cosmeticItem('button')),
  ...SOUND_PACKS.map(cosmeticItem('sound')),
  ...SOUVENIRS,
]
