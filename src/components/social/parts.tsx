'use client'

// The small pieces the friends screens share: a face, a section label, a row
// button, and the shown values as label and value.

import { BadgeCheck, Crown, Gem, type LucideIcon, Spade } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { avatarRingById } from '@/config/cosmetics'
import type { AvatarSpec } from '@/lib/avatar'
import { bandFor, isProvisional } from '@/lib/rating'
import { styleNamed } from '@/lib/playStyle'
import { type Badge, BADGE_LABEL } from '@/lib/social/badges'
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

/** Challenge a friend: Multiplayer's own form, opened on a table for the two of you. */
export const challengeHref = (handle: string) =>
  `/game/multiplayer?with=${encodeURIComponent(handle)}`

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

// The spade is filled: drawn as an outline, at this size it reads as a cloud.
const BADGE_LOOK: Record<Badge, { icon: LucideIcon; tint: string; mark: string; solid?: true }> = {
  team: { icon: Spade, tint: 'bg-pip/15 text-pip', mark: 'text-pip', solid: true },
  verified: { icon: BadgeCheck, tint: 'bg-suit-blue/20 text-suit-blue', mark: 'text-suit-blue' },
  'high-roller': { icon: Gem, tint: 'bg-streak/15 text-streak', mark: 'text-streak' },
  member: { icon: Crown, tint: 'bg-suit-red/15 text-suit-red', mark: 'text-suit-red' },
}

/** A player's badges as labelled chips, for their profile card. */
export function BadgeChips({ badges }: { badges: readonly Badge[] }) {
  if (badges.length === 0) return null
  return (
    <span className="flex flex-wrap justify-center gap-1.5">
      {badges.map((b) => {
        const { icon: Icon, tint, solid } = BADGE_LOOK[b]
        return (
          <span
            key={b}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              tint,
            )}
          >
            <Icon className={cn('size-3.5', solid && 'fill-current')} /> {BADGE_LABEL[b]}
          </span>
        )
      })}
    </span>
  )
}

/** The same badges as small marks beside a name in a list. */
export function BadgeMarks({ badges }: { badges: readonly Badge[] }) {
  if (badges.length === 0) return null
  return (
    <span className="ml-1 inline-flex shrink-0 items-center gap-0.5 align-[-0.125em]">
      {badges.map((b) => {
        const { icon: Icon, mark, solid } = BADGE_LOOK[b]
        return (
          <span key={b} title={BADGE_LABEL[b]} aria-label={BADGE_LABEL[b]} role="img">
            <Icon className={cn('size-3.5', mark, solid && 'fill-current')} />
          </span>
        )
      })}
    </span>
  )
}
