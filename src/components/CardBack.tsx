'use client'

import { SIZES, type CardSize } from './PlayingCard'
import type { CardBackDesign, CardPattern } from '@/config/cardBacks'
import { cn } from '@/lib/utils'

/**
 * A face-down card in the player's chosen design: a muted base colour and a
 * fine low-contrast pattern. Patterns are deliberately subtle — texture, not
 * decoration.
 */
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
  const dark = design.ink === 'dark'
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
      <PatternOverlay pattern={design.pattern} dark={dark} />
    </div>
  )
}

/** Tile size per pattern (SVG pattern units). */
const TILE: Record<CardPattern, [number, number]> = {
  solid: [8, 8],
  pinstripe: [5, 5],
  crosshatch: [7, 7],
  waves: [12, 6],
  rings: [11, 11],
  pips: [16, 16],
  checker: [6, 6],
  diamonds: [8, 8],
  dots: [6, 6],
}

function PatternOverlay({ pattern, dark }: { pattern: CardPattern; dark: boolean }) {
  if (pattern === 'solid') return null
  const id = `cb-${pattern}-${dark ? 'd' : 'l'}`
  const [tw, th] = TILE[pattern]
  return (
    <svg
      className={cn(
        'absolute inset-0 h-full w-full',
        dark ? 'text-black/[0.22]' : 'text-white/[0.16]',
      )}
      aria-hidden
    >
      <defs>
        <pattern id={id} width={tw} height={th} patternUnits="userSpaceOnUse">
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
    case 'pinstripe':
      return <line x1="2.5" y1="0" x2="2.5" y2="5" stroke={stroke} strokeWidth="0.75" />
    case 'crosshatch':
      return (
        <>
          <line x1="0" y1="7" x2="7" y2="0" stroke={stroke} strokeWidth="0.6" />
          <line x1="0" y1="0" x2="7" y2="7" stroke={stroke} strokeWidth="0.6" />
        </>
      )
    case 'waves':
      return <path d="M0 3 Q3 0.5 6 3 T12 3" fill="none" stroke={stroke} strokeWidth="0.8" />
    case 'rings':
      return <circle cx="5.5" cy="5.5" r="3.2" fill="none" stroke={stroke} strokeWidth="0.7" />
    case 'pips':
      // The four suits on a staggered 2×2 macro-tile, tiny and quiet.
      return (
        <>
          <text x="4" y="5.5" fontSize="4.5" textAnchor="middle" fill={stroke}>
            ♠
          </text>
          <text x="12" y="13.5" fontSize="4.5" textAnchor="middle" fill={stroke}>
            ♥
          </text>
          <text x="12" y="5.5" fontSize="4.5" textAnchor="middle" fill={stroke}>
            ♦
          </text>
          <text x="4" y="13.5" fontSize="4.5" textAnchor="middle" fill={stroke}>
            ♣
          </text>
        </>
      )
    case 'checker':
      return (
        <>
          <rect x="0" y="0" width="3" height="3" fill={stroke} />
          <rect x="3" y="3" width="3" height="3" fill={stroke} />
        </>
      )
    case 'diamonds':
      return <path d="M4 1 L7 4 L4 7 L1 4 Z" fill="none" stroke={stroke} strokeWidth="0.6" />
    case 'dots':
      return <circle cx="3" cy="3" r="0.8" fill={stroke} />
    default:
      return null
  }
}
