// Whether a player may sit at a table, asked in two places that must agree.
//
// The lobby asks to decide whether to offer a venue; `/play/[venue]` asks to
// decide whether to honour the link. They used to ask separately, and after
// escrow shipped (technology#90) they answered differently: the cards read
// `spendableRoll` and the route read `profile.roll`, so a player holding a
// buy-in on another device was offered a table and then sent straight back to
// the home screen by the route that was supposed to seat them. A dead click,
// with no message, on a card the app had just told them they could afford.
//
// So the decision lives here, once, and both callers import it. Same reason
// `ALL_VENUES` exists: two code paths deriving the same answer from the same
// state will drift, and the drift is invisible until somebody clicks.
//
// **The Roll these answer against is the spendable one**, not `profile.roll`:
// `sitDown` reclaims another device's escrow before it takes the buy-in, so
// chips on a laptop's table are chips this phone can sit down with. That is
// only true of the sit-down path. A rebuy at a table already open here, or the
// Chip Shop, spends `roll` and must keep reading it (see lib/useSpendableRoll).

import { canAfford, freerollOpen, type Venue } from '@/config/venues'
import {
  currentChallenge,
  isChallengeTable,
  type Challenge,
  type ChallengeInput,
} from '@/lib/challenge'
import { spendableRoll, type Escrow } from '@/lib/sync/escrow'

/** The profile fields a sit-down is decided from. */
export interface SitDownInput extends ChallengeInput {
  escrow?: Escrow | null
}

/** Why the table said no. `null` from {@link refuseSitDown} means it said yes. */
export type SitDownRefusal = 'cannot-afford' | 'freeroll-closed' | 'not-your-challenge'

/**
 * The Roll every question on this page is answered against.
 *
 * Exported so a caller that needs the number itself (a price, a locked tile)
 * reads the same one the guard does rather than reaching for `profile.roll`.
 */
export function rollToSitDownWith(p: SitDownInput, device: string): number {
  return spendableRoll(p.roll, p.escrow, device)
}

/**
 * Why this player cannot sit at this venue, or `null` if they can.
 *
 * Money only: the Daily's once-a-day rule and a resumed table are the route's
 * business, because both are about what has already happened rather than what
 * the Roll can cover.
 */
export function refuseSitDown(
  venue: Venue,
  p: SitDownInput,
  device: string,
): SitDownRefusal | null {
  const roll = rollToSitDownWith(p, device)
  if (!canAfford(venue, roll)) return 'cannot-afford'
  // The freeroll is a safety net, not a farm: only when you can't afford the
  // ladder. A buy-in parked on another device still counts as affording it.
  if (venue.freeroll && !freerollOpen(roll)) return 'freeroll-closed'
  // A challenge table pays ~2.5x, so the only way in is the challenge actually
  // standing. The route exists (it has to, or the card's link 404s under static
  // export) but guessing `/play/challenge-high` gets you turned around rather
  // than a repeatable heads-up farm two bands above your game.
  if (isChallengeTable(venue) && challengeOnOffer(p, device)?.venue.id !== venue.id) {
    return 'not-your-challenge'
  }
  return null
}

/** The standing challenge, or `null` when the Roll cannot reach one. */
export function challengeOnOffer(p: SitDownInput, device: string): Challenge | null {
  return currentChallenge({ ...p, roll: rollToSitDownWith(p, device) })
}

/** Is the freeroll open to this player? True means they are out of chips. */
export function freerollOnOffer(p: SitDownInput, device: string): boolean {
  return freerollOpen(rollToSitDownWith(p, device))
}
