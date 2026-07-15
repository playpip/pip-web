'use client'

import { useId, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { RollPoint } from '@/store/profile'
import { cn } from '@/lib/utils'

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

const shortDate = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/**
 * The Roll over time — an iOS-Health-style smoothed area chart. Hand-rolled
 * SVG: gradient fill fading to transparent, no gridlines, a dot on every
 * recorded point. Hover (or tap on touch) scrubs to the nearest point and
 * reveals its figure. Needs at least two points; the caller owns the empty state.
 */
export function RollGraph({
  points,
  className,
  format = (n) => n.toLocaleString(),
}: {
  points: RollPoint[]
  className?: string
  format?: (n: number) => string
}) {
  const gradientId = useId()
  const reduced = useReducedMotion()
  const [active, setActive] = useState<number | null>(null)

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
  const lastIndex = points.length - 1

  // Map a pointer's horizontal position to the nearest recorded point.
  const scrubTo = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setActive(Math.round(frac * (points.length - 1)))
  }

  const activePt = active !== null ? points[active] : null
  const activeXY = active !== null ? xy[active] : null

  // Keep the tooltip inside the box: anchor it left/right near the edges.
  const align =
    activeXY && activeXY.x < 18 ? 'left' : activeXY && activeXY.x > 82 ? 'right' : 'center'

  return (
    // The dots live as HTML overlays, not SVG <circle>s: under
    // preserveAspectRatio="none" a circle scales into a clipped ellipse. As
    // divs they stay perfectly round however the box is stretched.
    <div className={cn('relative', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-pip)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-pip)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* NOTE: no pathLength draw animation here — Framer's dasharray trick
            fights vector-effect:non-scaling-stroke under non-uniform scaling
            (preserveAspectRatio="none") and leaves the line visibly dashed. */}
        <motion.g
          initial={reduced ? false : { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke="var(--color-pip)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </motion.g>
      </svg>

      {/* a small dot on every recorded point; the latest is emphasised */}
      {xy.map((p, i) =>
        i === lastIndex || i === active ? null : (
          <span
            key={i}
            className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pip/45"
            style={{ left: `${p.x}%`, top: `${(p.y / H) * 100}%` }}
          />
        ),
      )}

      {/* the "now" dot */}
      <motion.span
        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pip ring-2 ring-background"
        style={{ left: `${xy[lastIndex].x}%`, top: `${(xy[lastIndex].y / H) * 100}%` }}
        initial={reduced ? false : { opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: reduced ? 0 : 0.45, type: 'spring', stiffness: 400, damping: 20 }}
      />

      {/* active point: guide line, emphasised dot, and the figure */}
      {activePt && activeXY && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-foreground/15"
            style={{ left: `${activeXY.x}%` }}
          />
          <span
            className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pip ring-2 ring-background"
            style={{ left: `${activeXY.x}%`, top: `${(activeXY.y / H) * 100}%` }}
          />
          <div
            className="pointer-events-none absolute"
            style={{ left: `${activeXY.x}%`, top: `${(activeXY.y / H) * 100}%` }}
          >
            <div
              className={cn(
                'absolute bottom-full mb-2 whitespace-nowrap rounded-lg border border-foreground/10 bg-background px-2.5 py-1.5 text-center shadow-sm',
                align === 'center' && 'left-1/2 -translate-x-1/2',
                align === 'left' && 'left-0',
                align === 'right' && 'right-0',
              )}
            >
              <div className="text-sm font-semibold tabular-nums leading-none">
                {format(activePt.roll)}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{shortDate(activePt.t)}</div>
            </div>
          </div>
        </>
      )}

      {/* pointer capture layer — hover on desktop, tap/drag on touch */}
      <div
        className="absolute inset-0 cursor-crosshair touch-pan-y"
        onPointerMove={scrubTo}
        onPointerDown={scrubTo}
        onPointerLeave={() => setActive(null)}
      />
    </div>
  )
}
