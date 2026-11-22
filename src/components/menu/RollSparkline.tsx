'use client'

import { useId } from 'react'
import type { RollPoint } from '@/store/profile'
import { smoothPath, type XY } from '@/lib/smoothPath'

/**
 * A tiny area sparkline of the recent Roll — the "living" pulse under the
 * balance on the home screen. Stretches to fill its box (non-scaling stroke so
 * the line stays crisp at any width); drawn in the player's own accent to match
 * the stats charts. Returns null with fewer than two points — there's no story
 * to tell yet.
 */
export function RollSparkline({
  points,
  accent,
  className,
}: {
  points: RollPoint[]
  accent: string
  className?: string
}) {
  const id = useId()
  const data = points.slice(-16)
  if (data.length < 2) return null

  const W = 100
  const H = 28
  const PAD = 3
  const rolls = data.map((p) => p.roll)
  const min = Math.min(...rolls)
  const max = Math.max(...rolls)
  const span = max - min || 1
  const x = (i: number) => (i / (data.length - 1)) * W
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD)

  const pts = data.map((p, i) => ({ x: x(i), y: y(p.roll) }))
  const line = smoothPath(pts)
  const area = `${line} L ${W} ${H} L 0 ${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={accent}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
