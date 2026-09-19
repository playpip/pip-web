'use client'

// Shared venue card — used by the section browsers (Venues, Side Tables) and
// styled to match the home-screen tiles: a 16:10 art panel over a compact
// footer, so a page of them reads like the lobby. Tapping opens the venue's
// info dialog, which is where the buy-in is actually confirmed.

import { motion } from 'framer-motion'
import { ChevronRight, Lock } from 'lucide-react'
import { VenueArt } from './VenueArt'
import { FORMAT_LABELS, type Venue } from '@/config/venues'
import { useMoney } from '@/lib/useMoney'

export interface VenueVM {
  venue: Venue
  index: number
  /** Ladder rung number; side tables have none. */
  tier?: number
  playable: boolean
  /**
   * Why it is locked, when the reason is not the Roll.
   *
   * Without this a locked tile says "Need 3,000", which for a member room is a
   * lie told to somebody whose Roll is fine — and the worst kind, because they
   * can act on it. They go and win 3,000 and the tile still says no.
   *
   * It is a line of text rather than a call to action on purpose. A member-only
   * surface still has to render as *something*: hiding it is worse product (you
   * cannot buy what you cannot see) and slightly dishonest by omission, and
   * turning it into a sales button is the nagging the landing page rules out.
   * A plain sentence saying what the thing is, and the page it belongs to
   * carries the one link. See technology#52 item 1.
   */
  lockedReason?: string
  /** Tapping a venue opens its info dialog, which confirms the buy-in. */
  onOpen: () => void
}

/** Corner badge: the ladder rung number, or the format tag on side tables. */
function CornerTag({ venue, tier }: { venue: Venue; tier?: number }) {
  if (tier !== undefined) {
    return (
      <span
        className="flex size-7 items-center justify-center rounded-md bg-black/45 text-xs font-semibold backdrop-blur-sm"
        style={{ color: venue.accent }}
      >
        {tier}
      </span>
    )
  }
  if (!venue.format) return null
  return (
    <span
      className="rounded-md bg-black/45 px-2 py-1 text-2xs font-semibold backdrop-blur-sm"
      style={{ color: venue.accent }}
    >
      {FORMAT_LABELS[venue.format]}
    </span>
  )
}

/** A venue as a compact art-topped tile — the same language as the home menu. */
export function VenueTile({ model }: { model: VenueVM }) {
  const { venue, index, tier, playable, lockedReason, onOpen } = model
  const money = useMoney()
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="w-full"
    >
      <button
        onClick={onOpen}
        aria-label={`About ${venue.name}`}
        className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-left transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]"
      >
        <div className="relative aspect-[16/10] w-full">
          <VenueArt id={venue.id} accent={venue.accent} className="absolute inset-0 size-full" />
          <div className="absolute left-2 top-2">
            <CornerTag venue={venue} tier={tier} />
          </div>
          <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-black/40 backdrop-blur-sm">
            {playable ? (
              <ChevronRight className="size-4 text-white/85 transition group-hover:translate-x-0.5" />
            ) : (
              <Lock className="size-3.5 text-white/85" />
            )}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-3">
          <h3 className="truncate font-semibold">{venue.name}</h3>
          <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
            {playable ? (
              <>
                Buy-in {money(venue.buyIn)}
                {venue.prize > 0 && ` · win ${money(venue.prize)}`}
              </>
            ) : (
              (lockedReason ?? `Need ${money(venue.buyIn)}`)
            )}
          </p>
        </div>
      </button>
    </motion.div>
  )
}
