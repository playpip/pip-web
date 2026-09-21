'use client'

/**
 * One number, on the scale it lives on, with the typical range shaded behind
 * it.
 *
 * The report's whole problem was that it stated numbers with nowhere to put
 * them: "you fold to 71% of bets" is a fact that means nothing unless you
 * already know what a normal player does. The shaded range is the answer, and
 * it is **the same range the finding was reached on** — `BANDS` in
 * lib/deepCoach — so the marker can never sit inside the grey under a sentence
 * calling it a leak.
 *
 * **It says "typical", in that word** (Will, 2026-09-21). It used to read
 * "below the band · 40–75%", and the first question anybody asked of it was
 * "is the grey bit the average?" — which is a graphic that needed explaining,
 * so it was not working. The verdict is a word too, never a colour on its own:
 * "Too low", "Good", "Too high".
 */

import { motion } from 'framer-motion'
import type { LeakMetric } from '@/lib/deepCoach'
import { cn } from '@/lib/utils'

/** Draws when it is looked at, once. Same rule as the Roll graph. */
const IN_VIEW = { once: true, amount: 0.6 } as const

export type BandState = 'low' | 'in' | 'high'

export function bandState(metric: LeakMetric): BandState {
  if (metric.value < metric.band[0]) return 'low'
  if (metric.value > metric.band[1]) return 'high'
  return 'in'
}

const VERDICT: Record<BandState, string> = {
  low: 'Too low',
  in: 'Good',
  high: 'Too high',
}

export function BandMeter({ metric, className }: { metric: LeakMetric; className?: string }) {
  const [min, max] = metric.scale
  const span = max - min || 1
  /** Where a value sits on the track, 0–100. */
  const at = (n: number) => ((Math.min(max, Math.max(min, n)) - min) / span) * 100
  const state = bandState(metric)
  const show = (n: number) =>
    metric.unit === 'percent' ? `${Math.round(n * 100)}%` : `${n.toFixed(1)}bb`

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{metric.label}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tabular-nums">{show(metric.value)}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-2xs font-semibold',
              state === 'in'
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-suit-red/15 text-suit-red',
            )}
          >
            {VERDICT[state]}
          </span>
        </span>
      </div>
      {/* The range widens and the marker lands on it as the meter is scrolled
          to. It arrives from the left edge rather than fading in on the spot,
          so where it stopped is the thing you watched happen. */}
      <div className="relative mt-2.5 h-2 rounded-full bg-foreground/[0.06]">
        <motion.div
          className="absolute inset-y-0 origin-left rounded-full bg-foreground/20"
          style={{ left: `${at(metric.band[0])}%`, right: `${100 - at(metric.band[1])}%` }}
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={IN_VIEW}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
        <motion.div
          className={cn(
            // Centred with margins, not with `-translate-*`: Framer writes its
            // own `transform` for the scale below and would drop a Tailwind
            // translate, leaving the marker hanging off the track.
            'absolute top-1/2 size-3 rounded-full ring-2',
            'ring-background',
            state === 'in' ? 'bg-emerald-500' : 'bg-suit-red',
          )}
          style={{ marginLeft: '-0.375rem', marginTop: '-0.375rem' }}
          initial={{ left: '0%', opacity: 0, scale: 0.6 }}
          whileInView={{ left: `${at(metric.value)}%`, opacity: 1, scale: 1 }}
          viewport={IN_VIEW}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-2xs text-muted-foreground/80 tabular-nums">
        <span className="size-2 shrink-0 rounded-full bg-foreground/20" />
        Grey is typical: {show(metric.band[0])}–{show(metric.band[1])}
      </p>
    </div>
  )
}
