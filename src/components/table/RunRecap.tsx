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
 *   This card is the one place in the game loop allowed to mention the
 *   membership: the run is over and no hand is live
 *   (`tests/membershipSurfaces.test.ts`).
 */

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Recap } from '@/lib/recap'
import { deepRead } from '@/lib/deepCoach'
import { reportTeaser } from '@/lib/review/teaser'
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

/** The top finding of the player's own report, or nothing. */
function ReportLine() {
  const router = useRouter()
  const tendencies = useProfile((s) => s.tendencies)
  const stats = useProfile((s) => s.stats)
  const venueRecords = useProfile((s) => s.venueRecords)
  const rollHistory = useProfile((s) => s.rollHistory)
  const reviewStats = useProfile((s) => s.reviewStats)
  const teaser = useMemo(
    () => reportTeaser(deepRead({ tendencies, stats, venueRecords, rollHistory, reviewStats })),
    [tendencies, stats, venueRecords, rollHistory, reviewStats],
  )
  if (!teaser) return null

  return (
    <div className="mt-4 border-t border-white/10 pt-4 text-left">
      <p className="text-2xs uppercase tracking-wider text-white/40">From your report</p>
      <p className="mt-1 text-sm font-medium text-white">{teaser.title}</p>
      <p className="mt-0.5 text-xs text-white/60">
        Counted over {teaser.sample.toLocaleString('en-GB')} {teaser.unit}.
      </p>
      <button
        type="button"
        onClick={() => {
          useGame.getState().leave()
          router.push(membershipFor('coaching'))
        }}
        className="mt-2 text-xs font-medium text-white/80 underline underline-offset-2 hover:text-white"
      >
        See your full report
      </button>
    </div>
  )
}
