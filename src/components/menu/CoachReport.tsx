'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { SectionScreen } from './SectionScreen'
import { useRequireProfile } from './useRequireProfile'
import { Splash } from '@/components/Splash'
import { useProfile } from '@/store/profile'
import { useEntitlement } from '@/store/entitlement'
import { type Leak, deepRead } from '@/lib/deepCoach'
import { cn } from '@/lib/utils'

/**
 * Your report — coaching across every hand you have played.
 *
 * The screen deliberately does almost nothing: `deepRead` is pure and does all
 * the thinking, so what is here is a list and two states. The two states are
 * the point, though:
 *
 * - **Not a member**: the page still exists and still explains itself. It shows
 *   how many hands you have played, because that is your number and not ours,
 *   and one text link. No button, no CTA, nothing that follows you.
 * - **Not enough hands yet**: says so, and says how many. A paid screen that
 *   renders nothing is the worst thing on this list, and it is the easiest one
 *   to ship by accident.
 */
export function CoachReport() {
  const ready = useRequireProfile()
  const member = useEntitlement()
  const { tendencies, stats, venueRecords, rollHistory } = useProfile()

  if (!ready) return <Splash />

  const read = deepRead({ tendencies, stats, venueRecords, rollHistory })

  return (
    <SectionScreen
      title="Your report"
      subtitle="What every hand you have played says about how you play. Nothing here is a simulation — each line is a ratio of two things that were counted."
    >
      {!member ? (
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5">
          <p className="flex items-center gap-2 font-medium">
            <Lock className="size-4" /> Your report comes with the membership.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Pip has been counting since your first hand either way — you have played{' '}
            <span className="font-semibold text-foreground tabular-nums">
              {tendencies.handsDealt}
            </span>
            . The read on each hand as you finish it stays free and always will.{' '}
            <Link href="/membership" className="underline underline-offset-2 hover:text-foreground">
              What the membership is
            </Link>
            .
          </p>
        </div>
      ) : read.waitingFor ? (
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5">
          <p className="font-medium">Not yet</p>
          <p className="mt-2 text-sm text-muted-foreground">{read.waitingFor}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <p className="text-sm text-muted-foreground">
            Drawn from{' '}
            <span className="font-semibold text-foreground tabular-nums">{read.hands}</span> hands.
          </p>

          {read.leaks.length > 0 && <Group title="What is costing you" items={read.leaks} />}
          {read.strengths.length > 0 && (
            <Group title="What is working" items={read.strengths} muted />
          )}
          {read.leaks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing in your numbers is far enough out to name. That is a good report.
            </p>
          )}
        </div>
      )}
    </SectionScreen>
  )
}

function Group({ title, items, muted }: { title: string; items: Leak[]; muted?: boolean }) {
  return (
    <section>
      <h2 className="mb-3 text-xs uppercase tracking-[0.15em] text-muted-foreground">{title}</h2>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <article
            key={item.id}
            className={cn(
              'rounded-2xl border p-4',
              muted
                ? 'border-foreground/10 bg-foreground/[0.02]'
                : item.severity === 'costly'
                  ? 'border-foreground/25 bg-foreground/[0.05]'
                  : 'border-foreground/10 bg-foreground/[0.03]',
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold">{item.title}</h3>
              {/* The sample, next to the claim, always. A finding without one is
                  a confident sentence about nothing. */}
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {item.sample}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.finding}</p>
            {!muted && <p className="mt-2 text-sm">{item.advice}</p>}
          </article>
        ))}
      </div>
    </section>
  )
}
