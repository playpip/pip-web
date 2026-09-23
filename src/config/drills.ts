import { type MembersOnly, included } from '@/config/membership'
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

export interface DrillKind extends MembersOnly {
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
   * is five, a turn is four and a flop is three.
   */
  boardCards: number
  // `membersOnly` comes from MembersOnly in config/membership.ts, which is also
  // where the argument for why an absent flag means free forever lives. It used
  // to be written out here; venues, cosmetics and formats now carry the same
  // flag and one copy of that reasoning is the point.
}

// **No seed lives here.** It used to: a `firstSeed` per kind, fixed so that the
// prerendered screen and the hydrated screen could not disagree about the
// cards. They agreed, and the cost was that every visit to the screen — and
// every tile on the index — opened on that one spot for the life of the build
// (Will, 14 Aug). Both screens deal from `randomSeed()` on mount now, and show
// card backs for the frame before it lands.

// **In ladder order, easiest first, and the order is load-bearing**
// (Will, 2026-09-21). The room used to open on "Which hand wins?", which is the
// whole ranking table applied to two seven-card hands, and a beginner's next
// step up from there was counting outs. There was no first rung. The two kinds
// at the top of this list are that rung: read the hand in front of you, then
// say exactly which five of the seven make it. Everything below them assumes
// both, and now says so by sitting below them.
export const DRILL_KINDS: DrillKind[] = [
  {
    id: 'whats-your-hand',
    title: 'What have you got?',
    blurb: 'Your two cards, a finished board. Name the hand you are holding.',
    question: 'What have you got?',
    gradedBy: 'Settled by the same code that reads a hand at showdown.',
    boardCards: 5,
  },
  {
    id: 'which-five-play',
    title: 'Which five play?',
    blurb: 'Seven cards are yours to use and only five of them count. Tap the five.',
    question: 'Tap the five cards that play.',
    gradedBy:
      'Settled by ranking all twenty-one ways to take five from seven, so any set that ties the best hand is right.',
    boardCards: 5,
    membersOnly: true,
  },
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
  {
    id: 'pot-odds',
    title: 'Pot odds',
    blurb:
      'They have bet the turn. Both hands are face up, one card is to come: is the price right?',
    question: 'Call or fold?',
    gradedBy:
      'Settled by dealing all 44 cards you cannot see and holding what gets there against what the pot is charging.',
    boardCards: 4,
    membersOnly: true,
  },
  {
    id: 'hand-strength',
    title: 'Who gets there?',
    blurb: 'Two hands face up on the flop, two cards still to come. Which one wins it more often?',
    question: 'Which hand is the favourite?',
    gradedBy:
      'Settled by dealing every pair of cards that could still come, all 990 of them, and reading each showdown.',
    boardCards: 3,
    membersOnly: true,
  },
  // **The first practice pack, and a kind rather than a mode** (2026-09-23). A
  // short lesson, then spots, graded like every kind here. It is registered
  // rather than hung off `pot-odds` the way play-it-out is (technology#86)
  // because it asks a different question with a different answer key: not "does
  // your draw get there often enough" against a hand or a sampled range, but
  // "how much of what bets like this do you beat", counted exactly against a
  // range you are shown. Folding it into the pot odds rating would make that
  // number mean two things, which is the reason play-it-out keeps its own
  // record too. As a kind it gets a rating, a ladder, a tile and a route that
  // the coaching report can link to — see RIVER_PACK_ID.
  //
  // It prices a hand, so it is the membership's (docs/membership.md: the free
  // half teaches reading a hand, the paid half pricing one), and the flag is
  // here in the commit that registers it, as rule #8 requires.
  {
    id: 'calling-the-river',
    title: 'Calling the river',
    blurb: 'They have bet the river. Work out what bets like this, weigh the price, call or fold.',
    question: 'They have bet the river. Call or fold?',
    gradedBy:
      'Settled by counting every hand that bets like this against yours, and only asked when the answer is the same however often they bluff.',
    boardCards: 5,
    membersOnly: true,
  },
]

/**
 * The river pack's id, and its route is `/game/drills/${RIVER_PACK_ID}`.
 *
 * **Stable on purpose**: the coaching report's `paying-off` and
 * `folds-to-pressure` leak cards are meant to link here, and the id is also the
 * key the pack's record is kept under on the profile, so renaming it would
 * orphan everybody's rating. Change the title freely; never this.
 */
export const RIVER_PACK_ID = 'calling-the-river' satisfies DrillKindId

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
  return included(kind, member)
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
