'use client'

import { useId } from 'react'
import type { RollPoint } from '@/store/profile'

type XY = { x: number; y: number }

/** Catmull-Rom through the points, emitted as cubic beziers — the soft iOS curve. */
function smoothPath(pts: XY[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`
  }
  return d
}

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
