'use client'

// The table as a place: the room around it, the oval of cloth, the chips on
// it, and the board's five places.
//
// **Why this exists** (2026-10-07). The table was the screen players spend
// nearly all their time on and it was mostly empty black: seats pinned to the
// edges of the window, five face-down cards promising a flop, bets as grey
// pills. Calm had tipped into empty. This draws a real table, quietly — a dark
// rail, a cloth lit from above, the venue's own painting dimmed and blurred into
// the room behind it — and gives the chips a physical presence on the cloth.
//
// The rules it keeps: colours are tokens (globals.css → "The table itself"),
// with the venue's accent and an owned finish's swatch coming from config the
// way `FeltBackdrop` takes them. No texture, no neon, nothing that loops except
// the turn ring, and that stops for reduced motion.

import { motion } from 'framer-motion'
import { CardBack } from '@/components/CardBack'
import { PlayingCard, SIZES } from '@/components/PlayingCard'
import { venueImage } from '@/components/menu/VenueArt'
import type { CardBackDesign } from '@/config/cardBacks'
import type { Card } from '@/lib/poker/cards'
import type { FeltGeometry } from '@/lib/tableSeats'
import { cn } from '@/lib/utils'

/**
 * The room: the venue's painting, very dim and very soft, with its accent as
 * the light over the table. Garage light is a garage's; the Main Event's is
 * the Main Event's. Painted under everything (the caller is `isolate`).
 */
export function TableRoom({ venueId, accent }: { venueId: string; accent: string }) {
  const image = venueImage(venueId)
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      {image && (
        // A plain <img>: decorative, never the LCP, and next/image's resizing
        // buys nothing under a 40px blur.
        <img
          src={image}
          alt=""
          decoding="async"
          className="absolute inset-0 size-full scale-125 object-cover opacity-60 blur-2xl saturate-[1.15]"
        />
      )}
      {/* The lamp over the table, in the venue's colour. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(60% 55% at 50% 42%, color-mix(in oklab, ${accent} 20%, transparent), transparent 75%)`,
        }}
      />
      {/* The room falls away into the dark at the edges and under the bar. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 95% at 50% 46%, transparent 45%, color-mix(in oklab, var(--background) 88%, transparent) 100%), linear-gradient(to bottom, color-mix(in oklab, var(--background) 70%, transparent), transparent 22%, transparent 70%, color-mix(in oklab, var(--background) 85%, transparent))',
        }}
      />
    </div>
  )
}

/**
 * The oval: a dark rail with a lit top edge, and the cloth inside it.
 *
 * **The cloth is the player's table finish** (the Chip Shop's, chosen in Style),
 * taken down a shade, because a swatch picked to glow behind a menu is too loud
 * to play cards on. On the plain table it is graphite with the venue's accent
 * worked into it, so the plain table is still the Garage's or the Main Event's,
 * and Baize stays the green you chose rather than the green you were given.
 * The rail never changes.
 */
export function TableFelt({
  geometry: g,
  swatch,
  accent,
  compact,
}: {
  geometry: FeltGeometry
  /** The owned finish's colour, or nothing for the plain table. */
  swatch?: string
  accent: string
  compact: boolean
}) {
  const cloth = swatch
    ? `color-mix(in oklab, ${swatch} 66%, var(--color-table-shade))`
    : `color-mix(in oklab, ${accent} 20%, var(--color-table-cloth))`
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-[50%]"
      style={{
        left: `${g.cx - g.rx}%`,
        top: `${g.cy - g.ry}%`,
        width: `${g.rx * 2}%`,
        height: `${g.ry * 2}%`,
        background:
          'linear-gradient(to bottom, var(--color-table-rail-edge), var(--color-table-rail) 30%, var(--color-table-shade))',
        boxShadow:
          '0 50px 90px -30px var(--color-table-shade), 0 0 0 1px color-mix(in oklab, var(--foreground) 6%, transparent), inset 0 1px 0 color-mix(in oklab, var(--foreground) 12%, transparent)',
      }}
    >
      <div
        className={cn('absolute rounded-[50%]', compact ? 'inset-2.5' : 'inset-4')}
        style={{
          background: `radial-gradient(75% 60% at 50% 30%, color-mix(in oklab, ${cloth} 84%, var(--color-table-line)), ${cloth} 55%, color-mix(in oklab, ${cloth} 50%, var(--color-table-shade)) 100%)`,
          boxShadow:
            'inset 0 0 0 1px color-mix(in oklab, var(--color-table-shade) 60%, transparent), inset 0 14px 40px color-mix(in oklab, var(--color-table-shade) 65%, transparent)',
        }}
      >
        {/* The betting line, barely there. */}
        <div
          className={cn(
            'absolute rounded-[50%] border border-table-line/[0.07]',
            compact ? 'inset-[7%]' : 'inset-[9%]',
          )}
        />
      </div>
    </div>
  )
}

// --- chips --------------------------------------------------------------------

const DENOMINATIONS = [
  { units: 50, color: 'var(--color-chip-ink)' },
  { units: 10, color: 'var(--color-chip-slate)' },
  { units: 2, color: 'var(--color-chip-coral)' },
  { units: 1, color: 'var(--color-chip-ivory)' },
] as const

/** Most chips one stack draws; past this it is a tall stack, not a taller one. */
const MAX_CHIPS = 8

/**
 * The chips an amount is made of, largest at the bottom.
 *
 * Counted in small blinds, so a stack means the same thing at the Garage and
 * at the Main Event: one coral chip is a big blind wherever you are sitting.
 */
export function chipColumn(amount: number, unit: number): string[] {
  let left = Math.max(1, Math.round(amount / Math.max(1, unit)))
  const out: string[] = []
  for (const d of DENOMINATIONS) {
    while (left >= d.units && out.length < MAX_CHIPS) {
      out.push(d.color)
      left -= d.units
    }
  }
  return out.length > 0 ? out : [DENOMINATIONS[3].color]
}

export function ChipStack({
  amount,
  unit,
  label,
  className,
}: {
  amount: number
  unit: number
  /** The number beside the stack. Absent for chips in flight. */
  label?: React.ReactNode
  className?: string
}) {
  const chips = chipColumn(amount, unit)
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      <span
        className="relative block w-[22px] shrink-0"
        style={{ height: 15 + (chips.length - 1) * 3 }}
      >
        {chips.map((color, i) => (
          <span
            key={i}
            className="table-chip"
            style={{ bottom: 2 + i * 3, ['--chip' as string]: color } as React.CSSProperties}
          />
        ))}
      </span>
      {label !== undefined && (
        <span className="rounded-full bg-table-shade/70 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-foreground shadow-sm">
          {label}
        </span>
      )}
    </span>
  )
}

// --- the board ----------------------------------------------------------------

/** An empty place on the cloth where a card will land. */
export function BoardSlot() {
  const s = SIZES.felt
  return (
    <div
      aria-hidden
      className={cn(
        s.w,
        s.h,
        'rounded-xl border border-table-line/[0.13] bg-table-shade/20 shadow-[inset_0_1px_6px_var(--color-table-shade)]',
      )}
    />
  )
}

/**
 * A board card, dealt: it drops onto its place and turns over.
 *
 * The flop's three arrive one after another; the turn and river on their own.
 * Under reduced motion the transforms are skipped by `MotionConfig` upstairs and
 * the card simply fades in face up.
 */
export function BoardCard({
  card,
  index,
  back,
}: {
  card: Card
  index: number
  back: CardBackDesign
}) {
  const delay = index < 3 ? index * 0.13 : 0.05
  return (
    <motion.div
      style={{ perspective: 900 }}
      initial={{ opacity: 0, y: -26, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay }}
    >
      <motion.div
        className="relative"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateY: 180 }}
        animate={{ rotateY: 0 }}
        transition={{ type: 'spring', stiffness: 170, damping: 19, delay: delay + 0.08 }}
      >
        <div style={{ backfaceVisibility: 'hidden' }}>
          <PlayingCard card={card} size="felt" />
        </div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <CardBack design={back} size="felt" />
        </div>
      </motion.div>
    </motion.div>
  )
}
