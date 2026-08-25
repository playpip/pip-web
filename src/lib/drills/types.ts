import type { Card } from '@/lib/poker/cards'
import type { SpotKind } from './rating'

// The drill contract. A drill is a generated spot, a decision, and a grade that
// can explain itself in one sentence from our own engine.
//
// Pure and React-free, like the engine it sits on: a drill is data, the runner
// only draws it. Nothing here reads or writes storage, nothing counts how many
// you have done, and nothing can read the clock. See the note on DrillKindId
// and the one at the top of rating.ts.

/**
 * The kinds.
 *
 * **`which-hand-wins` is free forever and unmetered**: it was ruled the free
 * kind on 2026-08-14 (technology#38) and that commitment cannot be taken back.
 * It is that kind because `determineWinners` grades it exactly rather than by
 * simulation, so the drill a stranger meets first is the one we can never mark
 * wrong. **Never meter it**: no counter, no "you have used N", no interstitial.
 * If we ever want to sample more of the practice layer, we make another whole
 * thing free rather than slicing this one.
 *
 * **`count-your-outs` comes with the membership**, and carries `membersOnly` in
 * `config/drills.ts` from the commit that registered it (technology#55: a paid
 * kind that ships without the flag is free by accident and cannot be taken
 * back). It is graded by dealing all 44 remaining cards one at a time and
 * reading the showdown, so it is exact in the same way the free kind is: no
 * simulation, nothing to sample, nothing that can mark a correct count wrong.
 */
export type DrillKindId = 'which-hand-wins' | 'count-your-outs'

/** One of the answers on offer. */
export interface DrillChoice {
  /** Stable within a drill; what an answer is compared against. */
  id: string
  /** What the button says, e.g. "Hand A". */
  label: string
  /** The cards this choice stands for. Empty where it stands for an outcome. */
  cards: Card[]
  /**
   * Part of the right answer, once the answer is out. Usually just the one the
   * grader accepts, but not always: a split pot is two winning hands and one
   * correct button, and the runner should show all three as right.
   */
  winning: boolean
  /** The made hand in words once the answer is out, e.g. "Two pair". */
  detail?: string
  /** The five cards this hand actually plays, shown with the answer. */
  plays?: Card[]
}

/**
 * A holding the spot shows but does not ask about.
 *
 * "Which hand wins" has none: there, the hands *are* the choices, and a hand you
 * can see is a hand you can pick. "Count your outs" puts both hands face up and
 * asks about the cards still to come, so the holdings have to be on the screen
 * without being buttons. Separate from {@link DrillChoice} rather than a flag on
 * it, because "can this be clicked" is the one thing the runner must never have
 * to infer.
 */
export interface DrillHand {
  /** What the panel says, e.g. "You". */
  label: string
  cards: Card[]
  /** The made hand in words right now, e.g. "Pair". Shown from the start. */
  detail?: string
}

/** A generated spot: everything the runner draws and the grader needs. */
export interface Drill {
  kind: DrillKindId
  /**
   * The seed this spot was generated from, and the load-bearing property of the
   * whole contract: same seed, same spot, same grade, forever. The grader, the
   * explanation and the tests all read one generation rather than re-deriving
   * anything, so they cannot drift apart.
   */
  seed: number
  /** The community cards. */
  board: Card[]
  choices: DrillChoice[]
  /**
   * Holdings the spot shows without asking about, drawn above the choices.
   * Absent for a kind whose choices are the hands (see {@link DrillHand}).
   */
  hands?: DrillHand[]
  /** The id of the correct choice. */
  answer: string
  /**
   * What settled it, taken from the same evaluation that set `answer` and wrote
   * `explanation`. One reading of the hand feeds the grade, the sentence and
   * the difficulty, so none of the three can disagree with the other two.
   */
  settledBy: SpotKind
  /**
   * What this spot is rated, on the same scale as the player's rating. Carried
   * on the drill rather than recomputed by whatever is scoring, for the same
   * reason the seed is: the spot answers for itself, forever.
   */
  difficulty: number
  /**
   * Why, in one sentence, written at generation time out of the same evaluation
   * that set `answer`. A drill that cannot explain its own answer is not a
   * drill we ship, so the generator throws that spot away instead.
   */
  explanation: string
}

/** What the runner shows once a choice is made. */
export interface Grade {
  correct: boolean
  /** The id of the correct choice, whether or not it was picked. */
  answer: string
  explanation: string
  /** What the spot was rated. What the answer is worth is arithmetic on this. */
  difficulty: number
}

/**
 * Why a generated spot was thrown away instead of shown. Generation is a
 * filtered stream, not a raw one, and this is the filter's vocabulary.
 *
 * - `one-sided`: the two hands are more than one category apart, so the spot
 *   is a look rather than a question.
 * - `unexplainable`: the winner cannot be explained from the same evaluation
 *   that graded it. Silence over noise, at generation time.
 *
 * The next three belong to "count your outs", and all three are about the
 * question being well posed rather than about the answer being computable. The
 * answer is always computable there, because it is a count of 44 showdowns.
 *
 * - `already-ahead`: the hero is winning or tied on the turn. "How many cards
 *   win it for you" has no honest answer when you are already there.
 * - `chop-possible`: some river splits the pot. Whether a chop counts as an out
 *   is a real disagreement between reasonable players, so the spot goes in the
 *   bin rather than the player being marked wrong for the other reading.
 * - `drawing-dead`: nothing wins it. A true and useful fact about a hand, and a
 *   bad multiple-choice question: it makes "the lowest number" a free guess.
 *
 * **An equity-graded kind adds `ambiguous` here**, and rejects any spot where
 * required and actual equity sit inside the margin (4 points is a guess and
 * wants play-testing, not theory). Two rules come with it, and they are why
 * this vocabulary exists before there is a kind that needs it: the rng handed
 * to `estimateEquity` is `mulberry32(drill.seed)`, so the grade and the
 * sentence under it cannot drift; and iterations go **up** there rather than
 * down, because generation happens once per spot and not once per render.
 */
export type RejectReason =
  | 'one-sided'
  | 'unexplainable'
  | 'already-ahead'
  | 'chop-possible'
  | 'drawing-dead'

/** The result of generating at one seed: a spot, or the reason there isn't one. */
export interface Generated {
  drill: Drill | null
  rejected: RejectReason | null
}

/** Helpers so a generator reads as accept/reject rather than as null-juggling. */
export const accept = (drill: Drill): Generated => ({ drill, rejected: null })
export const reject = (rejected: RejectReason): Generated => ({ drill: null, rejected })
