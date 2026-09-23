'use client'

import { useId, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import type { RollPoint } from '@/store/profile'
import { cn } from '@/lib/utils'

// Chart geometry (viewBox units). Labels live outside the SVG so they never
// distort — the SVG is purely the smoothed line + gradient fill.
const W = 100
const H = 42
const PAD_Y = 4

/** How long the line takes to draw itself; the dots land as it passes them. */
const DRAW_S = 1

/**
 * The line draws when the chart is *looked at*, not when it mounts.
 *
 * On `/stats` the graph is above the fold and the two are the same moment. On
 * the report it is most of a page down, and a chart that drew itself while it
 * was off-screen is a chart you only ever meet already finished.
 *
 * **Driven by `useInView` and a plain `animate`, not by `whileInView`.** The
 * declarative version left the wipe shut — the element kept
 * `clip-path: inset(0 100% 0 0)` and the line and the fill never appeared at
 * all, so the chart rendered as a scatter of loose dots (Will, 2026-09-21).
 * One observer, read once, and every animation on the chart keys off the same
 * boolean.
 */
const IN_VIEW = { once: true, amount: 0.3 } as const

/** Points beyond which a dot each stops being punctuation and becomes noise. */
const MAX_DOTS = 40

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
 *
 * Evenly spaced by result, as it always has been: the Roll is sampled once per
 * result, so the index is the axis. The drawing itself is {@link LineGraph}.
 */
export function RollGraph({
  points,
  className,
  format = (n) => n.toLocaleString(),
  accent = 'var(--color-pip)',
}: {
  points: RollPoint[]
  className?: string
  format?: (n: number) => string
  /** Line, fill glow and dot colour. Defaults to the pip accent. */
  accent?: string
}) {
  return (
    <LineGraph
      points={points.map((p, i) => ({ x: i, y: p.roll }))}
      caption={(i) => shortDate(points[i].t)}
      className={className}
      format={format}
      accent={accent}
    />
  )
}

/** One point in the data's own units. `x` only has to increase. */
export interface GraphPoint {
  x: number
  y: number
}

/**
 * The chart under {@link RollGraph}, over any x that increases.
 *
 * Lifted out for the drill ratings, whose axis is spots answered and whose
 * points are not evenly spaced once the history has been thinned: each point is
 * drawn at its own `x`, so a thinned stretch reads as the same distance it
 * covered rather than being squeezed together.
 *
 * `compact` is the sparkline: the same line and fill, only the "now" dot, and
 * no scrubbing, because a graph two lines tall is read at a glance or not at
 * all.
 */
export function LineGraph({
  points,
  caption,
  className,
  format = (n) => n.toLocaleString(),
  accent = 'var(--color-pip)',
  minSpan = 0,
  compact = false,
}: {
  points: GraphPoint[]
  /** The small line under the figure when a point is scrubbed to. */
  caption?: (index: number) => string
  className?: string
  format?: (n: number) => string
  accent?: string
  /**
   * The least vertical range the chart draws, in the data's units, centred on
   * the data. Without it a line that barely moved is stretched to the full
   * height and three points of wobble look like a cliff.
   */
  minSpan?: number
  /** A sparkline: no dots but the last, no scrub. */
  compact?: boolean
}) {
  const gradientId = useId()
  const reduced = useReducedMotion()
  const box = useRef<HTMLDivElement>(null)
  const seen = useInView(box, IN_VIEW)
  const [active, setActive] = useState<number | null>(null)
  const tint = (pct: number) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`

  const ys = points.map((p) => p.y)
  const lowY = Math.min(...ys)
  const highY = Math.max(...ys)
  const pad = Math.max(0, minSpan - (highY - lowY)) / 2
  const min = lowY - pad
  const span = highY + pad - min || 1 // flat history still draws a line

  const firstX = points[0]?.x ?? 0
  const spanX = (points[points.length - 1]?.x ?? 0) - firstX
  const xy: XY[] = points.map((p) => ({
    x: spanX > 0 ? ((p.x - firstX) / spanX) * W : W / 2,
    y: H - PAD_Y - ((p.y - min) / span) * (H - PAD_Y * 2),
  }))

  // A dot per recorded point is a nice texture over twenty results and a wall
  // of ink over three hundred — at which point the dots *are* the chart and the
  // line they are meant to punctuate disappears behind them (Will,
  // 2026-09-21). Past the threshold the line stands on its own and only the
  // "now" dot stays, which is the one that means something.
  const showDots = !compact && points.length <= MAX_DOTS
  const line = smoothPath(xy)
  const area = `${line} L ${W} ${H} L 0 ${H} Z`
  const lastIndex = points.length - 1

  // Map a pointer's horizontal position to the nearest drawn point. By drawn
  // position rather than by index, because the points need not be evenly spaced.
  const scrubTo = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const at = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * W
    let nearest = 0
    for (let i = 1; i < xy.length; i++) {
      if (Math.abs(xy[i].x - at) < Math.abs(xy[nearest].x - at)) nearest = i
    }
    setActive(nearest)
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
    <div ref={box} className={cn('relative', className)}>
      {/* The line draws itself with a left-to-right clip wipe on the wrapper.
          NOTE: not Framer's pathLength — that dasharray trick fights
          vector-effect:non-scaling-stroke under non-uniform scaling
          (preserveAspectRatio="none") and leaves the line visibly dashed.
          Clipping the wrapper never touches the stroke, so it stays clean. */}
      <motion.div
        className="size-full"
        initial={reduced ? false : { clipPath: 'inset(0 100% 0 0)' }}
        animate={seen ? { clipPath: 'inset(0 0% 0 0)' } : undefined}
        transition={{ duration: DRAW_S, ease: 'easeOut' }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke={accent}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </motion.div>

      {/* A small dot on every recorded point; the latest is emphasised. These
          sit outside the clip (a ring on the last dot would be shaved by it),
          so each fades in as the wipe reaches its x. Rendered even when active
          — the bigger active dot covers this one — because skipping it would
          remount and re-run the entrance on every hover. */}
      {(showDots ? xy : []).map((p, i) =>
        i === lastIndex ? null : (
          <motion.span
            key={i}
            className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${p.x}%`, top: `${(p.y / H) * 100}%`, backgroundColor: tint(45) }}
            initial={reduced ? false : { opacity: 0 }}
            animate={seen ? { opacity: 1 } : undefined}
            transition={{ duration: 0.2, delay: reduced ? 0 : (p.x / W) * DRAW_S }}
          />
        ),
      )}

      {/* the "now" dot */}
      <motion.span
        className={cn(
          'absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background',
          compact ? 'size-2' : 'size-2.5',
        )}
        style={{
          left: `${xy[lastIndex].x}%`,
          top: `${(xy[lastIndex].y / H) * 100}%`,
          backgroundColor: accent,
        }}
        initial={reduced ? false : { opacity: 0, scale: 0 }}
        animate={seen ? { opacity: 1, scale: 1 } : undefined}
        transition={{ delay: reduced ? 0 : DRAW_S, type: 'spring', stiffness: 400, damping: 20 }}
      />

      {/* active point: guide line, emphasised dot, and the figure */}
      {activePt && activeXY && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-foreground/15"
            style={{ left: `${activeXY.x}%` }}
          />
          <span
            className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
            style={{
              left: `${activeXY.x}%`,
              top: `${(activeXY.y / H) * 100}%`,
              backgroundColor: accent,
            }}
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
                {format(activePt.y)}
              </div>
              {caption && active !== null && (
                <div className="mt-0.5 text-3xs text-muted-foreground">{caption(active)}</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* pointer capture layer — hover on desktop, tap/drag on touch */}
      {!compact && (
        <div
          className="absolute inset-0 cursor-crosshair touch-pan-y"
          onPointerMove={scrubTo}
          onPointerDown={scrubTo}
          onPointerLeave={() => setActive(null)}
        />
      )}
    </div>
  )
}
