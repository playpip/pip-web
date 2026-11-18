'use client'

// The player's own top finding, under the membership page's headline
// (cmo#252, 2026-11-18).
//
// The page sells getting better, and the strongest case for it is the thing
// the report has already found in this player's play. The same line as the
// end-of-run card (`lib/review/teaser`): the report's own top leak and its
// sample, and what the rest of the report holds. Nothing for a member, and
// nothing when the report has nothing to say yet.

import { useMemo } from 'react'
import { deepRead } from '@/lib/deepCoach'
import { heldBack, reportTeaser } from '@/lib/review/teaser'
import { useHydrated } from '@/lib/useHydrated'
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'

export function YourFinding() {
  const hydrated = useHydrated()
  const member = useEntitlement()
  const tendencies = useProfile((s) => s.tendencies)
  const stats = useProfile((s) => s.stats)
  const venueRecords = useProfile((s) => s.venueRecords)
  const rollHistory = useProfile((s) => s.rollHistory)
  const reviewStats = useProfile((s) => s.reviewStats)
  const teaser = useMemo(
    () => reportTeaser(deepRead({ tendencies, stats, venueRecords, rollHistory, reviewStats })),
    [tendencies, stats, venueRecords, rollHistory, reviewStats],
  )
  if (!hydrated || member || !teaser) return null

  return (
    <div className="mt-6 w-full max-w-xl rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-4">
      <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
        From your report
      </p>
      <p className="mt-1 text-base font-semibold">{teaser.title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Counted over {teaser.sample.toLocaleString('en-GB')} {teaser.unit}.
        {(teaser.more > 0 || teaser.costBb100 !== null) && ` ${heldBack(teaser)}`}
      </p>
    </div>
  )
}
