import { generateCountYourOuts } from './countYourOuts'
import type { Drill, DrillKindId, Generated, Grade } from './types'
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

const GENERATORS: Record<DrillKindId, (seed: number) => Generated> = {
  'which-hand-wins': generateWhichHandWins,
  'count-your-outs': generateCountYourOuts,
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
 * The first spot at or after `seed` that the filter accepts.
 *
 * A drill set is a filtered stream rather than a raw one: generation is cheap
 * and happens once per spot, so a spot that would make a poor question is
 * thrown away and the next seed is tried. Every spot that comes back still
 * carries the seed it was generated from, so it can be reproduced exactly.
 */
export function nextDrill(kind: DrillKindId, seed: number): Drill {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { drill } = drillAt(kind, (seed + attempt) >>> 0)
    if (drill) return drill
  }
  throw new Error(`No ${kind} spot in ${MAX_ATTEMPTS} seeds from ${seed}`)
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
 */
export function gradeDrill(drill: Drill, choiceId: string): Grade {
  return {
    correct: choiceId === drill.answer,
    answer: drill.answer,
    explanation: drill.explanation,
    difficulty: drill.difficulty,
  }
}
