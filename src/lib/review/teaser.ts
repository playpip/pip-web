import type { DeepRead, Leak } from '@/lib/deepCoach'

// One line of the paid report, shown free at the end of a run.
//
// **Only ever a real finding.** It is the report's own top leak — the first in
// `deepRead().leaks`, which is worst first — with the sample it was drawn from.
// Nothing here writes a finding: if the report has nothing to say yet (under
// its hand minimum, or no leak clears its own sample), this returns null and
// the card shows nothing. It never says the advice, the number, or the hands:
// the title and how much play it rests on, and the rest is the report.

/** The one line, ready to render. */
export interface ReportTeaser {
  /** The finding's own title, e.g. "You enter too many pots". */
  title: string
  /** How many of `unit` it was drawn from. */
  sample: number
  /** What was counted, plural: "hands", "showdowns", "priced decisions". */
  unit: string
}

/**
 * What each finding's `sample` counts, by leak id.
 *
 * A leak's sample is not always hands — "you pay off too often" is drawn from
 * showdowns, "the river is where it goes" from priced decisions — and saying
 * "over 40 hands" about 40 showdowns would be a false number on a true line.
 * So a finding not named here is never teased: `tests/reportTeaser.test.ts`
 * fails if `deepRead` grows a leak this table has not been told about.
 */
const UNITS: Record<string, string> = {
  'too-loose': 'hands',
  'too-tight': 'hands',
  passive: 'calls, bets and raises',
  'over-aggressive': 'calls, bets and raises',
  'folds-to-pressure': 'bets faced',
  'cannot-fold': 'bets faced',
  'paying-off': 'showdowns',
  'too-selective-late': 'showdowns',
  'leaky-preflop': 'priced decisions',
  'leaky-flop': 'priced decisions',
  'leaky-turn': 'priced decisions',
  'leaky-river': 'priced decisions',
  'costly-calls': 'priced decisions',
  'costly-folds': 'priced decisions',
  'wrong-table': 'buy-ins',
  'trending-down': 'results',
}

/** The ids the teaser knows how to describe. Exported for the test. */
export const TEASABLE_LEAKS: readonly string[] = Object.keys(UNITS)

/** The unit a leak's sample counts, or null for one the teaser does not know. */
export function sampleUnit(leak: Pick<Leak, 'id'>): string | null {
  return UNITS[leak.id] ?? null
}

/** The report's top finding as one line, or null when there is no real one. */
export function reportTeaser(read: DeepRead): ReportTeaser | null {
  if (read.waitingFor || read.hands === null) return null
  const top = read.leaks[0]
  if (!top || top.sample <= 0) return null
  const unit = sampleUnit(top)
  if (!unit) return null
  return { title: top.title, sample: top.sample, unit }
}
