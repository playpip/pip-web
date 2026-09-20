// What to play now, and where you are on the ladder — the lobby's hierarchy,
// derived rather than arranged.
//
// The home screen used to be a directory: five identically sized tiles, one of
// which happened to be the game's progression and four of which were detours,
// with nothing to tell them apart. A player opening the app had to evaluate all
// five before they could sit anywhere, and the app never said where they were —
// `peakRoll` drives a rank title in the AppBar and nothing else reaches the
// screen (Will, 2026-09-20).
//
// So the lobby asks three questions here instead of listing doors:
//
// - **`nextUp`** — the single best table right now, which is the ladder unless
//   the ladder cannot answer. One answer, not a shortlist: a hero that offers
//   three things is the five-tile grid again, smaller.
// - **`quickPlay`** — the same evening's other question: what if you only have
//   ten minutes? A different axis, which is the only reason it is allowed to
//   sit beside `nextUp` rather than under it.
// - **`ladderProgress`** — the spine, as an object with a position on it, so
//   "rung 4 of 10" can be drawn rather than inferred from a Roll.
//
// Pure, and in `lib/` rather than in the component, for the reason `sitDown`
// is: the screen must not answer "can I sit down here" for itself
// (`tests/sitDown.test.ts` fails the build on a component calling `canAfford`).
// The Roll every question here is answered against is the **spendable** one,
// because every answer is a table you are about to be offered.

import { KITCHEN_TABLE, RING_TABLES, VENUES, canAfford, type Venue } from '@/config/venues'
import type { Challenge } from '@/lib/challenge'
import {
  challengeOnOffer,
  freerollOnOffer,
  rollToSitDownWith,
  type RollInput,
  type SitDownInput,
} from '@/lib/sitDown'
import type { VenueRecord } from '@/store/profile'

/** Which of the lobby's offers won the hero slot. */
export type NextUpKind = 'freeroll' | 'challenge' | 'ladder'

/** The one table the lobby leads with. */
export interface NextUp {
  kind: NextUpKind
  venue: Venue
  /** The face waiting, on a challenge. */
  challenge?: Challenge
  /** 1-based position, on the ladder. */
  rung?: number
  /** Ladder only: this rung has been taken down before. */
  repeat?: boolean
}

/**
 * The single best table to sit at right now.
 *
 * **It is the ladder, and the other two are the cases where the ladder cannot
 * answer** (Will, 2026-09-20):
 *
 * 1. **The freeroll**, when the Roll cannot reach the bottom rung. Nothing else
 *    is reachable, so nothing else is an answer.
 * 2. **The ladder** — the lowest rung not yet won, when the Roll covers it.
 * 3. **The challenger**, once the ladder has nothing new to offer: the next
 *    rung is out of reach, or every rung has been taken down. A challenge pays
 *    about 2.5× its buy-in, so when the next rung is the thing you are short
 *    for, sitting at one is a better route to it than replaying a rung you have
 *    already beaten.
 * 4. **The dearest rung the Roll covers**, which is where you rebuild when even
 *    a challenge is out of reach.
 *
 * **Two things deliberately never win this slot.**
 *
 * *The Daily* is a once-a-day novelty, not a step — pointing the lobby's one
 * recommendation at it every morning would say the day's progress is a fixed
 * deal rather than the climb, and it would displace the ladder on exactly the
 * days a player only opens the app once. It keeps its tile on the shelf below,
 * where its state (played, placed, or priced out) is the thing worth reading.
 *
 * *The challenger*, except as a fallback. A challenge is on offer at any Roll
 * past its buy-in and nothing about it expires, counts down or keeps score
 * (that is the whole point of it — see `lib/challenge.ts`). Ranked above the
 * ladder it would win this slot at essentially every Roll forever, so the
 * lobby would recommend the same face every session and the game's own
 * progression not once. It too keeps its tile, with the face on it.
 *
 * It always answers. The freeroll opens exactly below the bottom rung, so a
 * player past it can afford the Garage and the last branch cannot miss — which
 * means the lobby has no empty state to design.
 */
export function nextUp(p: SitDownInput, device: string): NextUp {
  if (freerollOnOffer(p, device)) return { kind: 'freeroll', venue: KITCHEN_TABLE }

  const roll = rollToSitDownWith(p, device)
  const { rungs, next } = ladderProgress(p.venueRecords, roll)
  if (next?.affordable) return { kind: 'ladder', venue: next.venue, rung: next.rung }

  const challenge = challengeOnOffer(p, device)
  if (challenge) return { kind: 'challenge', venue: challenge.venue, challenge }

  // Every rung cheaper than the lowest unwon one has by definition been won, so
  // the dearest affordable rung is always a repeat here.
  const rebuild = [...rungs].reverse().find((r) => r.affordable) ?? rungs[0]
  return { kind: 'ladder', venue: rebuild.venue, rung: rebuild.rung, repeat: rebuild.won }
}

/**
 * Somewhere to kill ten minutes, or `null` when the Roll cannot reach the Rail.
 *
 * **Always the Rail, and that is the point.** A ring table is the only thing in
 * the game you can stand up from mid-session with your chips: the ladder, the
 * challenges and the Daily all have to be finished. A turbo is *fast*, which is
 * not the same promise — it still ends when somebody wins. So the question
 * "have you got ten minutes?" has exactly one honest answer, and this picks
 * which stake it is rather than whether there is one.
 *
 * **The dearest room the Roll covers, and nothing cleverer.** This first shipped
 * asking for five buy-ins of cover, on the theory that a cash stake should be
 * one you could lose without the evening ending. Will hit it within a minute:
 * the card offered Micro while the Roll plainly covered the room above it, and
 * a lobby that says "not this one" about a table you can obviously buy into
 * reads as broken, not as prudent (Will, 2026-09-20). Every other surface in
 * the app answers affordability with `canAfford` and this is not the place to
 * invent a second rule — the room's own dialog shows the stake before anybody
 * sits down.
 */
export function quickPlay(p: RollInput, device: string): Venue | null {
  const roll = rollToSitDownWith(p, device)
  // Dearest first: the rooms are priced low to high, so the first affordable
  // one from the top is the biggest game on offer.
  return [...RING_TABLES].reverse().find((room) => canAfford(room, roll)) ?? null
}

/** One rung of the ladder, as the strip draws it. */
export interface Rung {
  venue: Venue
  /** 1-based position, counting from the Garage. */
  rung: number
  /** Taken down at least once. Winning is the only evidence of progress. */
  won: boolean
  /** The Roll covers the buy-in. */
  affordable: boolean
}

/** Where the player is on the spine. */
export interface LadderProgress {
  rungs: Rung[]
  /** How many rungs have been won, in any order. */
  won: number
  /** The lowest rung not yet won, or `null` once the ladder is cleared. */
  next: Rung | null
}

/**
 * The ladder with the player's position marked.
 *
 * **Won, not afforded.** A rung you can buy into is open — the ladder is gated
 * by the Roll and nothing else — so affordability says what you may do, never
 * what you have done. `lib/challenge.ts` draws the same line for the same
 * reason: one lucky night at the Card Room would otherwise pitch you two rungs
 * above your game forever.
 *
 * Counts wins wherever they fall rather than the length of an unbroken run from
 * the bottom: skipping the Pub is a legitimate way up, and a strip that refused
 * to credit it would read as the game losing track.
 */
export function ladderProgress(
  venueRecords: Record<string, VenueRecord>,
  roll: number,
): LadderProgress {
  const rungs: Rung[] = VENUES.map((venue, i) => ({
    venue,
    rung: i + 1,
    won: (venueRecords[venue.id]?.won ?? 0) > 0,
    affordable: canAfford(venue, roll),
  }))
  return {
    rungs,
    won: rungs.filter((r) => r.won).length,
    next: rungs.find((r) => !r.won) ?? null,
  }
}
