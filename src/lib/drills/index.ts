import { generateBetOrCheck } from './betOrCheck'
import { generateRiverCall } from './callingTheRiver'
import { generateCountYourOuts } from './countYourOuts'
import { generateHandStrength } from './handStrength'
import { generateOpenOrFold } from './openOrFold'
import { generatePotOdds } from './potOdds'
import { generateShoveOrFold } from './shoveOrFold'
import type { Drill, DrillKindId, Generated, Grade } from './types'
import { generateWhatsYourHand } from './whatsYourHand'
import { generateWhichFivePlay } from './whichFivePlay'
import { generateWhichHandWins } from './whichHandWins'

// The drill engine's public seam: generate a spot, grade an answer. One entry
// per kind, so a new kind is a generator and a line here.
//
// Pure and storage-free on purpose: what a spot is worth lives on the spot
// (`difficulty`), what a player is rated lives on the profile, and the
// arithmetic between them is `./rating`. Nothing in this folder may read
// storage, reach for a store, or read the clock — `tests/drills.test.ts` fails
// the build on any of the three.

export * from './rating'
// The "play it out" mode of `pot-odds` (RULED technology#86). Exported from the
// same seam as the kinds and registered nowhere: it produces `pot-odds` streets,
// so it inherits that kind's `membersOnly` and adds no row to any registry.
export {
  BAND,
  ITERATIONS,
  MARGIN,
  FAIR_QUESTION,
  MAX_HAND_ATTEMPTS,
  afterStreet,
  generatePlayedHand,
  nextPlayedHand,
  type GeneratedHand,
  type PlayedHand,
  type PlayedStreet,
  type StreetId,
} from './playItOut'

const GENERATORS: Record<DrillKindId, (seed: number) => Generated> = {
  'whats-your-hand': generateWhatsYourHand,
  'which-five-play': generateWhichFivePlay,
  'which-hand-wins': generateWhichHandWins,
  'count-your-outs': generateCountYourOuts,
  'pot-odds': generatePotOdds,
  'hand-strength': generateHandStrength,
  'calling-the-river': generateRiverCall,
  'open-or-fold': generateOpenOrFold,
  'bet-or-check': generateBetOrCheck,
  'shove-or-fold': generateShoveOrFold,
}

/**
 * How many seeds `nextDrill` walks before it gives up. Set far above anything
 * observed (the tests measure the real worst case, which is single figures) so
 * that hitting it means a generator has started rejecting everything, and
 * throwing is the honest answer to that.
 */
export const MAX_ATTEMPTS = 500

/** The spot at exactly this seed, whether or not it survives the filter. */
export function drillAt(kind: DrillKindId, seed: number): Generated {
  return GENERATORS[kind](seed)
}

/**
 * A spot at or after `seed`: the first the filter accepts, or — given an `aim` —
 * the nearest to it of the first few.
 *
 * A drill set is a filtered stream rather than a raw one: generation is cheap
 * and happens once per spot, so a spot that would make a poor question is
 * thrown away and the next seed is tried. Every spot that comes back still
 * carries the seed it was generated from, so it can be reproduced exactly.
 *
 * **`aim` is what makes this a set of puzzles rather than a shuffle**
 * (Will, 2026-09-21). Without it the stream hands back whatever the filter
 * accepted first, so a player's second-ever spot could be a split pot or three
 * draws at once — the top of the kind's own ladder — and the rating watched it
 * happen without ever selecting anything. With it, the walk keeps the nearest
 * spot to the number `aimFor()` worked out from the record and stops as soon as
 * one is inside {@link AIM_BAND}. Beginners meet the bottom of the ladder,
 * players who have cleared it stop being asked the easy ones, and neither is a
 * cap on anything.
 *
 * Still pure and still reproducible: the aim is a number the caller hands in,
 * the walk is deterministic in `(seed, aim)`, and the spot carries the seed it
 * came from either way.
 */
export function nextDrill(kind: DrillKindId, seed: number, aim?: number): Drill {
  let best: Drill | null = null
  let bestGap = Number.POSITIVE_INFINITY
  let considered = 0
  // Most spots at this seed skip the capped answer entirely; see ANSWER_CAPS.
  const cap = ANSWER_CAPS[kind]
  const skipCapped = aim !== undefined && cap !== undefined && unitOf(seed) >= cap.share

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { drill } = drillAt(kind, (seed + attempt) >>> 0)
    if (!drill) continue
    if (aim === undefined) return drill
    if (skipCapped && drill.answer === cap?.answer) continue

    const gap = Math.abs(drill.difficulty - aim)
    if (gap < bestGap) {
      best = drill
      bestGap = gap
    }
    // Near enough is the answer. The ladders are a few hundred points wide, so
    // anything inside the band is the shape that was asked for and walking
    // further only costs generations.
    if (bestGap <= AIM_BAND) return best as Drill
    if (++considered >= AIM_SAMPLE[kind]) return best as Drill
  }

  if (best) return best
  throw new Error(`No ${kind} spot in ${MAX_ATTEMPTS} seeds from ${seed}`)
}

/**
 * Answers the aim may not make the usual one.
 *
 * **Aiming by difficulty can turn difficulty into the answer.** On "Which hand
 * wins?" the hardest shape is the split pot, and a split's answer is always
 * "They split it" — so once a rating reached the top of the ladder the walk
 * picked a split more than half the time, and pressing the one button scored
 * (Will, 2026-09-23: "only ever has they split it as the option"). The river
 * pack found the same failure with always-call and fixed it by balancing each
 * ten; a stream has no ten to balance, so this caps the share instead.
 *
 * A cap, not a quota: at most `share` of spots may be the capped answer, and
 * only where the walk would have chosen one anyway. Below the top of the ladder
 * the aim rarely picks a split and nothing changes; at the top, four spots in
 * five are the hard kickers and board-plays that have a hand for an answer.
 */
const ANSWER_CAPS: Partial<Record<DrillKindId, { answer: string; share: number }>> = {
  'which-hand-wins': { answer: 'split', share: 0.2 },
}

/** A seed as a number in [0, 1), so a cap decides the same way for the same seed. */
function unitOf(seed: number): number {
  return (Math.imul(seed >>> 0, 2654435761) >>> 0) / 2 ** 32
}

/**
 * How near an aim a spot has to be before the walk stops looking.
 *
 * The gap between two rungs of a ladder, roughly: the shapes are 150 to 250
 * points apart on every kind, so a spot inside 80 of the aim is the rung that
 * was asked for and a closer one is the same rung by a smaller number.
 */
export const AIM_BAND = 80

/**
 * How many accepted spots the walk will look at, per kind, before it settles
 * for the nearest it has seen.
 *
 * **A budget on generation, not a limit on the player**, and it is per kind
 * because what a spot costs to make varies by a factor of seven hundred.
 * Measured on 2026-09-21, milliseconds per accepted spot on a desktop:
 *
 * | kind | cost | sample | worst case |
 * |---|---|---|---|
 * | `which-hand-wins`  | 0.04 | 16 | 0.6 ms |
 * | `whats-your-hand`  | 0.16 | 16 | 2.6 ms |
 * | `which-five-play`  | 0.29 | 16 | 4.6 ms |
 * | `count-your-outs`  | 2.5  | 12 | 30 ms |
 * | `pot-odds`         | 6.3  | 8  | 50 ms |
 * | `hand-strength`    | 31   | 2  | 63 ms |
 * | `calling-the-river`| 7.5  | 8  | 60 ms |
 * | `open-or-fold`     | 0.02 | 16 | 0.3 ms |
 * | `bet-or-check`     | 2.1  | 12 | 25 ms |
 * | `shove-or-fold`    | 0.4  | 16 | 6.4 ms |
 *
 * The last two measured on 2026-09-24, over 3,000 seeds each, rejected seeds
 * included. `bet-or-check` is cheaper per spot than the river call because it
 * throws away a hand with nothing of its own before building a range, and most
 * seeds are that; walked from the aim that sits between two of its rungs (the
 * worst case), it came to 27ms. `shove-or-fold` pays about 35ms once, on its
 * first spot, to build the callers either side of Nash for all 65 seats and
 * stacks (`callerModels`, memoised); every spot after that is arithmetic on
 * the stored chart.
 *
 * Every row is inside about 60ms of work between one spot and the next, which
 * is the budget: a phone is some multiple slower than this desktop, and a
 * quarter of a second of dead air after "Next hand" is a drill that feels like
 * it is thinking rather than dealing.
 *
 * **The worst case is rare, because the walk stops early.** Anything inside
 * {@link AIM_BAND} ends it, and at the aims a player actually has that is
 * usually the first or second spot. The sample is what happens when a player
 * sits between two rungs, where no spot on the kind is close and looking harder
 * finds nothing.
 *
 * Nothing here is a limit on how many spots you can play. It is how many the
 * app *thinks about* before showing you one, and the drills remain unmetered
 * (see the note at the top of config/drills.ts).
 */
export const AIM_SAMPLE: Record<DrillKindId, number> = {
  'whats-your-hand': 16,
  'which-five-play': 16,
  'which-hand-wins': 16,
  'count-your-outs': 12,
  'pot-odds': 8,
  'hand-strength': 2,
  'calling-the-river': 8,
  'open-or-fold': 16,
  'bet-or-check': 12,
  'shove-or-fold': 16,
}

/**
 * A seed for a spot nobody has seen yet.
 *
 * `Math.random`, not the engine's rng: which spot comes next is not a thing
 * that has to be reproducible, and the spot it produces still is, from the seed
 * it carries.
 *
 * **Never call this during render.** The app is a static export, so a spot
 * generated while rendering is generated once, at build time, and baked into
 * the HTML — the screen then opens on the same cards forever, which is exactly
 * what a fixed first seed did here (Will, 14 Aug: "it seems to always show me
 * the same drill"). The screens deal on mount instead.
 */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}

/**
 * Grade an answer. One seam for every kind, and deliberately dumb: the grade
 * was settled at generation time by the engine, so nothing is recomputed here
 * and there is nothing for a second reading of the hand to disagree with.
 *
 * `answers` is read where a spot carries one and `answer` everywhere else, so a
 * kind with a single right answer is graded exactly as it always was. What it
 * is for, and why a split pot is not an instance of it, is on the field in
 * ./types.
 */
export function gradeDrill(drill: Drill, choiceId: string): Grade {
  const correct = drill.answers ? drill.answers.includes(choiceId) : choiceId === drill.answer
  return {
    correct,
    answer: drill.answer,
    explanation: drill.explanation,
    difficulty: drill.difficulty,
  }
}
