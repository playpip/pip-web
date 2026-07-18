// The Chip Shop — where the Roll buys style, and only ever style. The rule
// that governs everything here (docs/shop.md): the shop sells STYLE AND STORY,
// NEVER EDGE. No odds, no information, no insurance, no re-buys — and award
// chips are never for sale. Spending trades progression for taste; that trade
// is the point.

import type { AwardDef } from '@/lib/awards'
import { SHOP_BACKS, type CardBackDesign } from './cardBacks'
import { KITCHEN_TABLE, SIDE_TABLES, VENUES } from './venues'

export type ShopItemKind = 'back' | 'face' | 'finish' | 'souvenir'

export interface ShopItem {
  id: string
  kind: ShopItemKind
  name: string
  /** One dry line under the name. */
  blurb: string
  price: number
  /** Winning this venue unlocks the right to buy (souvenirs, hybrid backs). */
  requiresVenueWin?: string
  /** Display accent (finishes, souvenirs). */
  swatch?: string
  /** Souvenirs render as chips (AwardChip) — the motif stamped in the centre. */
  glyph?: string
}

// --- deck faces ----------------------------------------------------------------

export const DECK_FACES: readonly ShopItem[] = [
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
] as const

// --- table finishes --------------------------------------------------------------

export interface TableFinish extends ShopItem {
  swatch: string
}

export const TABLE_FINISHES: readonly TableFinish[] = [
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
  ocean: 'The deep end, gently.',
  rose: 'A soft touch at the table.',
  slate: 'Cool, grey, all business.',
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
  swatch: design.color,
})

export const SHOP_ITEMS: readonly ShopItem[] = [
  ...SHOP_BACKS.map(backItem),
  ...DECK_FACES,
  ...TABLE_FINISHES,
  ...SOUVENIRS,
]
