'use client'

// How close a free player is to their one free report (Will, 2026-11-04).
//
// Most players visit once. The free report (lib/membership/freeReport) is a
// real reason to come back, but until now nothing on the lobby said it was
// coming: a player met it only at the end of a run or by finding the report
// page. This is a small card above the MembershipCard that counts the hands.
//
// Furniture on the same terms as that card (docs/membership.md, invited versus
// uninvited): on the lobby, never over anything, nothing to dismiss. Counted in
// the same `tendencies.handsDealt` the report waits on, never another number.
// Absent for members, before the first hand, and once the report is open or
// used. Tapping it goes to the report page, which explains the wait itself.

import { useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronRight, FileText } from 'lucide-react'
import {
  FREE_REPORT_COPY,
  type FreeReportProgress,
  freeReportProgress,
} from '@/lib/membership/freeReport'
import { trackOnce } from '@/lib/analytics'
import { useFreeReport } from '@/lib/useFreeReport'
import { useMembership } from '@/store/entitlement'
import { sound } from '@/lib/sound'

export function FreeReportCard({ delay = 0 }: { delay?: number }) {
  const free = useFreeReport()
  const notMember = useMembership((s) => s.checked && !s.member)
  const progress = free.ready && notMember ? freeReportProgress(free.state, free.hands) : null
  if (!progress) return null
  return <Card progress={progress} delay={delay} />
}

function Card({ progress, delay }: { progress: FreeReportProgress; delay: number }) {
  useEffect(() => trackOnce('free-report-progress-seen'), [])
  const ready = progress.kind === 'ready'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <Link
        href="/game/report"
        onClick={() => {
          sound.play('tap')
          trackOnce('free-report-progress-tapped')
        }}
        className="group relative isolate flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99] md:gap-5"
      >
        {ready && (
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 top-1/2 -z-10 size-56 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-pip)_18%,transparent),transparent_65%)] blur-2xl"
          />
        )}
        <HandsDial progress={progress} />
        <div className="min-w-0 flex-1 text-left">
          <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            {FREE_REPORT_COPY.progress}
          </span>
          {progress.kind === 'counting' ? (
            <p className="mt-0.5 text-base font-semibold tabular-nums">
              {progress.hands} of {progress.of} hands
            </p>
          ) : progress.kind === 'almost' ? (
            <>
              <p className="mt-0.5 text-base font-semibold">{FREE_REPORT_COPY.almost}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{FREE_REPORT_COPY.almostLine}</p>
            </>
          ) : (
            <p className="mt-0.5 text-base font-semibold">{FREE_REPORT_COPY.ready}</p>
          )}
        </div>
        {ready ? (
          <span className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/20 transition group-hover:bg-primary/90">
            Read it
            <ChevronRight className="size-4" />
          </span>
        ) : (
          <ChevronRight className="size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
        )}
      </Link>
    </motion.div>
  )
}

/** A chip-sized dial: hands towards the report, or a full ring once it is ready. */
function HandsDial({ progress }: { progress: FreeReportProgress }) {
  const r = 22
  const length = 2 * Math.PI * r
  // Only a count is drawn as progress. Past the line the ring is left empty
  // rather than filled towards a number already passed.
  const through =
    progress.kind === 'counting' ? progress.hands / progress.of : progress.kind === 'ready' ? 1 : 0
  return (
    <span className="relative grid size-14 shrink-0 place-items-center rounded-full bg-foreground/[0.05] shadow-inner shadow-black/30 ring-1 ring-foreground/10">
      <svg viewBox="0 0 56 56" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="4"
          className="stroke-foreground/10"
        />
        {through > 0 && (
          <motion.circle
            cx="28"
            cy="28"
            r={r}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            className="stroke-pip"
            strokeDasharray={length}
            initial={{ strokeDashoffset: length }}
            animate={{ strokeDashoffset: length * (1 - through) }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
          />
        )}
      </svg>
      <FileText
        className={progress.kind === 'ready' ? 'size-5 text-pip' : 'size-5 text-muted-foreground'}
        aria-hidden
      />
    </span>
  )
}
