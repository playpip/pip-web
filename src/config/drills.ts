import type { DrillKindId } from '@/lib/drills/types'

// The drills' table of contents. Each kind is a screen in the app, under
// /game/drills/<id>, and this registry drives both the index and the route's
// static params, so a new kind is a generator and one entry here.
//
// **Drills are app, not content.** They sit inside the game next to the tables
// rather than on a page of the website: a drill is something you play, and the
// prose about poker lives in /learn on the other side of the wall. Nothing here
// carries meta titles or sitemap dates for that reason.
//
// Practice, not prose: a drill generates a spot, asks you to decide, and grades
// it out of the engine. That is the line the written guides stay on the other
// side of (see src/config/learnExamples.ts): a guide's widget illustrates what
// its page already says and never generates anything.
//
// **Nothing here is metered, and that is not the same as nothing being kept.**
// A rating, a best run and an accuracy per kind live on the profile and follow
// the account (see lib/drills/rating.ts). What may never exist is a number you
// run out of: no counter of how many you have left, no lockout, no
// interstitial. "Which hand wins" is free forever by ruling (technology#38) and
// unlimited is the half of that which is easiest to erode for a good reason.
// **Unmetered applies to the paid kind too**: what the membership buys is
// another whole kind, played as often as you like, not an allowance of spots.
//
// **A kind is free or it is the membership's, and there is no third thing.**
// `membersOnly` is the whole of it: no sampling, no "three a week", no trial
// that ends mid-session. That shape is not available to us on purpose, because
// metered puzzles are the exact behaviour this app is positioned against. What
// we sell is another whole kind, never a slice of this one.

export interface DrillKind {
  /** URL segment under /game/drills, and the kind's id in the engine. */
  id: DrillKindId
  /** The kind's name, on the index tile and at the top of its screen. */
  title: string
  /** One line under the title on the index. What you are about to do. */
  blurb: string
  /** The question itself, asked once per spot above the board. */
  question: string
  /** What settles the answer, said once in small print under the drill. */
  gradedBy: string
  /**
   * How many community cards this kind's spots deal.
   *
   * Here rather than measured off a generated spot, because the one place it is
   * needed is the frame *before* a spot exists: the runner and the room both
   * draw card backs until the client has dealt, and a placeholder of the wrong
   * width makes the spot arriving a jump rather than a deal. A finished board
   * is five; a spot with a card still to come is four.
   */
  boardCards: number
  /**
   * Part of the membership rather than free.
   *
   * Absent means free forever, and that is not a default anyone may change
   * later: rule #8 says we never charge for something that shipped free, so a
   * kind that ships without this flag has given itself away. **A new kind that
   * is meant to be paid must carry it in the same commit that registers it**,
   * or it is free by accident and the box the membership is priced from empties
   * itself on the way to being sold (technology#55).
   */
  membersOnly?: boolean
}

// **No seed lives here.** It used to: a `firstSeed` per kind, fixed so that the
// prerendered screen and the hydrated screen could not disagree about the
// cards. They agreed, and the cost was that every visit to the screen — and
// every tile on the index — opened on that one spot for the life of the build
// (Will, 14 Aug). Both screens deal from `randomSeed()` on mount now, and show
// card backs for the frame before it lands.

export const DRILL_KINDS: DrillKind[] = [
  {
    id: 'which-hand-wins',
    title: 'Which hand wins?',
    blurb: 'Two hands, a finished board, one question. Harder spots are worth more.',
    question: 'Which hand takes it?',
    gradedBy: 'Settled by the same code that settles a showdown at the table, card by card.',
    boardCards: 5,
  },
  {
    id: 'count-your-outs',
    title: 'Count your outs',
    blurb: 'Both hands face up on the turn, one card to come. How many of them win it for you?',
    question: 'How many cards left win it for you?',
    gradedBy:
      'Settled by dealing all 44 cards you cannot see, one at a time, and reading the showdown.',
    boardCards: 4,
    membersOnly: true,
  },
]

/**
 * May this player open this kind?
 *
 * One function, read by the room and by the screen, so the two cannot come to
 * different answers about the same kind. `member` comes from `useEntitlement()`
 * and nothing here knows where that got it.
 *
 * **The route still exists for every kind, member or not**, and that is
 * deliberate: the app is a static export, so a route that is not generated is a
 * 404 rather than a refusal, and a 404 is what a member sees too if their row
 * has not come back yet. The registered tables made the same call for the same
 * reason (see the note on ALL_VENUES). The refusal is a screen, not a missing
 * page.
 */
export function canPlayDrill(kind: DrillKind, member: boolean): boolean {
  return member || !kind.membersOnly
}

/**
 * A kind's entry, or a failure. Throwing rather than returning undefined
 * because the callers are a route's static params and a screen's title: a kind
 * with no entry would otherwise render an untitled screen, and nothing about
 * that fails loudly.
 */
export function drillKind(id: string): DrillKind {
  const kind = DRILL_KINDS.find((entry) => entry.id === id)
  if (!kind) throw new Error(`No registry entry for drill "${id}". Add one to config/drills.ts`)
  return kind
}
