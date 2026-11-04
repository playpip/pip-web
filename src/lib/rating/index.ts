// The Pip Rating on the device (docs/rating.md).
//
// The arithmetic is `supabase/functions/_shared/rating.ts`, shared with the
// `submit-rating` Edge Function so the number on the device and the number on
// the board come from one rule. This file is the bridge from Pip's existing
// pricing to that rule: which decisions count, what each one cost, and which
// kind it was.

import type { GradedDecision } from '@/lib/review/grade'
import { decisionLoss, type RatingKind } from '../../../supabase/functions/_shared/rating'

export * from '../../../supabase/functions/_shared/rating'

/**
 * What one priced call or fold cost the rating, in big blinds.
 *
 * The chips it gave up against the other choice, from the same pricing the
 * read and the report use, and nothing for a decision that was right. A spot
 * inside the noise floor (`close`) costs nothing either: the estimate cannot
 * say which way it went, so it does not get to say what it cost.
 */
export function ratedLoss(d: Pick<GradedDecision, 'grade' | 'bb'>): number {
  if (d.grade === 'close') return 0
  return decisionLoss(-d.bb)
}

/** "flop-call", "river-fold": which of the eight kinds this decision was. */
export function ratingKindOf(d: Pick<GradedDecision, 'street' | 'folded'>): RatingKind {
  return `${d.street}-${d.folded ? 'fold' : 'call'}`
}

/** What one decision weighs: the big blinds in the pot it was made in, price included. */
export function ratedStake(d: Pick<GradedDecision, 'pot' | 'toCall'>, bigBlind: number): number {
  return bigBlind > 0 ? (d.pot + d.toCall) / bigBlind : 0
}

/**
 * The band a rating sits in, named plainly. Not venue names: the calibration
 * (docs/rating.md) found the ladder's regulars do not rate in ladder order, so
 * "plays like the Penthouse" would be a claim the numbers do not back. Nor the
 * Roll's titles in config/ranks.ts, which measure something else.
 */
export const RATING_BANDS = [
  { name: 'Learning', min: 0 },
  { name: 'Steady', min: 800 },
  { name: 'Solid', min: 1200 },
  { name: 'Strong', min: 1600 },
  { name: 'Expert', min: 2000 },
  { name: 'Master', min: 2400 },
] as const

export function bandFor(rating: number): string {
  let name: string = RATING_BANDS[0].name
  for (const band of RATING_BANDS) if (rating >= band.min) name = band.name
  return name
}
