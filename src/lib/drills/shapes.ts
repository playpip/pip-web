import type { DrillKindId } from './types'
import { spotLadder } from './standing'

// How you do on each shape of spot, said as the fraction it is.
//
// **What this is for.** The rating says one thing about you and says it well: a
// number on the spots' own scale, and ./standing turns it into a sentence about
// which shapes you are better than even on. What neither can answer is the
// question a player actually has after twenty spots, which is *which of these
// am I getting wrong*. That is not an inference. It is a count, and the only
// reason it was not on the screen already is that nothing counted it.
//
// **It makes no claim, so it needs no confidence.** Every row is two integers
// the player produced, printed as "7 of 21" rather than as 33%. A percentage
// hides its sample size and invites a comparison between rows that eleven
// answers cannot support; a fraction carries the sample size in it and lets a
// player weigh their own numbers. Nothing here is compared, ranked, coloured or
// called a weakness.
//
// **Still a mirror** (see the note at the top of ./rating): no clock, no target,
// nothing to complete, and no row that exists to make somebody feel behind. A
// shape you have never seen is absent rather than shown at zero.
//
// **The rare shape is the hard one, and that is a property of the generators.**
// Measured over 6,000 seeds on 2026-08-26: `which-hand-wins` deals category 50%,
// kicker 23%, rank 21% and split 5.5%; `count-your-outs` deals one-draw 56%,
// two-draws 38% and many-draws 5.9%. So the top of each ladder is roughly one
// spot in eighteen, and its row needs around two hundred answers to appear at
// all. That is honest and it is also worth knowing: if we ever want the hardest
// shape to be readable sooner, the change is to the generator's acceptance, not
// to this floor.

/**
 * How many answers a shape needs before its row is shown.
 *
 * A floor, not a confidence interval: nothing here is estimating anything, so
 * the only job the number has is to keep "1 of 1" off the screen. Below it a
 * row is noise dressed as a fact about a player, which is the same objection
 * `lib/playStyle` and `lib/reads` have to speaking from too few hands (see
 * tests/noiseFloors.test.ts).
 */
export const SHAPE_MIN_ANSWERS = 10

/**
 * Two counters for one shape.
 *
 * Structurally typed rather than imported from the store, for the same reason
 * `drillAccuracy` in ./standing takes a shape instead of a `DrillRecord`: this
 * folder is pure and knows nothing about persistence, and the profile's
 * `ShapeRecord` satisfies this without either file importing the other.
 */
export interface ShapeCount {
  answered: number
  correct: number
}

/** One shape's row: what it is called, and what you did on it. */
export interface ShapeRow {
  /** The shape's id in the `SpotKind` vocabulary. */
  settledBy: string
  /** What the shape is called in a sentence, from the kind's ladder. */
  label: string
  answered: number
  correct: number
}

/**
 * What this kind's record says about each shape, easiest first, or an empty
 * list when there is nothing worth printing yet.
 *
 * Driven by the kind's ladder rather than by the keys on the record, which is
 * what makes it right in both directions. A shape the ladder does not name is
 * dropped, so a retired or renamed shape sitting in a year-old persisted
 * profile cannot put a row with no label on the screen. And a kind with no
 * ladder gets nothing at all, without this file having to know which kinds
 * those are: ./standing already made that decision once.
 */
export function shapeBreakdown(
  kind: DrillKindId,
  shapes: Record<string, ShapeCount> | undefined,
): ShapeRow[] {
  const ladder = spotLadder(kind)
  if (!ladder || !shapes) return []
  const rows: ShapeRow[] = []
  for (const shape of ladder) {
    const seen = shapes[shape.settledBy]
    if (!seen || seen.answered < SHAPE_MIN_ANSWERS) continue
    rows.push({
      settledBy: shape.settledBy,
      label: shape.label,
      answered: seen.answered,
      correct: seen.correct,
    })
  }
  return rows
}
