'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { PlayStyle, StyleKey } from '@/lib/playStyle'
import { cn } from '@/lib/utils'

// Quadrant labels, positioned by corner. Loose sits at the top, aggressive to
// the right — the orientation most poker players already carry in their head.
const CORNERS: { key: StyleKey; label: string; pos: string; align: string }[] = [
  { key: 'station', label: 'Station', pos: 'left-3 top-3', align: 'text-left' },
  { key: 'maniac', label: 'Maniac', pos: 'right-3 top-3', align: 'text-right' },
  { key: 'rock', label: 'Rock', pos: 'left-3 bottom-3', align: 'text-left' },
  { key: 'shark', label: 'Shark', pos: 'right-3 bottom-3', align: 'text-right' },
]

/** Clamp a 0..1 value away from the very edges so the dot always reads inside. */
const inset = (v: number) => Math.max(0.06, Math.min(0.94, v))

/** The quadrant itself — tight↔loose vertical, passive↔aggressive horizontal. */
export function PlayStyleChart({
  style,
  className,
  accent = 'var(--color-pip)',
}: {
  style: PlayStyle
  className?: string
  /** Glow, dot and lit-quadrant colour. Defaults to the pip accent. */
  accent?: string
}) {
  const reduced = useReducedMotion()
  const tint = (pct: number) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`

  // x: passive → aggressive. y: loose (top) → tight (bottom). Looseness is
  // scaled against a realistic VPIP ceiling (~0.8) so the dot uses the space.
  const x = inset(style.aggression)
  const y = inset(1 - Math.min(1, style.looseness / 0.8))

  return (
    <div
      className={cn(
        'relative aspect-square w-full overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02]',
        className,
      )}
    >
      {/* quadrant divides */}
      <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-foreground/10" />
      <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-foreground/10" />

      {/* corner archetypes — the player's own quadrant is lit in the accent */}
      {CORNERS.map((c) => {
        const lit = style.ready && style.key === c.key
        return (
          <span
            key={c.key}
            className={cn(
              'absolute text-xs font-semibold uppercase tracking-[0.14em] transition-colors',
              c.pos,
              c.align,
              !lit && 'text-muted-foreground/40',
            )}
            style={lit ? { color: accent } : undefined}
          >
            {c.label}
          </span>
        )
      })}

      {/* axis captions */}
      <span className="absolute left-1/2 top-2 -translate-x-1/2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/45">
        Loose
      </span>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/45">
        Tight
      </span>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/45">
        Passive
      </span>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/45">
        Aggressive
      </span>

      {/* the dot only shows once there's enough sample; the caller owns the
          "keep playing" copy shown below the chart. */}
      {style.ready && (
        <>
          {/* soft glow anchoring the dot to its quadrant */}
          <motion.div
            className="pointer-events-none absolute size-32 rounded-full blur-2xl"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, backgroundColor: tint(20) }}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1, x: '-50%', y: '-50%' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute size-4 rounded-full"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, backgroundColor: accent, boxShadow: `0 0 0 4px ${tint(25)}` }}
            initial={reduced ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 22, delay: reduced ? 0 : 0.15 }}
          />
        </>
      )}
    </div>
  )
}
