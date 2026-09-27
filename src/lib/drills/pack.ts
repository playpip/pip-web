import type { Rng } from '@/lib/poker/cards'
import { nextDrill } from './index'
import type { Drill, DrillKindId } from './types'

// A practice pack: ten spots, and then a count.
//
// **Why a pack fixes its split rather than trusting the stream.** Every kind
// with a two-button answer tosses a coin for which way a spot is asked, but the
// aim picks spots by rung and the rungs lean — the first playthrough of the
// river pack scored nine in ten by pressing Call every time. So a pack decides
// its answers first, exactly half each way in a shuffled order, and deals a spot
// for each. No single button beats a coin, on either pack, and the tests hold it.
//
// Which spots answer which way is still the generator's, graded exactly as ever;
// the pack only chooses which of the dealt spots to keep, the way a generator
// drops a spot that is not a fair question.

/** How many spots a pack deals before it stops to show you how it went. */
export const PACK_SIZE = 10

/**
 * The answers a pack will have, in a shuffled order: exactly half of each.
 *
 * The rng is the caller's. A screen passes `Math.random` — the order is not a
 * thing that has to be reproducible, and each spot still carries its own seed —
 * and a test passes a seeded one.
 */
export function planPack<T>(first: T, second: T, rng: Rng, size = PACK_SIZE): T[] {
  const plan = Array.from({ length: size }, (_, i) => (i % 2 === 0 ? first : second))
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[plan[i], plan[j]] = [plan[j], plan[i]]
  }
  return plan
}

/**
 * How many aimed deals to look through for the answer the plan wants, per kind.
 *
 * A budget on generation, like `AIM_SAMPLE`: the river pack's spots cost about
 * eight milliseconds each, so it looks at six; an open-or-fold spot costs a few
 * hundredths of one, so it can afford to look until it is as good as certain.
 */
const PLAN_TRIES: Partial<Record<DrillKindId, number>> = {
  'calling-the-river': 6,
  'open-or-fold': 16,
  'bet-or-check': 8,
  'shove-or-fold': 16,
}

/**
 * The next spot, aimed, with the answer the plan asked for.
 *
 * Each try is an ordinary aimed deal from a fresh seed; a spot of the wrong
 * answer is simply not shown. The fallback after the kind's budget is the last
 * spot dealt, so the screen never waits on a lean stream — which is the one way
 * a pack can come out uneven, and the tests measure how rarely it does.
 *
 * `seed` is called once per try. The screens pass `randomSeed`, and nothing
 * here generates during a render: the caller deals on mount or on a tap.
 */
export function dealPlanned(
  kind: DrillKindId,
  want: string,
  aim: number,
  seed: () => number,
): Drill {
  const tries = PLAN_TRIES[kind] ?? 6
  let drill = nextDrill(kind, seed(), aim)
  for (let i = 1; i < tries && drill.answer !== want; i++) {
    drill = nextDrill(kind, seed(), aim)
  }
  return drill
}
