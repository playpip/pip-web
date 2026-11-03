'use client'

/**
 * The recap card on the end-of-tournament overlay. Presentation only: every
 * number and every sentence is built by `lib/recap` at the moment the run
 * ended, and this renders what it was given.
 *
 * Deliberately quiet. No "play again", nothing asking for tomorrow. The buttons
 * underneath already offer the only two things to do.
 *
 * Two exceptions, both static lines at the foot of the card that closing the
 * overlay is the only thing anyone has to do about:
 *
 * - The account offer, for a player who has not made one (Will, #97). This is
 *   the moment the run they just finished is worth keeping.
 * - **One line of the report**, for a non-member whose report has something to
 *   say (2026-10-07). It is the report's own top finding and its sample
 *   (`lib/review/teaser`), never written here, and absent when there is none.
 *   Since 2026-11-02 its button opens their one free report while that is
 *   ready (lib/membership/freeReport), and goes to the membership after.
 *   This card is the one place in the game loop allowed to mention the
 *   membership: the run is over and no hand is live
 *   (`tests/membershipSurfaces.test.ts`).
 */

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import type { Recap } from '@/lib/recap'
import { deepRead } from '@/lib/deepCoach'
import { reportTeaser } from '@/lib/review/teaser'
import { FREE_REPORT_COPY, freeReportState } from '@/lib/membership/freeReport'
import { dailyDateKey } from '@/lib/daily'
import { cn } from '@/lib/utils'
import { AccountOffer } from '@/components/settings/AccountOffer'
import { membershipFor } from '@/config/membership'
import { useGame } from '@/store/game'
import { useProfile } from '@/store/profile'

export function RunRecap({
  recap,
  member,
  accountOffer = true,
}: {
  recap: Recap
  member: boolean
  /** Off at the Welcome Table, whose next screen is the account. */
  accountOffer?: boolean
}) {
  return (
    <div className="mx-auto mt-6 w-full max-w-sm rounded-3xl bg-white/5 p-5">
      {/* The overlay is always dark, so this block is on white alphas rather
          than theme tokens, matching the buttons and copy around it. */}
      <div className="grid grid-cols-3 gap-2">
        {recap.stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-2xs uppercase tracking-wider text-white/40">{s.label}</div>
            <div className="mt-1 font-semibold text-white">{s.value}</div>
          </div>
        ))}
      </div>
      {recap.lines.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
          {recap.lines.map((line) => (
            <p key={line.id} className="text-left text-xs leading-relaxed text-white/70">
              {line.text}
            </p>
          ))}
        </div>
      )}
      {!member && <ReportLine />}
      {accountOffer && <AccountOffer variant="overlay" />}
    </div>
  )
}

/**
 * The player's own report, at the foot of the card: its top finding, and a
 * button to the rest.
 *
 * While their one free report (lib/membership/freeReport) is ready or open
 * today, the button opens it. Once it is used, the button goes to the
 * membership, as it always did. Nothing here is written for the card: the
 * line is the report's own, and the free report is the report itself.
 */
function ReportLine() {
  const router = useRouter()
  const tendencies = useProfile((s) => s.tendencies)
  const stats = useProfile((s) => s.stats)
  const venueRecords = useProfile((s) => s.venueRecords)
  const rollHistory = useProfile((s) => s.rollHistory)
  const reviewStats = useProfile((s) => s.reviewStats)
  const record = useProfile((s) => s.freeReport)
  const { teaser, free } = useMemo(() => {
    const read = deepRead({ tendencies, stats, venueRecords, rollHistory, reviewStats })
    return { teaser: reportTeaser(read), free: freeReportState(record, dailyDateKey(), read) }
  }, [tendencies, stats, venueRecords, rollHistory, reviewStats, record])
  const yours = free === 'ready' || free === 'open'
  if (!teaser && !yours) return null

  return (
    <div className="mt-4 border-t border-white/10 pt-4 text-left">
      {teaser && (
        <>
          <p className="text-2xs uppercase tracking-wider text-white/40">From your report</p>
          <p className="mt-1 text-sm font-medium text-white">{teaser.title}</p>
          <p className="mt-0.5 text-xs text-white/60">
            Counted over {teaser.sample.toLocaleString('en-GB')} {teaser.unit}.
          </p>
        </>
      )}
      <button
        type="button"
        onClick={() => {
          useGame.getState().leave()
          router.push(yours ? '/game/report' : membershipFor('coaching'))
        }}
        className={cn(
          'mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-medium text-white transition active:scale-[0.98]',
          yours
            ? 'bg-white/15 ring-1 ring-white/25 ring-inset hover:bg-white/20'
            : 'border border-white/20 hover:bg-white/10',
        )}
      >
        {free === 'ready'
          ? FREE_REPORT_COPY.ready
          : free === 'open'
            ? FREE_REPORT_COPY.open
            : 'See your full report'}
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
