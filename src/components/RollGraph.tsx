'use client'

import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { RollPoint } from '@/store/profile'

// Chart geometry (viewBox units). Labels live outside the SVG so they never
// distort — the SVG is purely the smoothed line + gradient fill.
const W = 100
const H = 42
const PAD_Y = 4

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
 * The Roll over time — an iOS-Health-style smoothed area chart. Hand-rolled
 * SVG: gradient fill fading to transparent, no gridlines, a dot on "now".
 * Needs at least two points; the caller owns the empty state.
 */
export function RollGraph({ points, className }: { points: RollPoint[]; className?: string }) {
  const gradientId = useId()
  const reduced = useReducedMotion()

  const rolls = points.map((p) => p.roll)
  const min = Math.min(...rolls)
  const max = Math.max(...rolls)
  const span = max - min || 1 // flat history still draws a line

  const xy: XY[] = points.map((p, i) => ({
    x: points.length === 1 ? W / 2 : (i / (points.length - 1)) * W,
    y: H - PAD_Y - ((p.roll - min) / span) * (H - PAD_Y * 2),
  }))

  const line = smoothPath(xy)
  const area = `${line} L ${W} ${H} L 0 ${H} Z`
  const last = xy[xy.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-pip)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-pip)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#${gradientId})`}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.35 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--color-pip)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
      <motion.circle
        cx={last.x}
        cy={last.y}
        r="1.8"
        fill="var(--color-pip)"
        initial={reduced ? false : { opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: reduced ? 0 : 0.8, type: 'spring', stiffness: 400, damping: 20 }}
      />
    </svg>
  )
}
