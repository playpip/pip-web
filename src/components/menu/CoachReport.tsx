'use client'

/**
 * Your report — coaching across every hand you have played.
 *
 * `deepRead` is pure and does all the thinking; this is a layout and three
 * states. What it is *not*, any more, is three grey cards of prose (Will,
 * 2026-09-21): the findings were the same numbers `/stats` already shows,
 * restated as sentences, with nothing to put them next to and nothing to prove
 * them with. Three things fixed that, and they are the shape of this file:
 *
 * 1. **A number with somewhere to be.** Every finding that is a rate now draws
 *    on the band it was judged against (`BANDS`, lib/deepCoach), so "you fold
 *    to 71% of bets" arrives with what a normal player does, from the same
 *    constant the verdict used.
 * 2. **A number `/stats` cannot show.** Big blinds given up per hundred hands,
 *    split by street — counted at the moment each decision was made, not
 *    inferred from a rate afterwards (lib/review/stats).
 * 3. **The hands behind the claim.** "See the hands" replays the worst spots
 *    the finding actually happened in.
 *
 * The three states it can be in matter as much as the report itself:
 *
 * - **Not a member**: the page still exists and still explains itself, with
 *   your own hand count in it and one text link. No button, no CTA, nothing
 *   that follows you.
 * - **Not enough hands yet**: says so, and says how many. A paid screen that
 *   renders nothing is the worst thing on this list, and the easiest one to
 *   ship by accident.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, Lock } from 'lucide-react'
import { PageShell } from '@/components/PageShell'
import { Reveal } from '@/components/Reveal'
import { RollGraph } from '@/components/RollGraph'
import { useRequireProfile } from './useRequireProfile'
import { Splash } from '@/components/Splash'
import { Card, CardLabel } from '@/components/profile/bento'
import { BandMeter } from '@/components/profile/BandMeter'
import { SplitBar } from '@/components/profile/SplitBar'
import { RangePicker } from '@/components/profile/RangePicker'
import { StreetCosts } from '@/components/profile/StreetCosts'
import { EvidenceDialog } from '@/components/review/EvidenceDialog'
import { useProfile, type RollPoint } from '@/store/profile'
import { useEntitlement } from '@/store/entitlement'
import { type DeepRead, type Leak, deepRead } from '@/lib/deepCoach'
import type { EvidenceKey } from '@/lib/review/stats'
import { ROLL_RANGES, type RollRange, pointsInRange, rollTrend } from '@/lib/rollRange'
import { accentFromSwatch } from '@/lib/avatar'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

export function CoachReport() {
  const router = useRouter()
  const ready = useRequireProfile()
  const member = useEntitlement()
  const { tendencies, stats, venueRecords, rollHistory, reviewStats, avatar } = useProfile()

  if (!ready) return <Splash />

  const read = deepRead({ tendencies, stats, venueRecords, rollHistory, reviewStats })
  const accent = avatar ? accentFromSwatch(avatar.backgroundColor) : 'var(--color-pip)'

  return (
    // Back goes back, rather than to the lobby. The report is a page you arrive
    // at *from* somewhere — `/stats` or the session review — and a back arrow
    // that lands you on the menu instead of where you came from is the one
    // thing on a sub-screen that should never need thinking about. `/stats` is
    // the fallback for a cold open (a shared link, a restored tab), because it
    // is where the link into here lives.
    <PageShell leading="back" backLabel="Back" onBack={() => backOr(router, '/stats')}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-1 flex-col"
      >
        <header className="mb-6">
          <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">
            Every hand you have played
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Your report</h1>
          <p className="mt-1.5 max-w-2xl text-muted-foreground">
            Nothing here is a simulation of you — each line is a ratio of two things that were
            counted, and each one shows the sample it came from.{' '}
            <Link
              href="/game/review"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Or review your last session, hand by hand
            </Link>
            .
          </p>
        </header>

        {!member ? (
          <Locked hands={tendencies.handsDealt} />
        ) : read.waitingFor ? (
          <Card>
            <p className="font-medium">Not yet</p>
            <p className="mt-2 text-sm text-muted-foreground">{read.waitingFor}</p>
          </Card>
        ) : (
          <Report read={read} accent={accent} rollHistory={rollHistory} />
        )}
      </motion.div>
    </PageShell>
  )
}

function Locked({ hands }: { hands: number }) {
  return (
    <Card>
      <p className="flex items-center gap-2 font-medium">
        <Lock className="size-4" /> Your report comes with the membership.
      </p>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Pip has been counting since your first hand either way — you have played{' '}
        <span className="font-semibold text-foreground tabular-nums">{hands}</span>, and every one
        of them is already in here waiting. The read on each hand as you finish it stays free and
        always will.{' '}
        <Link href="/membership" className="underline underline-offset-2 hover:text-foreground">
          What the membership is
        </Link>
        .
      </p>
    </Card>
  )
}

function Report({
  read,
  accent,
  rollHistory,
}: {
  read: DeepRead
  accent: string
  rollHistory: ReturnType<typeof useProfile.getState>['rollHistory']
}) {
  // Findings share a row with each other, so a lone one is the row. Two sit
  // side by side; three or more wrap in halves. A card whose width depends on
  // how many siblings it has is the difference between a page and a pile.
  const leakSpan = read.leaks.length === 1 ? 'lg:col-span-6' : 'lg:col-span-3'

  return (
    // **One grid for the whole report, six columns wide.** Every card is a
    // whole number of them — 2, 3, 4 or 6 — so the edges line up down the page
    // and the gaps are one size. It was four separate grids before, each with
    // its own column count and its own gap, and the result was cards in five
    // widths that agreed with nothing above or below them.
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
      {/* the hero figure — the one number the whole screen is about */}
      <Reveal className="lg:col-span-2">
        <Card className="h-full">
          <CardLabel>It is costing you</CardLabel>
          {read.cost ? (
            <>
              <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums">
                {read.cost.bbPer100.toFixed(1)}
                <span className="ml-1.5 text-base font-medium text-muted-foreground">
                  big blinds per 100 hands
                </span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                At the calls and folds the pot put a price on. A big blind is the table's own unit
                of money — counting in them is what lets a hand at Friends' Garage and a hand at The
                Main Event mean the same thing here.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Not enough priced decisions yet. A call or a fold counts once the pot has charged you
              for it, so this fills up as you play — nothing you can do to hurry it.
            </p>
          )}
        </Card>
      </Reveal>

      {/* right and wrong, as one bar. The single most scannable thing here:
          which way the decisions lean, before a word has been read. */}
      <Reveal className="lg:col-span-4" delay={0.06}>
        <Card className="flex h-full flex-col">
          <div className="flex items-baseline justify-between gap-4">
            <CardLabel>Calls and folds</CardLabel>
            {read.cost && (
              <p className="text-xs text-muted-foreground/70 tabular-nums">
                {read.cost.right + read.cost.wrong} spots the price settled
              </p>
            )}
          </div>
          {read.cost ? (
            <div className="mt-auto pt-5">
              <SplitBar right={read.cost.right} wrong={read.cost.wrong} unknown={read.cost.close} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing to split yet — play a few more hands.
            </p>
          )}
        </Card>
      </Reveal>

      {read.streets.length > 0 && (
        <>
          <SectionHeading title="Where it goes" aside="Big blinds per 100 hands" />
          <Reveal className="lg:col-span-6">
            <Card>
              {/* The sentence first, the chart under it. Somebody who reads one
                  line and scrolls on has still been told the answer. */}
              <p className="text-lg font-semibold">
                Most of it goes on the{' '}
                <span className="text-suit-red">{read.streets[0].street}</span>.
              </p>
              <StreetCosts streets={read.streets} />
            </Card>
          </Reveal>
        </>
      )}

      <SectionHeading title="What is costing you" />

      {read.leaks.length > 0 ? (
        read.leaks.map((leak, i) => (
          <Reveal key={leak.id} className={leakSpan} delay={0.04 * (i % 2)}>
            <LeakCard leak={leak} />
          </Reveal>
        ))
      ) : (
        <Reveal className="lg:col-span-6">
          <Card>
            <p className="text-sm text-muted-foreground">
              Nothing in your numbers is far enough out to name. That is a good report.
            </p>
          </Card>
        </Reveal>
      )}

      {/* which way it is going — the verdict in words, the graph as evidence */}
      {rollHistory.length >= 2 && (
        <>
          <SectionHeading title="Which way it is going" />
          <Reveal className="lg:col-span-6">
            <RollCard points={rollHistory} accent={accent} />
          </Reveal>
        </>
      )}

      {read.strengths.length > 0 && (
        <>
          <SectionHeading title="What is working" />
          {/* The same meters, quieter. A strength is a number in the band, and
              showing it on the band is the only way that reads as anything
              other than a pat on the head. */}
          {read.strengths.map((s, i) => (
            <Reveal key={s.id} className="lg:col-span-2" delay={0.04 * i}>
              <Card className="h-full">
                <h3 className="text-sm font-semibold">{s.title}</h3>
                {s.metric ? (
                  <BandMeter className="mt-4" metric={s.metric} />
                ) : (
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.finding}</p>
                )}
              </Card>
            </Reveal>
          ))}
        </>
      )}

      {/* The small print, and it stays small print: what is measured, what is
          deliberately not, and in what unit. */}
      <p className="px-1 text-xs text-muted-foreground/80 lg:col-span-6">
        Drawn from {read.hands?.toLocaleString()} hands. Only calls and folds are graded — what
        makes a bet good is whether they fold, and that is a guess rather than a number. Measured in
        big blinds, so a hand at the Garage and a hand at the Main Event count the same.
      </p>
    </div>
  )
}

/** A row of the grid that is only a label — the page's one heading style. */
function SectionHeading({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-1 pt-2 lg:col-span-6">
      <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{title}</h2>
      {aside && <p className="text-xs text-muted-foreground/70 tabular-nums">{aside}</p>}
    </div>
  )
}

/**
 * One finding: the number, the band it was judged on, what to do, and — when
 * there are hands kept for it — the hands themselves.
 */
function LeakCard({ leak }: { leak: Leak }) {
  const evidence = useProfile((s) => s.reviewStats.evidence)
  const [open, setOpen] = useState(false)
  const hands = leak.evidence ? (evidence[leak.evidence as EvidenceKey] ?? []) : []

  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-2xl border p-5',
        leak.severity === 'costly'
          ? 'border-foreground/25 bg-foreground/[0.05]'
          : 'border-foreground/10 bg-foreground/[0.02]',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">{leak.title}</h3>
        {/* The sample, next to the claim, always. A finding without one is a
            confident sentence about nothing. */}
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{leak.sample}</span>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{leak.finding}</p>
      {leak.metric && <BandMeter className="mt-4" metric={leak.metric} />}
      <p className="mt-3 text-sm">{leak.advice}</p>

      {hands.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline underline-offset-4 transition hover:text-foreground"
          >
            See the {hands.length === 1 ? 'hand' : `${hands.length} hands`}
            <ArrowRight className="size-3.5" />
          </button>
          <EvidenceDialog open={open} onOpenChange={setOpen} title={leak.title} hands={hands} />
        </>
      )}
    </article>
  )
}

/**
 * Step back through history, or to `fallback` when there is none.
 *
 * `router.back()` on a tab opened straight onto this URL does nothing at all,
 * which is a back button that looks broken. One entry in the history means
 * this page is the only thing in it.
 */
function backOr(router: ReturnType<typeof useRouter>, fallback: string) {
  if (window.history.length > 1) router.back()
  else router.push(fallback)
}

/**
 * The Roll, over a span you pick.
 *
 * **The sentence is computed from what is drawn, not from the career.** Pick
 * seven days and the line reads the last seven days — a verdict about a year,
 * sitting over a chart of a week, is the one way a control like this can lie.
 *
 * `now` is frozen once per mount rather than read on every render, so the
 * picker, the filter and the sentence all agree about where the window ends.
 */
function RollCard({ points, accent }: { points: RollPoint[]; accent: string }) {
  const money = useMoney()
  const [now] = useState(() => Date.now())
  // Opens on everything, because that is the span that always has something in
  // it. Narrowing is a choice the player makes; a default that lands on an
  // empty week would be the app choosing badly on their behalf.
  const [range, setRange] = useState<RollRange>(ROLL_RANGES[ROLL_RANGES.length - 1])
  const shown = useMemo(() => pointsInRange(points, range, now), [points, range, now])

  const trend = rollTrend(shown)
  const line =
    trend === 'up'
      ? 'Your Roll is heading up.'
      : trend === 'down'
        ? 'Your Roll is heading down.'
        : 'Your Roll is holding about level.'

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-lg font-semibold">{line}</p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {shown.length} {shown.length === 1 ? 'result' : 'results'} · Roll now{' '}
            {money(points[points.length - 1].roll)}
          </p>
        </div>
        <RangePicker points={points} now={now} value={range} onPick={setRange} />
      </div>
      {shown.length >= 2 ? (
        // Keyed on the span so switching redraws the line rather than snapping
        // to the new shape.
        <RollGraph
          key={range.id}
          points={shown}
          format={money}
          className="h-40 w-full"
          accent={accent}
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl bg-foreground/[0.03]">
          <p className="text-sm text-muted-foreground">Nothing recorded in this span.</p>
        </div>
      )}
    </Card>
  )
}
