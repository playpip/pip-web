// The cosmetics that are not card backs — avatar rings, dealer buttons and
// sound packs — and the one gate all four categories answer to.
//
// **Why one file and one predicate.** Card backs, deck faces and table finishes
// each grew their own "is this unlocked" arithmetic inline, in three components,
// and they agreed by luck. Three categories arriving at once is the moment that
// stops being tolerable: `cosmeticUnlocked` is the only answer, the shop and the
// Style picker both read it, and a new category is a registry plus nothing.
//
// **Style and story, never edge** (docs/shop.md rule 1). Nothing here is allowed
// to touch odds, information or a hand. A ring is a ring; the loudest thing in
// this file is a sound pack, and the most it can do is make the same twelve
// cues warmer.

import type { MembersOnly } from '@/config/membership'

/**
 * One cosmetic, in any of the four states a thing can be in.
 *
 * The two fields are orthogonal on purpose, and the four combinations are the
 * whole economy — there is no fifth shape and adding one needs a rule change,
 * not a config edit:
 *
 * | `price` | `membersOnly` | what it is                                        |
 * |---------|---------------|---------------------------------------------------|
 * | `0`     | absent        | free to everybody, forever                        |
 * | `> 0`   | absent        | Chip Shop stock — chips you won buy it            |
 * | `0`     | `true`        | comes with the membership; locks again if it lapses |
 * | `> 0`   | `true`        | the member shelf — the membership opens the right to buy, chips still buy it, and it is yours for good once bought |
 *
 * The fourth row is the one that needed a ruling (Will, 2026-09-21) and it is
 * written up in docs/shop.md. The short version: membership gating the *right
 * to buy* is the pattern Gold Leaf has shipped with since v1 — win the
 * Riverboat, then pay 50,000 — with a membership in the place of the win. No
 * price on any shelf is payable in cash, which is the promise rule 3 was
 * actually making, and it is untouched.
 */
export interface Cosmetic extends MembersOnly {
  id: string
  /** The name a player would use for it. */
  name: string
  /** One dry line. What it is, not why you should want it. */
  blurb: string
  /** Chips. Zero means the price is not the gate — `membersOnly` is, or nothing is. */
  price: number
}

/**
 * Can this player wear it?
 *
 * **A bought thing is bought**, which is why `price` is asked about first. A
 * member who let their membership lapse keeps every item they spent chips on,
 * member shelf or not: they paid in the currency that cannot be bought with
 * money and taking it back would be the exact move this app is positioned
 * against. What lapsing does take away is what was *included* — priceless
 * things, in the literal sense — and that is the trade a membership is.
 */
export function cosmeticUnlocked(
  item: Cosmetic,
  owned: ReadonlySet<string>,
  member: boolean,
): boolean {
  if (item.price > 0) return owned.has(item.id)
  return item.membersOnly ? member : true
}

/**
 * Is the Buy button live?
 *
 * Separate from `cosmeticUnlocked` because the member shelf is the one place
 * where "you cannot use this" and "you cannot buy this" have different reasons,
 * and a single boolean would have to pick one to tell the player. It refuses
 * for the membership before it refuses for money, the same order `lib/sitDown`
 * refuses in and for the same reason: "you cannot afford it" told to somebody
 * whose Roll is fine is a lie they can act on.
 */
export function cosmeticPurchasable(
  item: Cosmetic,
  owned: ReadonlySet<string>,
  member: boolean,
): boolean {
  if (item.price <= 0 || owned.has(item.id)) return false
  return !item.membersOnly || member
}

// --- avatar rings -----------------------------------------------------------
//
// A ring drawn round your own avatar at the table and on your profile. Yours
// only: the cast wear their own faces and nobody else's seat changes, so this
// is a thing you see rather than a thing you show, which is the only kind of
// flair a single-player game can honestly sell.

export interface AvatarRing extends Cosmetic {
  /**
   * The ring itself, as any CSS `background` value.
   *
   * A string rather than a colour plus a set of flags (`dashed`, `metal`,
   * `gradient`) because every one of those flags would be a branch in the
   * component and a new ring would need both files changed. A flat colour for
   * the plain ones, a repeating gradient for rope, a conic sweep for the two
   * metals — because a gradient is what makes metal read as metal — and the
   * component just paints what it is handed.
   */
  ring: string
}

export const AVATAR_RINGS: readonly AvatarRing[] = [
  {
    id: 'ring-hairline',
    name: 'Hairline',
    blurb: 'A thin line, and nothing else. Free, and the one most people keep.',
    price: 0,
    ring: 'rgba(120,120,130,0.55)',
  },
  {
    id: 'ring-brass',
    name: 'Brass',
    blurb: 'The fittings on a good table.',
    price: 1_500,
    ring: '#B08D57',
  },
  {
    id: 'ring-enamel',
    name: 'Enamel',
    blurb: 'A single colour, baked on.',
    price: 4_000,
    ring: '#3F7FA8',
  },
  {
    id: 'ring-rope',
    name: 'Rope',
    blurb: 'Twisted, in the nautical sense.',
    price: 12_000,
    ring: 'repeating-conic-gradient(#C9873D 0deg 9deg, #8E5C25 9deg 18deg)',
  },
  {
    id: 'ring-ivory',
    name: 'Ivory',
    blurb: 'Pale, warm, and nobody asks where it came from.',
    price: 30_000,
    ring: '#E8DFC8',
  },
  {
    id: 'ring-gilt',
    name: 'Gilt',
    blurb: 'Gold leaf, laid thin. Comes with the membership.',
    price: 0,
    membersOnly: true,
    ring: 'conic-gradient(from 210deg, #8A6A22, #E4C76B 25%, #F6EAB4 40%, #C8A33F 62%, #8A6A22)',
  },
  {
    id: 'ring-mop',
    name: 'Mother-of-Pearl',
    blurb: 'Pearl’s own, and she charges for it.',
    price: 100_000,
    membersOnly: true,
    ring: 'conic-gradient(from 40deg, #BFD8E8, #EBD9EC 22%, #CFE9D9 45%, #F2E6C8 68%, #C9D6EE 85%, #BFD8E8)',
  },
]

// --- dealer buttons ---------------------------------------------------------
//
// The disc that moves one seat every hand. It is four millimetres of screen and
// you look at it constantly, which is the whole argument for it being buyable:
// nothing about the hand changes and the table still feels like yours.

export interface DealerButton extends Cosmetic {
  /** Disc colour. */
  face: string
  /** The letter's colour. Light discs need dark ink. */
  ink: string
  /** The disc's edge, where it wants one. */
  edge?: string
}

export const DEALER_BUTTONS: readonly DealerButton[] = [
  {
    id: 'button-house',
    name: 'The House',
    blurb: 'The one that was already on the table.',
    price: 0,
    face: 'var(--color-primary)',
    ink: 'var(--color-primary-foreground)',
  },
  {
    id: 'button-bone',
    name: 'Bone',
    blurb: 'Cheap, honest, faintly yellowed.',
    price: 800,
    face: '#EDE6D6',
    ink: '#3A342A',
  },
  {
    id: 'button-lacquer',
    name: 'Lacquer',
    blurb: 'Black, and deeper than it needs to be.',
    price: 3_500,
    face: '#16161B',
    ink: '#E7E2D4',
    edge: 'rgba(231,226,212,0.35)',
  },
  {
    id: 'button-perspex',
    name: 'Perspex',
    blurb: 'You can see the felt through it. That is the trick.',
    price: 9_000,
    face: 'rgba(255,255,255,0.16)',
    ink: 'var(--color-foreground)',
    edge: 'rgba(255,255,255,0.45)',
  },
  {
    id: 'button-oak',
    name: 'Oak',
    blurb: 'Turned on a lathe by somebody’s grandfather.',
    price: 20_000,
    face: '#6B4A36',
    ink: '#F0E4D4',
  },
  {
    id: 'button-engraved',
    name: 'Engraved',
    blurb: 'Brass, with initials that are not yours. Comes with the membership.',
    price: 0,
    membersOnly: true,
    face: 'linear-gradient(145deg, #C8A33F, #8A6A22 55%, #E4C76B)',
    ink: '#2A2110',
  },
  {
    id: 'button-pip',
    name: 'The Pip',
    blurb: 'Ours, in our own colour, and it cost you a fortune.',
    price: 60_000,
    membersOnly: true,
    face: 'var(--color-pip)',
    ink: 'var(--color-background)',
    edge: 'rgba(255,255,255,0.5)',
  },
]

// --- sound packs ------------------------------------------------------------
//
// **A pack is a transform, not a second cue table.** The twelve cues in
// lib/sound.ts were tuned against each other — `fold` sits under `check`, `win`
// answers `lose` — and a pack that re-authored all twelve would let one of them
// drift out of that relationship on an afternoon nobody was listening carefully.
// A pack scales pitch, length and gain across the whole set and may swap the
// oscillator, so the shape of the thing is preserved by construction and there
// is nothing to keep in sync.
//
// It also means a pack is four numbers, which is why there can be six of them.

export interface SoundPack extends Cosmetic {
  /** Multiplies every cue's frequency (and its glide target). */
  pitch: number
  /** Multiplies every cue's peak gain. */
  gain: number
  /** Multiplies every cue's duration. */
  length: number
  /** Replaces every cue's oscillator. Absent keeps each cue's own. */
  timbre?: OscillatorType
}

export const SOUND_PACKS: readonly SoundPack[] = [
  {
    id: 'sound-house',
    name: 'The House',
    blurb: 'What Pip has always sounded like.',
    price: 0,
    pitch: 1,
    gain: 1,
    length: 1,
  },
  {
    // Free on purpose. Quieter is the one thing on this shelf somebody might
    // actually need rather than want, and a volume slider you have to find in
    // settings is not the same as a table that is simply calmer.
    id: 'sound-hush',
    name: 'Hush',
    blurb: 'Everything, at half. Free, because quiet is not a luxury.',
    price: 0,
    pitch: 0.94,
    gain: 0.45,
    length: 0.9,
  },
  {
    id: 'sound-felt',
    name: 'Felt',
    blurb: 'Lower and softer, like the table absorbed it.',
    price: 3_000,
    pitch: 0.8,
    gain: 0.9,
    length: 1.15,
    timbre: 'sine',
  },
  {
    id: 'sound-brass',
    name: 'Brass',
    blurb: 'Brighter. Every chip has a little bell in it.',
    price: 15_000,
    pitch: 1.18,
    gain: 0.95,
    length: 0.95,
    timbre: 'triangle',
  },
  {
    id: 'sound-velvet',
    name: 'Velvet',
    blurb: 'Deep, slow and unhurried. Comes with the membership.',
    price: 0,
    membersOnly: true,
    pitch: 0.72,
    gain: 0.85,
    length: 1.3,
    timbre: 'sine',
  },
  {
    id: 'sound-afterhours',
    name: 'After Hours',
    blurb: 'The room, two hours after it should have closed.',
    price: 40_000,
    membersOnly: true,
    pitch: 0.6,
    gain: 0.8,
    length: 1.5,
    timbre: 'sine',
  },
]

export const DEFAULT_SOUND_PACK = SOUND_PACKS[0]

/** Every cosmetic in this file, for the shop and the tests that sweep them. */
export const ALL_COSMETICS: readonly Cosmetic[] = [
  ...AVATAR_RINGS,
  ...DEALER_BUTTONS,
  ...SOUND_PACKS,
]

/**
 * The ring a player is wearing, or undefined for a bare avatar.
 *
 * Undefined rather than a default object: "no ring" is a real choice and the
 * commonest one, and a lookup that invented a ring for it would put a hairline
 * on every avatar in the app the day this shipped.
 */
export function avatarRingById(id: string | null): AvatarRing | undefined {
  return id ? AVATAR_RINGS.find((r) => r.id === id) : undefined
}

/** The equipped dealer button — always one, falling back to the house's. */
export function dealerButtonById(id: string | null | undefined): DealerButton {
  return DEALER_BUTTONS.find((b) => b.id === id) ?? DEALER_BUTTONS[0]
}

/** The equipped sound pack — always one, falling back to the house's. */
export function soundPackById(id: string | null | undefined): SoundPack {
  return SOUND_PACKS.find((p) => p.id === id) ?? DEFAULT_SOUND_PACK
}
