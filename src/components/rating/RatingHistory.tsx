'use client'

// A member's Pip Rating, drawn day by day: a soft line over the days played,
// with the first and last values written at either end.

import { useId } from 'react'
import type { RatingPoint } from '@/lib/rating/local'

/** "4 Nov" from a UTC day key. */
function dayLabel(key: string): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function RatingHistory({ points }: { points: RatingPoint[] }) {
  const id = useId()
  const data = points.slice(-60)
  if (data.length < 2) {
    return (
      <p className="rounded-2xl bg-foreground/[0.03] p-4 text-sm text-muted-foreground">
        Your graph starts on your second day of rated hands.
      </p>
    )
  }
  const W = 320
  const H = 120
  const PAD = 10
  const values = data.map((p) => p.rating)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => PAD + (i / (data.length - 1)) * (W - 2 * PAD)
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD)
  const line = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.rating)}`).join(' ')
  const area = `${line} L ${x(data.length - 1)} ${H} L ${x(0)} ${H} Z`
  const last = data[data.length - 1]
  return (
    <figure className="rounded-2xl bg-foreground/[0.03] p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-32 w-full"
        role="img"
        aria-label="Your Pip Rating by day"
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-pip)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-pip)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--color-pip)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={x(data.length - 1)} cy={y(last.rating)} r="4" fill="var(--color-pip)" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-2xs text-muted-foreground tabular-nums">
        <span>{dayLabel(data[0].date)}</span>
        <span>
          Low {min.toLocaleString('en-GB')} · High {max.toLocaleString('en-GB')}
        </span>
        <span>{dayLabel(last.date)}</span>
      </figcaption>
    </figure>
  )
}
