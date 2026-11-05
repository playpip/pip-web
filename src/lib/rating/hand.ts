// One finished hand in, its rated decisions out (docs/rating.md → "What
// counts"). The game store and `pnpm rating-calibrate` both call this, so the
// calibration measures exactly what the table rates.

import type { GradedDecision } from '@/lib/review/grade'
import type { HandRecord } from '@/store/game'
import { MAX_DECISIONS_PER_HAND, ratedLoss, ratedStake, ratingKindOf } from './index'
import type { RatedDecision } from './local'
import { gradeFirstIn } from './preflop'

/**
 * The hand's rated decisions, in the order they were made: the first move when
 * it folded round to the hero (off the charts, lib/rating/preflop), then every
 * graded call or fold facing a bet. A first-in move is never also priced as a
 * call or fold: a limp or a fold there is the chart's question, not the pot's.
 */
export function ratedDecisionsOf(
  record: HandRecord,
  graded: readonly GradedDecision[],
): RatedDecision[] {
  const bigBlind = record.bigBlind
  const out: RatedDecision[] = []
  const firstInAt = new Set<number>()
  record.events.forEach((ev, i) => {
    if (ev.kind !== 'action' || !ev.decision?.firstIn) return
    firstInAt.add(i)
    const hole = record.reveals.find((r) => r.playerId === ev.playerId)?.cards ?? []
    const grade = gradeFirstIn(
      hole,
      ev.decision.firstIn,
      { type: ev.type, amount: ev.amount },
      bigBlind,
    )
    if (grade) out.push(grade)
  })
  for (const d of graded) {
    if (firstInAt.has(d.eventIndex)) continue
    out.push({ kind: ratingKindOf(d), loss: ratedLoss(d), stake: ratedStake(d, bigBlind) })
  }
  return out.filter((d) => d.stake >= 1).slice(0, MAX_DECISIONS_PER_HAND)
}
