'use client'

// The card a free player sees once today's free one is used (2026-11-02).
//
// A free player gets one member table, one private room and one quick match a
// UTC day. Once it was spent, the tile went quiet: a padlock and a grey line.
// The moment somebody has just had a taste is the moment the membership is
// worth naming, so the quiet state is now this card, in the tile's place.
//
// Furniture on the same terms as the lobby's MembershipCard (docs/membership.md,
// invited versus uninvited): on the screen the player is already on, never over
// anything, one per surface, nothing to dismiss, and never inside a hand. It
// says what happened, what members get, and when the free one comes back.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { membershipFor } from '@/config/membership'
import { trackOnce } from '@/lib/analytics'
import { sound } from '@/lib/sound'

/**
 * What today's free one was. `quick` is the multiplayer quick match; `round`
 * is a quick game's free round (config/quickGames), one per game.
 */
export type LimitKind = 'table' | 'room' | 'quick' | 'round'

const DAY = 24 * 60 * 60 * 1000

const CARD: Record<
  LimitKind,
  { title: string; line: string; href: string; seen: () => void; tapped: () => void }
> = {
  table: {
    title: 'You’ve had today’s free table.',
    line: 'Members play every table, every day.',
    href: membershipFor('side-tables'),
    seen: () => trackOnce('limit-card-seen-table'),
    tapped: () => trackOnce('limit-card-tapped-table'),
  },
  room: {
    title: 'You’ve had today’s free room.',
    line: 'Members open a room whenever they like.',
    href: membershipFor('multiplayer'),
    seen: () => trackOnce('limit-card-seen-room'),
    tapped: () => trackOnce('limit-card-tapped-room'),
  },
  quick: {
    title: 'You’ve had today’s free quick match.',
    line: 'Members play as many as they like.',
    href: membershipFor('multiplayer'),
    seen: () => trackOnce('limit-card-seen-quick'),
    tapped: () => trackOnce('limit-card-tapped-quick'),
  },
  round: {
    title: 'You’ve had today’s free round.',
    line: 'Members play as much as they like.',
    href: membershipFor('quick-games'),
    seen: () => trackOnce('limit-card-seen-round'),
    tapped: () => trackOnce('limit-card-tapped-round'),
  },
}

/** "Free again in 5 hours": the daily ones come back at midnight UTC. */
function freeAgain(now: number): string {
  const hours = Math.ceil((DAY - (now % DAY)) / (60 * 60 * 1000))
  return hours <= 1 ? 'Free again in under an hour' : `Free again in ${hours} hours`
}

export function LimitCard({
  kind,
  narrow = false,
}: {
  kind: LimitKind
  /** In a column too narrow for the side-by-side layout at any screen width. */
  narrow?: boolean
}) {
  const card = CARD[kind]
  const [now] = useState(() => Date.now())
  useEffect(() => card.seen(), [card])
  // How far through the UTC day, for the dial: full when the free one is back.
  const through = (now % DAY) / DAY

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative isolate w-full overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-5 md:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-20 -z-10 size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--color-pip)_20%,transparent),transparent_65%)] blur-2xl"
      />
      <div
        className={
          narrow
            ? 'flex flex-col gap-5'
            : 'flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6'
        }
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <DayDial through={through} />
          <div className="min-w-0 flex-1 text-left">
            <span className="inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
              <Star className="size-3 fill-pip text-pip" />
              Pip Membership
            </span>
            <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight">{card.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{card.line}</p>
          </div>
        </div>
        <div
          className={
            narrow
              ? 'flex shrink-0 flex-col items-center gap-2.5'
              : 'flex shrink-0 flex-col items-center gap-2.5 sm:w-52'
          }
        >
          <Link
            href={card.href}
            onClick={() => {
              sound.play('tap')
              card.tapped()
            }}
            className="flex w-full items-center justify-center rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-black/20 transition hover:bg-primary/90 active:scale-[0.98]"
          >
            See the membership
          </Link>
          <p className="text-sm tabular-nums text-muted-foreground">{freeAgain(now)}</p>
        </div>
      </div>
    </motion.div>
  )
}

/** A chip-sized dial filling towards midnight UTC, when the free one comes back. */
function DayDial({ through }: { through: number }) {
  const r = 22
  const length = 2 * Math.PI * r
  return (
    <span className="relative grid size-14 shrink-0 place-items-center rounded-full bg-foreground/[0.05] shadow-inner shadow-black/30 ring-1 ring-foreground/10">
      <svg viewBox="0 0 56 56" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="4"
          className="stroke-foreground/10"
        />
        <motion.circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className="stroke-pip"
          strokeDasharray={length}
          initial={{ strokeDashoffset: length }}
          animate={{ strokeDashoffset: length * (1 - through) }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
        />
      </svg>
      <Star className="size-4 fill-pip text-pip" />
    </span>
  )
}
