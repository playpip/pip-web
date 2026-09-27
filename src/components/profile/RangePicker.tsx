'use client'

/**
 * How far back the Roll graph looks.
 *
 * Four plain segments, the shape the drills' mode switch already uses, so a
 * toggle means the same thing everywhere in the app.
 *
 * **A span with nothing in it is disabled, not hidden.** A player two weeks
 * into Pip who sees "7 days · 30 days · 90 days · All time" and finds two of
 * them dead knows why; the same player who sees the row change shape as they
 * play has a control that moves under them. Two points is the threshold,
 * because one point is not a line.
 */

import { ROLL_RANGES, type RollRange, rangeHasEnough } from '@/lib/rollRange'
import type { RollPoint } from '@/store/profile'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

export function RangePicker({
  points,
  now,
  value,
  onPick,
  className,
}: {
  points: readonly RollPoint[]
  /** Passed in so the picker and the graph agree on when "now" is. */
  now: number
  value: RollRange
  onPick: (range: RollRange) => void
  className?: string
}) {
  return (
    <fieldset className={cn('flex gap-1', className)}>
      {/* `sr-only` is absolute, so the legend names the group for a screen
          reader without taking a slot in the row. Same shape the drills' mode
          switch uses. */}
      <legend className="sr-only">How far back the graph looks</legend>
      {ROLL_RANGES.map((range) => {
        const enough = rangeHasEnough(points, range, now)
        const on = range.id === value.id
        return (
          <button
            key={range.id}
            type="button"
            disabled={!enough}
            aria-pressed={on}
            onClick={() => {
              sound.play('tap')
              onPick(range)
            }}
            className={cn(
              'rounded-full px-2.5 py-1 text-2xs font-medium transition',
              on
                ? 'bg-foreground/[0.08] text-foreground'
                : 'text-muted-foreground hover:text-foreground',
              !enough && 'pointer-events-none opacity-30',
            )}
          >
            {range.label}
          </button>
        )
      })}
    </fieldset>
  )
}
