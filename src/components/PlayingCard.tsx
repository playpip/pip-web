'use client'

import { motion } from 'framer-motion'
import type { Card, Suit } from '@/lib/poker/cards'
import { SUIT_GLYPH, isRed } from '@/lib/poker/cards'
import { useProfile } from '@/store/profile'
import { cn } from '@/lib/utils'

// The four-colour deck (a Chip Shop purchase): hearts red, spades black,
// diamonds blue, clubs green — the poker-room standard for misreading nothing.
const FOUR_COLOUR_INK: Record<Suit, string> = {
  h: 'text-suit-red',
  s: 'text-cardface-ink',
  d: 'text-suit-blue',
  c: 'text-suit-green',
}

function inkFor(suit: Suit, deckFace: string): string {
  if (deckFace === 'face-fourcolor') return FOUR_COLOUR_INK[suit]
  return isRed(suit) ? 'text-suit-red' : 'text-cardface-ink'
}

// Ten displays as "10" on the face; the engine keeps 'T' internally.
const rankLabel = (rank: string): string => (rank === 'T' ? '10' : rank)

// A card face has to stay proportional to the card, whatever the text size
// setting is doing (lib/textScale). The rule for every entry below: if the box
// is sized in rem the type is too, so the two grow together; if the box is
// sized in vw (the mobile table, where the card is a fraction of the screen)
// the type is capped in vw so it can never outgrow the card it is drawn on.
// The caps are the size the type already has on the narrowest phone we support,
// so nothing moves at 100%.
export const SIZES = {
  xs: {
    w: 'w-8',
    h: 'h-11',
    rank: 'text-[0.8125rem]',
    suit: 'text-[0.6875rem]',
    pad: 'p-0.5',
    r: 'rounded-[5px]',
  },
  sm: { w: 'w-11', h: 'h-16', rank: 'text-lg', suit: 'text-base', pad: 'p-1.5', r: 'rounded-lg' },
  md: { w: 'w-16', h: 'h-24', rank: 'text-3xl', suit: 'text-xl', pad: 'p-2', r: 'rounded-xl' },
  lg: { w: 'w-20', h: 'h-28', rank: 'text-4xl', suit: 'text-2xl', pad: 'p-2.5', r: 'rounded-xl' },
  // Responsive table size — spans nearly the full width on mobile (vw-based),
  // and the full card size on desktop (CSS-only, no JS).
  board: {
    w: 'w-[18vw] sm:w-20',
    h: 'h-[25.2vw] sm:h-28',
    rank: 'text-[min(1.875rem,9.4vw)] sm:text-4xl',
    suit: 'text-[min(1.25rem,6.3vw)] sm:text-2xl',
    pad: 'p-[min(0.5rem,2.5vw)] sm:p-2.5',
    r: 'rounded-xl',
  },
  // The drill board — the table's five cards inside a padded content column
  // rather than full-bleed felt, so a touch narrower than `board` or the row
  // runs into the gutter on a small phone.
  drill: {
    w: 'w-[16vw] sm:w-16',
    h: 'h-[22.4vw] sm:h-24',
    rank: 'text-[min(1.6rem,8.3vw)] sm:text-3xl',
    suit: 'text-[min(1.05rem,5.6vw)] sm:text-xl',
    pad: 'p-[min(0.45rem,2.2vw)] sm:p-2',
    r: 'rounded-xl',
  },
  // Hero hole cards — oversized on mobile so they anchor the bottom of the
  // screen; matches the board size on desktop.
  hero: {
    w: 'w-[23vw] sm:w-20',
    h: 'h-[32.2vw] sm:h-28',
    rank: 'text-[min(2.25rem,11.3vw)] sm:text-4xl',
    suit: 'text-[min(1.5rem,7.5vw)] sm:text-2xl',
    pad: 'p-[min(0.625rem,3.2vw)] sm:p-2.5',
    r: 'rounded-xl',
  },
} as const

export type CardSize = keyof typeof SIZES

export function PlayingCard({
  card,
  size = 'md',
  faceDown = false,
  className,
}: {
  card?: Card | null
  size?: CardSize
  faceDown?: boolean
  className?: string
}) {
  const s = SIZES[size]
  const hidden = faceDown || !card
  const deckFace = useProfile((st) => st.deckFace)
  // The High-Contrast deck: same colours, ink like it means it.
  const contrast = deckFace === 'face-contrast'
  // Big Index (free) and Minimal (the membership's) are weight-and-size
  // changes and nothing else. **Neither may take information off the card**:
  // the rank and the suit are both drawn by every face here, because a deck
  // that showed less would be the one thing docs/shop.md rule 1 forbids —
  // cosmetics that touch what you can know.
  const bigIndex = deckFace === 'face-bigindex'
  const minimal = deckFace === 'face-minimal'
  const rankWeight = contrast ? 'font-black' : minimal ? 'font-light' : 'font-semibold'

  if (hidden) {
    return (
      <div
        className={cn(
          s.w,
          s.h,
          'rounded-xl border border-foreground/10 bg-foreground/[0.03] overflow-hidden',
          className,
        )}
        aria-hidden
      >
        <HatchPattern />
      </div>
    )
  }

  const ink = inkFor(card.suit, deckFace)

  // Tiny cards (showdown reveal) read better as a centred, compact index than
  // the spread top/bottom layout used at larger sizes.
  if (size === 'xs') {
    return (
      <div
        className={cn(
          s.w,
          s.h,
          s.r,
          'flex select-none flex-col items-center justify-center bg-cardface leading-none shadow-sm shadow-black/10 dark:shadow-md dark:shadow-black/40',
          className,
        )}
      >
        <span
          className={cn(
            s.rank,
            contrast ? 'font-black' : minimal ? 'font-light' : 'font-bold',
            bigIndex && 'inline-block scale-110',
            ink,
          )}
        >
          {rankLabel(card.rank)}
        </span>
        <span
          className={cn(
            s.suit,
            ink,
            contrast && 'inline-block scale-110',
            minimal && 'inline-block scale-90 opacity-80',
          )}
        >
          {SUIT_GLYPH[card.suit]}
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        s.w,
        s.h,
        s.pad,
        s.r,
        'relative bg-cardface flex flex-col justify-between select-none',
        // Soft shadow in light mode; deeper shadow on the dark table.
        'shadow-sm shadow-black/10 dark:shadow-lg dark:shadow-black/40',
        className,
      )}
    >
      <span
        className={cn(
          s.rank,
          'leading-none tracking-tight',
          rankWeight,
          // The whole of the Big Index deck: the corner rank, a fifth larger,
          // anchored to its own corner so nothing else on the card moves.
          bigIndex && 'inline-block origin-top-left scale-[1.2]',
          ink,
        )}
      >
        {rankLabel(card.rank)}
      </span>
      <span
        className={cn(
          s.suit,
          'leading-none',
          ink,
          contrast && 'inline-block scale-110',
          minimal && 'inline-block scale-90 opacity-80',
        )}
      >
        {SUIT_GLYPH[card.suit]}
      </span>
    </div>
  )
}

function HatchPattern() {
  return (
    <svg className="h-full w-full text-foreground/15" aria-hidden>
      <defs>
        <pattern
          id="card-hatch"
          width="8"
          height="8"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#card-hatch)" />
    </svg>
  )
}

/** A card that deals in with a subtle spring + fade (respects reduced motion). */
export function DealtCard({
  index = 0,
  ...props
}: React.ComponentProps<typeof PlayingCard> & { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -14, rotate: -4, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: index * 0.06 }}
    >
      <PlayingCard {...props} />
    </motion.div>
  )
}
