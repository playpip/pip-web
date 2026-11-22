'use client'

// The small pieces the friends screens share: a face, a section label, a row
// button, and the shown values as label and value.

import { PlayerAvatar } from '@/components/PlayerAvatar'
import { avatarRingById } from '@/config/cosmetics'
import type { AvatarSpec } from '@/lib/avatar'
import { bandFor, isProvisional } from '@/lib/rating'
import { styleNamed } from '@/lib/playStyle'
import type { Card, ShowKey } from '@/lib/social/card'
import { formatChips } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

export function Face({
  avatar,
  ring,
  size,
}: {
  avatar: AvatarSpec | null
  ring?: string | null
  size: number
}) {
  return avatar ? (
    <PlayerAvatar spec={avatar} size={size} ring={avatarRingById(ring ?? null)} />
  ) : (
    <span
      className="shrink-0 rounded-full bg-foreground/[0.08]"
      style={{ width: size, height: size }}
    />
  )
}

export const profileHref = (handle: string) => `/game/player?h=${encodeURIComponent(handle)}`

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-2xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
      {children}
    </h2>
  )
}

/** A small action button for the end of a row. */
export function RowButton({
  children,
  onClick,
  primary = false,
  disabled = false,
}: {
  children: React.ReactNode
  onClick: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'min-h-9 rounded-xl px-3 text-sm font-medium transition active:scale-[0.97] disabled:opacity-50',
        primary
          ? 'bg-primary text-primary-foreground hover:bg-primary/85'
          : 'border border-foreground/15 hover:bg-foreground/[0.06]',
      )}
    >
      {children}
    </button>
  )
}

export interface Shown {
  label: string
  value: string
  detail?: string
}

/** The shown values, in Pip's order, as label and value. */
export function shownTiles(
  shown: readonly ShowKey[],
  card: Card,
  rating: { rating: number; decisions: number } | null,
): Shown[] {
  const tiles: Shown[] = []
  for (const key of shown) {
    if (key === 'rating' && rating) {
      tiles.push({
        label: 'Pip Rating',
        value: rating.rating.toLocaleString('en-GB'),
        detail: isProvisional(rating.decisions) ? 'Provisional' : bandFor(rating.rating),
      })
    }
    if (key === 'rank' && card.rank) tiles.push({ label: 'Rank', value: card.rank })
    if (key === 'roll' && card.roll !== undefined) {
      tiles.push({ label: 'Roll', value: formatChips(card.roll), detail: 'chips' })
    }
    if (key === 'style' && card.style) {
      tiles.push({ label: 'Player type', value: styleNamed(card.style).name })
    }
    if (key === 'hands' && card.hands !== undefined) {
      tiles.push({ label: 'Hands played', value: card.hands.toLocaleString('en-GB') })
    }
    if (key === 'wins' && card.wins !== undefined) {
      tiles.push({ label: 'Tournaments won', value: card.wins.toLocaleString('en-GB') })
    }
    if (key === 'streak' && card.streak !== undefined) {
      tiles.push({
        label: 'Best streak',
        value: card.streak.toLocaleString('en-GB'),
        detail: card.streak === 1 ? 'day' : 'days',
      })
    }
    if (key === 'awards' && card.awards !== undefined) {
      tiles.push({ label: 'Awards', value: card.awards.toLocaleString('en-GB') })
    }
  }
  return tiles
}
