'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { VENUES } from '@/config/venues'
import { accentFromSwatch } from '@/lib/avatar'
import { ladderProgress } from '@/lib/nextUp'
import { useMoney } from '@/lib/useMoney'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import { useProfile } from '@/store/profile'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/**
 * The ladder as a line you are somewhere on, rather than a tile you enter.
 *
 * Ten rungs is the game's progression and it used to be a 16:10 card called
 * "Venues", the same size as the three detours beside it and indistinguishable
 * from them. Nothing on any screen said "you are on rung 4 of 10" — the rank
 * title in the AppBar comes off `peakRoll`, which is a different fact.
 *
 * Drawn as a strip because that is the shape of the thing: ordered, finite, and
 * answering "how far am I" in one glance without opening anything. The full
 * grid is still one tap away, and now it is a page you go to on purpose rather
 * than the only way to find out where you stand.
 *
 * **Filled means won.** The ladder is gated by the Roll alone, so what you can
 * afford says what is open, never what you have done — the same line
 * `lib/challenge.ts` draws when it picks a band.
 *
 * **Lit in the player's own accent**, the colour the Roll's sparkline and the
 * stats charts already use, with a soft bloom under each won rung. The theme
 * colour said "the app filled this in"; your colour says you did (Will,
 * 2026-09-20). Only the rungs that are yours are painted — what is merely
 * affordable stays neutral, or the strip would glow for having money.
 */
export function LadderStrip({ delay = 0 }: { delay?: number }) {
  const money = useMoney()
  const venueRecords = useProfile((s) => s.venueRecords)
  const avatar = useProfile((s) => s.avatar)
  const roll = useSpendableRoll()
  const { rungs, won, next } = ladderProgress(venueRecords, roll)
  // The same colour the Roll's sparkline and the stats charts are drawn in,
  // derived the same way (Home.tsx, StatsPage.tsx). What you have climbed is
  // yours, so it is in your colour rather than the app's.
  const accent = avatar ? accentFromSwatch(avatar.backgroundColor) : 'var(--color-pip)'

  const line = !next
    ? `Cleared — all ${VENUES.length} taken down.`
    : next.affordable
      ? `Next: ${next.venue.name} · buy-in ${money(next.venue.buyIn)}`
      : `Next: ${next.venue.name} · need ${money(next.venue.buyIn)}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <Link
        href="/game/ladder"
        onClick={() => sound.play('tap')}
        className="group flex w-full flex-col gap-2.5 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3 transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99] md:gap-3 md:p-4"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">The Ladder</span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {won} of {VENUES.length} won
          </span>
        </span>

        <span aria-hidden className="flex items-center gap-1">
          {rungs.map((r) => (
            <span
              key={r.venue.id}
              title={r.venue.name}
              className={cn(
                'h-2 flex-1 rounded-full transition',
                // Only the rungs that are nobody's colour carry a class. A won
                // rung and the one you are climbing to are painted below, in
                // the player's own accent.
                !r.won && r !== next && (r.affordable ? 'bg-foreground/20' : 'bg-foreground/10'),
              )}
              style={
                r.won
                  ? {
                      backgroundColor: accent,
                      // Lit rather than merely filled. `color-mix` because the
                      // accent can be `var(--color-pip)` on a profile with no
                      // avatar, which no hex-alpha suffix would survive.
                      boxShadow: `0 0 10px 0 color-mix(in srgb, ${accent} 55%, transparent)`,
                    }
                  : r === next
                    ? { backgroundColor: `color-mix(in srgb, ${accent} 30%, transparent)` }
                    : undefined
              }
            />
          ))}
        </span>

        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-sm tabular-nums text-muted-foreground">{line}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
        </span>
      </Link>
    </motion.div>
  )
}
