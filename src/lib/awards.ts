// Collectible "special chips" — awards earned when something worth remembering
// happens (see docs/awards.md). Pure: definitions + detection only. The game
// store decides when to run detection and the profile store persists what's
// been earned; nothing here touches React or storage.

import { VENUES, type Venue } from '@/config/venues'
import { RANKS } from '@/config/ranks'
import type { Card } from '@/lib/poker/cards'

export type AwardKind = 'venue' | 'hand' | 'moment' | 'journey'

export interface AwardDef {
  id: string
  kind: AwardKind
  name: string
  /** How it's earned — shown on the shelf. */
  how: string
  /** Chip disc colour. */
  color: string
  /** Short motif stamped in the chip's centre. */
  glyph: string
}

const PIP = '#7c8cf0'
const SUIT_RED = '#f0574e'
const GOLD = '#e8b923'
const AMBER = '#e0a458'

/** Venue chips — earned by *winning* the venue, not entering it. */
const venueChips: AwardDef[] = VENUES.map((v, i) => ({
  id: `venue-${v.id}`,
  kind: 'venue',
  name: v.name,
  how: `Win ${v.name}`,
  color: v.accent,
  glyph: String(i + 1),
}))

/** Hand chips — first time the hand *wins a showdown* (a real moment, not a folded-out technicality). */
const handChips: AwardDef[] = [
  { id: 'hand-straight', kind: 'hand', name: 'Straight', how: 'Win a showdown with a straight', color: SUIT_RED, glyph: 'ST' },
  { id: 'hand-flush', kind: 'hand', name: 'Flush', how: 'Win a showdown with a flush', color: SUIT_RED, glyph: 'FL' },
  { id: 'hand-fullhouse', kind: 'hand', name: 'Full House', how: 'Win a showdown with a full house', color: SUIT_RED, glyph: 'FH' },
  { id: 'hand-quads', kind: 'hand', name: 'Quads', how: 'Win a showdown with four of a kind', color: SUIT_RED, glyph: '4K' },
  { id: 'hand-straightflush', kind: 'hand', name: 'Straight Flush', how: 'Win a showdown with a straight flush', color: SUIT_RED, glyph: 'SF' },
  { id: 'hand-royal', kind: 'hand', name: 'The Royal', how: 'Win a showdown with a royal flush', color: GOLD, glyph: 'RF' },
  { id: 'hand-wheel', kind: 'hand', name: 'The Wheel', how: 'Win a showdown with the A-2-3-4-5 straight', color: SUIT_RED, glyph: 'A5' },
]

/** Moment chips — plays that make a story. */
const momentChips: AwardDef[] = [
  { id: 'moment-sevendeuce', kind: 'moment', name: 'The Seven Deuce', how: 'Win a pot holding 7-2', color: AMBER, glyph: '72' },
  { id: 'moment-knockout', kind: 'moment', name: 'The Bouncer', how: 'Take every chip in a hand that busts an opponent', color: AMBER, glyph: 'KO' },
  { id: 'moment-comeback', kind: 'moment', name: 'The Comeback', how: 'Win a venue after falling to a tenth of your starting stack', color: AMBER, glyph: '10%' },
]

const rankMin = (name: string) => RANKS.find((r) => r.name === name)!.min

/** Journey chips — the story of the grind. */
const journeyChips: AwardDef[] = [
  { id: 'journey-first', kind: 'journey', name: 'First Pot', how: 'Win your first pot', color: PIP, glyph: '★' },
  {
    id: 'journey-kitchen',
    kind: 'journey',
    name: 'Back From Broke',
    how: 'Win the Kitchen Table freeroll, then win a ladder venue before going broke again',
    color: PIP,
    glyph: '↺',
  },
  { id: 'journey-regular', kind: 'journey', name: 'Regular', how: 'Reach the Regular rank', color: PIP, glyph: '1K' },
  { id: 'journey-shark', kind: 'journey', name: 'Shark', how: 'Reach the Shark rank', color: PIP, glyph: '10K' },
  { id: 'journey-pro', kind: 'journey', name: 'Pro', how: 'Reach the Pro rank', color: PIP, glyph: '.1M' },
  { id: 'journey-legend', kind: 'journey', name: 'Legend', how: 'Reach the Legend rank', color: PIP, glyph: '1M' },
]

export const AWARDS: readonly AwardDef[] = [...venueChips, ...handChips, ...momentChips, ...journeyChips]

const byId = new Map(AWARDS.map((a) => [a.id, a]))
export const awardById = (id: string): AwardDef | undefined => byId.get(id)

/** Everything detection needs to know about a just-finished hand. */
export interface AwardContext {
  venue: Venue
  /** Hero won at least one pot this hand. */
  heroWon: boolean
  /** The hand went to showdown. */
  showdown: boolean
  /** Hero's evaluated hand at showdown (engine `result.evaluations`). */
  heroHand?: { name: string; description: string }
  /** Hero's hole cards this hand. */
  heroHole?: readonly Card[]
  /** Hero took every pot in a hand where an opponent was eliminated. */
  knockedOut: boolean
  /** Hero's lowest between-hands stack this tournament. */
  lowestStack: number
  /** The tournament's starting stack. */
  startingStack: number
  /** Hero just won the whole tournament. */
  tournamentWon: boolean
  /** The comeback flag: the player's current run started at the Kitchen Table. */
  cameFromFreeroll: boolean
  /** Peak Roll AFTER any prize was added. */
  peakRoll: number
}

const isSevenDeuce = (hole?: readonly Card[]): boolean =>
  hole?.length === 2 && new Set(hole.map((c) => c.rank)).size === 2 && hole.every((c) => c.rank === '7' || c.rank === '2')

/** Newly earned chips for a finished hand — never re-grants anything in `owned`. */
export function detectAwards(ctx: AwardContext, owned: Record<string, number>): AwardDef[] {
  const earned: AwardDef[] = []
  const add = (id: string) => {
    if (owned[id] === undefined && !earned.some((a) => a.id === id)) {
      const def = byId.get(id)
      if (def) earned.push(def)
    }
  }

  // Hand chips certify a showdown win with the hand itself.
  if (ctx.heroWon && ctx.showdown && ctx.heroHand) {
    const { name, description } = ctx.heroHand
    if (name === 'Straight') add('hand-straight')
    if (name === 'Flush') add('hand-flush')
    if (name === 'Full House') add('hand-fullhouse')
    if (name === 'Four of a Kind') add('hand-quads')
    if (name === 'Straight Flush') add('hand-straightflush')
    if (description === 'Royal Flush') add('hand-royal') // a royal also earns the straight-flush chip
    if (name === 'Straight' && description === 'Straight, 5 High') add('hand-wheel')
  }

  // Moment chips.
  if (ctx.heroWon && isSevenDeuce(ctx.heroHole)) add('moment-sevendeuce')
  if (ctx.knockedOut) add('moment-knockout')
  if (ctx.tournamentWon && ctx.venue.freeroll !== true && ctx.lowestStack <= ctx.startingStack / 10) {
    add('moment-comeback')
  }

  // Venue + comeback chips fire on taking the table down (ladder venues only).
  if (ctx.tournamentWon && ctx.venue.freeroll !== true) {
    add(`venue-${ctx.venue.id}`)
    if (ctx.cameFromFreeroll) add('journey-kitchen')
  }

  // The journey: first pot, then rank chips from the (already updated) peak Roll.
  if (ctx.heroWon) add('journey-first')
  if (ctx.peakRoll >= rankMin('Regular')) add('journey-regular')
  if (ctx.peakRoll >= rankMin('Shark')) add('journey-shark')
  if (ctx.peakRoll >= rankMin('Pro')) add('journey-pro')
  if (ctx.peakRoll >= rankMin('Legend')) add('journey-legend')

  return earned
}
