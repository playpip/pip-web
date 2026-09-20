'use client'

// The shape the lobby's two recommendations share: a cover panel beside a
// labelled line of copy, wide rather than square.
//
// It exists because there are exactly two of these and they have to read as a
// pair — `Next up` and `Short on time?` answer different questions about the
// same evening, and a player should be able to tell that at a glance rather
// than by reading both. Two hand-rolled cards would have drifted the first time
// either was touched, the way the lobby tile and the side-tables shelf drifted
// over a count (tests/sitDown.test.ts).
//
// Presentational only: it knows nothing about venues, Rolls or routes. Both
// callers open the same info dialog, which is where a buy-in is confirmed.

import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

export function WideTableCard({
  eyebrow,
  title,
  badge,
  line,
  cover,
  cta,
  onOpen,
  delay = 0,
}: {
  /** The question this card answers, above the name. */
  eyebrow: string
  title: string
  /** A word over the title — "Rematch", "Won before". */
  badge?: string
  /** One line of terms: the stakes, the price, what you walk away with. */
  line: string
  cover: React.ReactNode
  /**
   * The desktop pill. Omitted where the card is too narrow to hold one, which
   * is also where it should not compete — only the lead card gets a button.
   */
  cta?: string
  onOpen: () => void
  delay?: number
}) {
  return (
    // The rise animates a plain wrapper, not the clipped card — see
    // CategoryCard for why iOS WebKit minds.
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className="h-full w-full"
    >
      <button
        onClick={onOpen}
        className="group flex h-full w-full items-stretch overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-left transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]"
      >
        <span className="relative aspect-[16/10] w-32 shrink-0 sm:w-40 md:w-48 lg:w-56">
          {cover}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-3 p-3 md:p-4 lg:p-5">
          <span className="min-w-0 flex-1">
            <span className="block text-2xs font-medium uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 md:mt-1">
              <span className="truncate text-lg font-semibold md:text-xl lg:text-2xl">{title}</span>
              {badge && (
                <span className="shrink-0 rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-2xs font-medium tabular-nums text-muted-foreground">
                  {badge}
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-sm tabular-nums text-muted-foreground md:mt-1">
              {line}
            </span>
          </span>
          {/* Desktop only: at phone width the card is already one tap and the
              pill would crowd the line that carries the price. */}
          {cta ? (
            <span className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition group-hover:bg-primary/90 lg:flex">
              {cta}
              <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
            </span>
          ) : (
            <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 md:block" />
          )}
        </span>
      </button>
    </motion.div>
  )
}
