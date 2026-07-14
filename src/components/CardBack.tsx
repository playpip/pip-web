'use client'

import { SIZES, type CardSize } from './PlayingCard'
import type { CardBackDesign, CardPattern } from '@/config/cardBacks'
import { cn } from '@/lib/utils'

/** A face-down card rendered with the player's chosen colour + pattern. */
export function CardBack({
  design,
  size = 'md',
  className,
}: {
  design: CardBackDesign
  size?: CardSize
  className?: string
}) {
  const s = SIZES[size]
  return (
    <div
      className={cn(
        s.w,
        s.h,
        'relative overflow-hidden rounded-xl',
        // Match the face-up card shadow so flipped and visible cards sit alike.
        'shadow-sm shadow-black/10 dark:shadow-lg dark:shadow-black/40',
        className,
      )}
      style={{ backgroundColor: design.color }}
      aria-hidden
    >
      <PatternOverlay pattern={design.pattern} />
    </div>
  )
}

const TILE: Record<CardPattern, number> = {
  solid: 8,
  hatch: 8,
  grid: 8,
  stripes: 8,
  dots: 10,
  diamonds: 10,
  rings: 10,
  plus: 10,
}

function PatternOverlay({ pattern }: { pattern: CardPattern }) {
  if (pattern === 'solid') return null
  const id = `cb-${pattern}`
  const tile = TILE[pattern] ?? 8
  return (
    <svg className="absolute inset-0 h-full w-full text-white/25" aria-hidden>
      <defs>
        <pattern id={id} width={tile} height={tile} patternUnits="userSpaceOnUse">
          {patternShapes(pattern)}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

function patternShapes(pattern: CardPattern) {
  const stroke = 'currentColor'
  switch (pattern) {
    case 'hatch':
      return <line x1="0" y1="8" x2="8" y2="0" stroke={stroke} strokeWidth="1.5" />
    case 'grid':
      return (
        <>
          <line x1="0" y1="0" x2="0" y2="8" stroke={stroke} strokeWidth="1" />
          <line x1="0" y1="0" x2="8" y2="0" stroke={stroke} strokeWidth="1" />
        </>
      )
    case 'stripes':
      return <line x1="0" y1="0" x2="8" y2="0" stroke={stroke} strokeWidth="1.4" />
    case 'dots':
      return <circle cx="5" cy="5" r="1.6" fill={stroke} />
    case 'rings':
      return <circle cx="5" cy="5" r="2.6" fill="none" stroke={stroke} strokeWidth="1" />
    case 'diamonds':
      return <path d="M5 1 L9 5 L5 9 L1 5 Z" fill="none" stroke={stroke} strokeWidth="1" />
    case 'plus':
      return <path d="M5 2.5 V7.5 M2.5 5 H7.5" stroke={stroke} strokeWidth="1.2" />
    default:
      return null
  }
}
