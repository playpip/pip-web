import { CAST, type Character } from '@/config/cast'
import { VENUES, type Venue } from '@/config/venues'

// Build your own table — the member feature, and the one rule that makes it
// safe to ship.
//
// **You pick the shape. You never pick the difficulty.**
//
// That is the whole design. Seats, stakes, stack depth, how fast the blinds
// climb, whether heads are worth money and who sits down are all yours. The
// opponents' skill is derived from the buy-in by the same ladder everyone
// plays, and there is deliberately no control for it anywhere in this file.
//
// Without that rule this is a chip printer: pick the Garage's opponents, pick
// the Main Event's buy-in, collect. With it, a custom table is exactly as hard
// as a ladder rung at the same price, and the only thing a player has bought is
// the *arrangement* — which is style, not edge, and is the line the whole
// product rests on (docs/brand.md principle 1).
//
// The prize is not a choice either. It is the shipped formula, read off the
// bounty tables rather than invented: every seat's buy-in, less what the
// knockouts pay out. See `tests/customTable.test.ts`.

/** Seats a custom table may have, including you. */
export const CUSTOM_SEATS = [2, 3, 4, 5, 6] as const
/**
 * Buy-ins a custom table may be built at.
 *
 * The ladder's own rungs, and that is not laziness: the buy-in is what picks
 * the opposition, so offering a price with no rung behind it would mean
 * inventing an AI profile that nothing has ever banded. Every price here maps
 * to opponents that `tests/ai.test.ts` already measures.
 */
export const CUSTOM_BUY_INS = VENUES.map((v) => v.buyIn)

/** How deep you sit, as a multiple of the buy-in. */
export const CUSTOM_DEPTHS = [1, 2, 3] as const
/** How many hands a blind level lasts. Lower is faster. */
export const CUSTOM_SPEEDS = [2, 5, 9, 14] as const

export interface CustomTableSpec {
  seats: number
  buyIn: number
  /** Starting stack as a multiple of the buy-in (1 = the ladder's own depth). */
  depth: number
  /** Hands per blind level. */
  handsPerLevel: number
  /** Chips per knockout. Funded out of the prize, never added to it. */
  bounty: number
  /**
   * Who sits down, by character id. Empty means "draw them as usual".
   *
   * Flavour only. A character contributes a tightness/aggression/bluff nudge
   * and a face; `profileFor` never lets one touch `skill` (docs/venues.md), so
   * stacking the table with the loosest regulars in the cast changes how the
   * game *feels* and not how hard it is.
   */
  castIds: readonly string[]
}

export const DEFAULT_CUSTOM: CustomTableSpec = {
  seats: 6,
  buyIn: 2_000,
  depth: 1,
  handsPerLevel: 9,
  bounty: 0,
  castIds: [],
}

/** The fixed id every custom table plays under. */
export const CUSTOM_VENUE_ID = 'custom'

/**
 * The ladder rung a buy-in buys you.
 *
 * The highest rung whose price this table meets or beats, so building at 5,000
 * seats you against the Downtown Casino's players and building at 4,999 seats
 * you against the Card Room's. Never interpolated: a blended profile is one
 * nothing has measured, and `tests/ai.test.ts` bands shipped profiles.
 */
export function rungFor(buyIn: number): Venue {
  let rung = VENUES[0]
  for (const venue of VENUES) if (buyIn >= venue.buyIn) rung = venue
  return rung
}

/** What a table of this shape pays its winner. The shipped formula, unmodified. */
export function customPrize(spec: CustomTableSpec): number {
  return spec.buyIn * spec.seats - spec.bounty * (spec.seats - 1)
}

/**
 * The largest bounty this shape can fund.
 *
 * Capped at a quarter of each seat's buy-in so that a bounty table still has a
 * prize worth playing for: uncapped, a player could set the bounty so high that
 * the winner's share went to nothing, which is not a table anyone meant to
 * build. The Docks pays 500 on a 2,000 buy-in and the Chop Shop 1,500 on 5,000,
 * so a quarter and a third — this sits at the conservative end of shipped.
 */
export function maxBounty(buyIn: number): number {
  return Math.floor(buyIn / 4)
}

/**
 * Is this a table we are willing to deal?
 *
 * Returns the reason it is refused, or null. Every field is bounded because
 * this is the one venue a player composes themselves, and a `seats: 40` typed
 * into a URL must be a refusal rather than a layout bug.
 */
export function refuseCustomTable(spec: CustomTableSpec): string | null {
  if (!CUSTOM_SEATS.includes(spec.seats as (typeof CUSTOM_SEATS)[number])) {
    return 'That is not a number of seats this table can have.'
  }
  if (!CUSTOM_BUY_INS.includes(spec.buyIn)) return 'That is not a buy-in you can build at.'
  if (!CUSTOM_DEPTHS.includes(spec.depth as (typeof CUSTOM_DEPTHS)[number])) {
    return 'That is not a stack depth you can sit with.'
  }
  if (!CUSTOM_SPEEDS.includes(spec.handsPerLevel as (typeof CUSTOM_SPEEDS)[number])) {
    return 'That is not a speed you can set.'
  }
  if (spec.bounty < 0 || spec.bounty > maxBounty(spec.buyIn)) {
    return 'That bounty is more than this table can fund.'
  }
  if (spec.castIds.length > spec.seats - 1)
    return 'You have invited more players than there are seats.'
  for (const id of spec.castIds) {
    if (!CAST.some((ch) => ch.id === id)) return 'One of those players is not in the cast.'
  }
  return null
}

/** The regulars a player may invite: anyone not pinned to a venue of their own. */
export function invitableCast(): Character[] {
  return CAST.filter((ch) => !ch.only)
}

/**
 * A spec, as a `Venue` the rest of the app already knows how to play.
 *
 * Everything downstream — the engine, the store, the table, the economy — takes
 * a `Venue` and has no idea this one was composed rather than shipped. That is
 * the whole reason this returns one.
 */
export function customVenue(spec: CustomTableSpec): Venue {
  const rung = rungFor(spec.buyIn)
  return {
    id: CUSTOM_VENUE_ID,
    name: 'Your table',
    tagline: `${spec.seats} seats, ${spec.depth === 1 ? 'standard' : `${spec.depth}× `}stacks.`,
    buyIn: spec.buyIn,
    startingStack: spec.buyIn * spec.depth,
    smallBlind: rung.smallBlind,
    bigBlind: rung.bigBlind,
    seats: spec.seats,
    prize: customPrize(spec),
    handsPerLevel: spec.handsPerLevel,
    bounty: spec.bounty > 0 ? spec.bounty : undefined,
    format: spec.bounty > 0 ? 'bounty' : spec.depth > 1 ? 'deep' : undefined,
    // Not `rung.accent`: a custom table should not wear another venue's colour
    // and be mistaken for it on the tile.
    accent: '#8A8F98',
    // The one field the player does not get a say in. Taken whole from the rung
    // their buy-in reaches, so a custom table is exactly as hard as the ladder
    // at the same price and no profile exists here that has not been banded.
    ai: rung.ai,
    membersOnly: true,
  }
}
