'use client'

// Mystery Card: the hole card nobody has seen yet, its owner included.
//
// Face down it is the player's own card back with a "?" on it and a slow sheen
// crossing it, so it reads as a card you are holding and cannot look at rather
// than an opponent's. On the river it turns over where it lies: a lift, a turn
// on its long edge, and a settle, timed to land just after the river card does.
//
// Nothing here knows what the card is until it is handed one. The hidden state
// takes no card at all, because the felt is never given it (see `Player.mystery`
// in lib/poker/engine).

import { motion } from 'framer-motion'
import { CardBack } from '@/components/CardBack'
import { PlayingCard, SIZES, type CardSize } from '@/components/PlayingCard'
import { type CardBackDesign, DEFAULT_CARD_BACK } from '@/config/cardBacks'
import type { Card } from '@/lib/poker/cards'
import { cn } from '@/lib/utils'

/** How long after the river lands the card turns, in seconds. */
export const MYSTERY_FLIP_DELAY = 0.55

function Hidden({ size, back }: { size: CardSize; back: CardBackDesign }) {
  const s = SIZES[size]
  const dark = back.ink === 'dark'
  return (
    <div className={cn('relative', s.w, s.h)}>
      <CardBack design={back} size={size} className="absolute inset-0" />
      {/* The sheen and the mark sit on a card whose colour is the design's,
          not the theme's, so they use fixed alphas the way CardBack's own
          pattern does. */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
        <span
          className="mystery-shimmer absolute inset-y-0 -left-full w-full"
          style={{
            background: `linear-gradient(105deg, transparent 30%, ${
              dark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.16)'
            } 50%, transparent 70%)`,
          }}
        />
      </span>
      <span
        aria-hidden
        className={cn(
          'mystery-mark pointer-events-none absolute inset-0 flex items-center justify-center font-semibold leading-none',
          s.rank,
        )}
        style={{
          color: dark ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.6)',
          textShadow: dark ? 'none' : '0 1px 6px rgba(0,0,0,0.35)',
        }}
      >
        ?
      </span>
      <span className="sr-only">Mystery card, face down until the river</span>
    </div>
  )
}

/**
 * The face-down card, or, handed `card`, that card turning over.
 *
 * `flip` is false where the card should simply be there face up: a hand
 * resumed after the river, or the review's last step.
 */
export function MysteryCard({
  card,
  size,
  back = DEFAULT_CARD_BACK,
  flip = true,
  className,
}: {
  card?: Card
  size: CardSize
  back?: CardBackDesign
  flip?: boolean
  className?: string
}) {
  if (!card) {
    return (
      <motion.div
        className={className}
        initial={{ opacity: 0, y: -14, rotate: -4, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.06 }}
      >
        <Hidden size={size} back={back} />
      </motion.div>
    )
  }
  return (
    <motion.div
      className={cn('relative', className)}
      style={{ perspective: 900 }}
      initial={flip ? { y: 0, scale: 1 } : false}
      animate={flip ? { y: [0, -16, 0], scale: [1, 1.08, 1] } : undefined}
      transition={{ duration: 0.7, delay: MYSTERY_FLIP_DELAY, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="relative"
        style={{ transformStyle: 'preserve-3d' }}
        initial={flip ? { rotateY: 180 } : false}
        animate={{ rotateY: 0 }}
        transition={{
          type: 'spring',
          stiffness: 150,
          damping: 17,
          delay: MYSTERY_FLIP_DELAY + 0.08,
        }}
      >
        <div style={{ backfaceVisibility: 'hidden' }}>
          <PlayingCard card={card} size={size} />
        </div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <Hidden size={size} back={back} />
        </div>
      </motion.div>
      {/* A soft ring that breathes out once the card is face up. */}
      {flip && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-foreground/50"
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.9, 0], scale: [1, 1.04, 1.12] }}
          transition={{ duration: 0.9, delay: MYSTERY_FLIP_DELAY + 0.35, ease: 'easeOut' }}
        />
      )}
    </motion.div>
  )
}
