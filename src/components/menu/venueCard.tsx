'use client'

// Shared tile — used by the section browsers (the ladder, the Rail, the side
// tables) and styled to match the home-screen tiles: a 16:10 art panel over a
// compact footer, so a page of them reads like the lobby. Tapping opens the
// info dialog, which is where the buy-in is actually confirmed.
//
// **It takes a view-model rather than a `Venue`**, because half the things on
// these shelves are not venues. A side-tables card is a *family* — one idea
// (Fast, Bounty, Deep) with several rooms priced behind it — and it borrows a
// venue's painting without being that venue. Passing a `Venue` meant the tile
// had to know that, and it was already reaching past it for the ladder's rung
// number. The caller knows what it is showing; the tile only needs the words.

import { motion } from 'framer-motion'
import { ChevronRight, Lock, Star } from 'lucide-react'
import { VenueArt } from './VenueArt'

export interface TileVM {
  /** React key and art id. The art is an existing painting, not always its own. */
  artId: string
  accent: string
  name: string
  /** The corner word — a format, a game, or nothing. */
  tag?: string | null
  /** Ladder rung number; the shelves have none. */
  tier?: number
  /** The line under the name when this is open to you: prices, mostly. */
  line: string
  playable: boolean
  /**
   * Why it is locked, when the reason is not the Roll.
   *
   * Without this a locked tile says "Need 3,000", which for a member room is a
   * lie told to somebody whose Roll is fine — and the worst kind, because they
   * can act on it. They go and win 3,000 and the tile still says no.
   *
   * A member-only surface still has to render as *something*: hiding it is
   * worse product (you cannot buy what you cannot see) and slightly dishonest
   * by omission. So it renders, with a padlock and a plain sentence.
   *
   * The tile used to be inert when locked, on the grounds that a sales button
   * is the nagging the landing page rules out. Since every side table went
   * behind the check, a locked tap goes to `/membership` instead — the dialog
   * behind it had become a dead end on every card. The tile still looks like a
   * locked tile rather than an advert; what changed is where a deliberate tap
   * lands. The reasoning is in docs/membership.md, and the distinction it rests
   * on is invited versus uninvited.
   */
  lockedReason?: string
  /** Comes with the membership — marked with a star whether or not it's locked. */
  premium?: boolean
  index: number
  /** Tapping opens the info dialog, which confirms the buy-in. */
  onOpen: () => void
}

/**
 * The corner star: this comes with the membership.
 *
 * It sits beside the format tag rather than in the padlock's corner because it
 * is not a lock — it marks the *kind* of thing, so it stays once you have
 * joined and the padlock becomes a chevron.
 */
export function PremiumStar({ accent }: { accent: string }) {
  return (
    <span
      role="img"
      aria-label="Comes with the membership"
      title="Comes with the membership"
      className="grid size-7 place-items-center rounded-md bg-black/45 backdrop-blur-sm"
    >
      <Star className="size-3.5 fill-current" style={{ color: accent }} />
    </span>
  )
}

/** Corner badge: the ladder rung number, or the game/format tag on the shelves. */
function CornerTag({ tier, tag, accent }: { tier?: number; tag?: string | null; accent: string }) {
  if (tier !== undefined) {
    return (
      <span
        className="flex size-7 items-center justify-center rounded-md bg-black/45 text-xs font-semibold backdrop-blur-sm"
        style={{ color: accent }}
      >
        {tier}
      </span>
    )
  }
  if (!tag) return null
  return (
    <span
      className="rounded-md bg-black/45 px-2 py-1 text-2xs font-semibold backdrop-blur-sm"
      style={{ color: accent }}
    >
      {tag}
    </span>
  )
}

/** A card as a compact art-topped tile — the same language as the home menu. */
export function VenueTile({ model }: { model: TileVM }) {
  const { artId, accent, name, tag, index, tier, playable, line, lockedReason, premium, onOpen } =
    model
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="w-full"
    >
      <button
        onClick={onOpen}
        aria-label={`About ${name}`}
        className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-left transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]"
      >
        <div className="relative aspect-[16/10] w-full">
          <VenueArt id={artId} accent={accent} className="absolute inset-0 size-full" />
          <div className="absolute left-2 top-2 flex items-center gap-1">
            <CornerTag tier={tier} tag={tag} accent={accent} />
            {premium && <PremiumStar accent={accent} />}
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
          <h3 className="truncate font-semibold">{name}</h3>
          <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
            {playable ? line : (lockedReason ?? line)}
          </p>
        </div>
      </button>
    </motion.div>
  )
}
