import { CAST, type Character, characterById, homeRungFor } from '@/config/cast'
import { VENUES, type Venue } from '@/config/venues'

// Build your own table — the member feature, and the one rule that makes it
// safe to ship.
//
// **You pick the shape. You can make it harder and you can never make it
// softer.**
//
// That is the whole design. Seats, stakes, stack depth, how fast the blinds
// climb, whether heads are worth money and who sits down are all yours. The
// table's own opposition is derived from the buy-in by the same ladder
// everybody plays, and there is deliberately no control for it anywhere in this
// file.
//
// Without that rule this is a chip printer: pick the Garage's opponents, pick
// the Main Event's buy-in, collect. What the rule was ever protecting is the
// *downward* direction, and only that one — the prize is the buy-in times the
// seats, so a table full of players better than its price pays exactly the same
// for a worse game. That is why a guest may bring their own rung with them when
// it is the harder one (`Venue.guests`, applied in config/cast.ts): inviting
// the sharpest regular in the cast to a 100-chip table is a thing you do to
// yourself, not an edge, and it is the one thing a built table is *for* that
// the ladder cannot do.
//
// Everything else stands. A table you built and invited nobody to is exactly as
// hard as the ladder rung at the same price, nothing here can go the other way,
// and the only thing money has bought is the arrangement — which is style, not
// edge, and is the line the whole product rests on (docs/brand.md principle 1).
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
   * A named guest turns up — they are seated before the draw rather than
   * entered into it — and brings their own standard with them when it is above
   * what the buy-in bought. That is the one way a built table departs from its
   * rung, it only goes upward, and it is the whole reason the feature is worth
   * having: the Penthouse's regulars, at a price you can afford to lose.
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
 * The standard this table actually plays at: the buy-in's rung, unless somebody
 * invited out-ranks it.
 *
 * **Rungs are compared by price rather than by profile** — the ladder climbs in
 * both at once, so the cheaper rung is always the softer one, and asking about
 * the money keeps this file unable to express an opinion about an AI profile at
 * all (`tests/customTable.test.ts` holds it to that, by reading the source).
 *
 * The screen says the answer out loud, because a table that is harder than its
 * price is the one fact about a built table a player must not discover at the
 * felt.
 */
export function standardFor(spec: CustomTableSpec): Venue {
  let hardest = rungFor(spec.buyIn)
  for (const id of spec.castIds) {
    const guest = characterById(id)
    const home = guest && homeRungFor(guest)
    if (home && home.buyIn > hardest.buyIn) hardest = home
  }
  return hardest
}

/** Does inviting this guest make the table harder than its price bought? */
export function raisesTable(ch: Character, buyIn: number): boolean {
  return homeRungFor(ch).buyIn > rungFor(buyIn).buyIn
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
    // Who the player asked for. Seated before the draw, and read again by
    // `profileFor` — a guest above this rung plays their own, never below it.
    guests: [...spec.castIds],
    // The table's own opposition, and the player gets no say in it. Taken whole
    // from the rung their buy-in reaches, so a table nobody was invited to is
    // exactly as hard as the ladder at the same price and no profile exists
    // here that has not been banded. A guest's seat is decided seat-by-seat in
    // `profileFor` and can only be this or harder.
    ai: rung.ai,
    membersOnly: true,
  }
}
