import { RIVER_PACK_ID } from '@/config/drills'
import { nextDrill } from './index'
import { kindFloor } from './standing'
import type { Drill, DrillKindId } from './types'

/**
 * The seed `/membership?for=river` deals (playpip/cmo#178).
 *
 * Somebody who tapped the padlock on Calling the river is shown one spot from
 * it, drawn by the pack's own generator rather than typed out: three hand-typed
 * spots on the landing page were all wrong, and a generated one cannot be.
 * Fixed, so everybody who taps sees the same hand and a reviewer can check it.
 * Seed 1 at the bottom of the ladder is two pair facing a big river bet, and
 * it is a fold, which is the pack's point in one hand.
 */
export const RIVER_SAMPLE_SEED = 1

/** The one spot, aimed where a newcomer's first spot is aimed. About 8ms, so dealt on the client. */
export function riverSample(): Drill {
  return nextDrill(RIVER_PACK_ID, RIVER_SAMPLE_SEED, kindFloor(RIVER_PACK_ID))
}

/** Fixed for the same reason as the river's: everybody sees the same hand, and a reviewer can check it. */
const DRILL_SAMPLE_SEED = 1

/** One fixed spot from a paid drill, aimed at the newcomer's floor. */
export function drillSample(kind: DrillKindId): Drill {
  return nextDrill(kind, DRILL_SAMPLE_SEED, kindFloor(kind))
}
