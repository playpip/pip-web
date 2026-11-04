'use client'

// One card on the side-tables shelf (2026-11-04).
//
// **Why it is not a `VenueTile` any more.** In four weeks the shelf had 83
// views and single-digit sits. The tile led with a house name ("The Parlour",
// "The Split") that does not say the game, and its one grey line was either a
// price range or "Need 5,000", so nothing on it said what the game was, whether
// it was open to you today, or what tapping it would do (Will: "the side
// tables need to be clearer and better designed").
//
// So a card now says four things in reading order: the game by its real name,
// one line on what is different, the price, and one pill that is the state and
// the action at once (Play, Play free, Members, Need 1,000). The whole card is
// the button; the pill is what it will do.
//
// On a phone it is a row (art beside the words) so the line has room and a
// longer shelf is a scroll rather than a wall of half-width tiles; from `sm`
// up it is a tall card in a grid. Either shape takes more cards without
// changing.

import { motion } from 'framer-motion'
import { ChevronRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

/** What the pill says, which is also what a tap does. */
export type ShelfState =
  /** Open to you: a member, or a free table. */
  | { kind: 'play' }
  /** Today's free member table, still unspent. */
  | { kind: 'free' }
  /** Shut for the membership. A tap goes to the page that explains it. */
  | { kind: 'members' }
  /** Open, but the Roll cannot cover the cheapest seat. */
  | { kind: 'need'; amount: string }

export interface ShelfCardVM {
  /** The painting. A node, because the builder's art is not a venue's. */
  art: React.ReactNode
  accent: string
  /** The game by its real name: Omaha, Five-Card Draw. */
  title: string
  /** The house name, where it is a different word. */
  house?: string | null
  /** One line on what is different. */
  short: string
  /** The price: "Buy-in 5,000", or "From 500" over several rooms. */
  price: string
  state: ShelfState
  index: number
  onOpen: () => void
}

const PILL: Record<ShelfState['kind'], string> = {
  play: 'Play',
  free: 'Play free',
  members: 'Members',
  need: '',
}

export function ShelfCard({ model }: { model: ShelfCardVM }) {
  const { art, accent, title, house, short, price, state, index, onOpen } = model
  const label = state.kind === 'need' ? `Need ${state.amount}` : PILL[state.kind]
  const open = state.kind === 'play' || state.kind === 'free'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="w-full"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${title}: ${label}`}
        // A faint wash of the card's own colour from the bottom corner, so a
        // shelf of them reads as nine places rather than nine grey boxes.
        style={{
          backgroundImage: `radial-gradient(120% 90% at 0% 100%, ${accent}1c, transparent 60%)`,
        }}
        className="group relative flex h-full w-full items-stretch gap-3.5 overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-2.5 text-left shadow-lg shadow-black/25 transition duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-foreground/[0.05] active:translate-y-0 active:scale-[0.985] sm:flex-col sm:gap-0 sm:p-0"
      >
        <div className="relative min-h-24 w-[6.75rem] shrink-0 overflow-hidden rounded-xl sm:aspect-[2/1] sm:w-full sm:rounded-none">
          <div className="absolute inset-0 transition duration-500 group-hover:scale-[1.04]">
            {art}
          </div>
          {/* Seats the art into the card: a soft fade at the bottom edge. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-1/3 bg-gradient-to-t from-black/45 to-transparent sm:block" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col py-1 pr-1 sm:p-4">
          {house && (
            <span className="mb-0.5 truncate text-xs font-medium" style={{ color: accent }}>
              {house}
            </span>
          )}
          <h3 className="truncate text-lg font-semibold leading-tight tracking-tight">{title}</h3>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">{short}</p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-3">
            <span className="truncate text-xs tabular-nums text-muted-foreground">{price}</span>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full py-1.5 pr-2.5 pl-3 text-xs font-semibold tabular-nums transition',
                open
                  ? 'bg-primary text-primary-foreground shadow-md shadow-black/30 group-hover:bg-primary/90'
                  : 'bg-foreground/[0.07] text-muted-foreground ring-1 ring-foreground/10',
                state.kind === 'need' && 'px-3',
              )}
            >
              {state.kind === 'members' && <Lock className="size-3" />}
              {label}
              {open && <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" />}
              {state.kind === 'members' && <ChevronRight className="size-3.5 opacity-70" />}
            </span>
          </div>
        </div>
      </button>
    </motion.div>
  )
}
