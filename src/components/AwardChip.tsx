'use client'

import type { AwardDef } from '@/lib/awards'
import { cn } from '@/lib/utils'

/**
 * A collectible award chip — the favicon's chip template (disc, rim ticks,
 * inner ring) recoloured per award with a small motif stamped in the centre.
 * Unearned chips render as hollow outlines: a collection with visible gaps.
 */
export function AwardChip({
  award,
  earned,
  size = 40,
  className,
}: {
  award: AwardDef
  earned: boolean
  size?: number
  className?: string
}) {
  const glyphSize = award.glyph.length > 2 ? 6 : award.glyph.length === 2 ? 7.5 : 9.5

  if (!earned) {
    return (
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className={cn('overflow-visible text-foreground/25', className)}
        aria-hidden
      >
        <circle
          cx="16"
          cy="16"
          r="14.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2.5 3"
        />
        <circle
          cx="16"
          cy="16"
          r="8.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.6"
        />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn('overflow-visible', className)}
      aria-hidden
    >
      <circle cx="16" cy="16" r="15" fill={award.color} />
      <circle
        cx="16"
        cy="16"
        r="12.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4.5"
        strokeDasharray="3.3 6.517"
        strokeDashoffset="1.65"
      />
      <circle
        cx="16"
        cy="16"
        r="8.25"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        opacity="0.95"
      />
      <text
        x="16"
        y="16"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={glyphSize}
        fontWeight="700"
        fontFamily="inherit"
      >
        {award.glyph}
      </text>
    </svg>
  )
}
