'use client'

// The small pieces the friends screens share: a face, a row for a person, and
// the shown values as tiles.

import Link from 'next/link'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { avatarRingById } from '@/config/cosmetics'
import type { AvatarSpec } from '@/lib/avatar'
import { bandFor, isProvisional } from '@/lib/rating'
import { styleNamed } from '@/lib/playStyle'
import type { Card, ShowKey } from '@/lib/social/card'
import type { PlayerRow } from '@/lib/social/api'
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

/** One person in a list. The face and name open their profile; `children` sit at the end. */
export function PersonRow({
  person,
  note,
  children,
}: {
  person: PlayerRow
  note?: string
  children?: React.ReactNode
}) {
  return (
    <li className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <Link
        href={profileHref(person.handle)}
        className="flex min-w-0 flex-1 basis-40 items-center gap-3 rounded-xl transition hover:opacity-80"
      >
        <Face avatar={person.avatar} ring={person.ring} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{person.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            @{person.handle}
            {note && ` · ${note}`}
          </span>
        </span>
      </Link>
      {children && <span className="ml-auto flex shrink-0 items-center gap-2">{children}</span>}
    </li>
  )
}

export function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex flex-col divide-y divide-foreground/[0.06] overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02]">
      {children}
    </ul>
  )
}

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

export function Tiles({ tiles }: { tiles: Shown[] }) {
  if (tiles.length === 0) return null
  return (
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3"
        >
          <dt className="text-xs text-muted-foreground">{t.label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">
            {t.value}
            {t.detail && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t.detail}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
