'use client'

// How a grade looks, in one place.
//
// The colours are the app's existing pair for right and wrong — emerald and
// `suit-red`, the same two `/learn` grades its widgets with — plus the brand
// pip for the one grade that is more than right, and nothing at all for the
// spots the estimate cannot call. **A grade is never colour alone**: every chip
// carries its words, because "the red one" is not a thing a colour-blind player
// can see and because a review that needs a legend has failed to say anything.

import type { Grade } from '@/lib/review/grade'
import { MOVE_LABELS, type MoveVerdict } from '@/lib/review/moveGrade'
import { cn } from '@/lib/utils'

/** The dot on a hand in the list, where there is no room for the words. */
export const GRADE_DOTS: Record<Grade, string> = {
  sharp: 'bg-pip',
  sound: 'bg-emerald-500',
  close: 'bg-foreground/25',
  slip: 'bg-amber-500',
  costly: 'bg-suit-red',
}

/** Fill + ink per move verdict, for the chip beside the commentary. */
export const MOVE_STYLES: Record<MoveVerdict, string> = {
  brilliant: 'bg-pip/15 text-pip',
  good: 'bg-emerald-500/15 text-emerald-500',
  // Light green, not grey: **Standard means nothing went wrong**, which is a
  // quiet kind of good rather than a neutral. Paler than `good` so the two are
  // still told apart at a glance (Will, 2026-09-21).
  standard: 'bg-emerald-500/10 text-emerald-600/90 dark:text-emerald-400/85',
  mistake: 'bg-amber-500/15 text-amber-500',
  blunder: 'bg-suit-red/15 text-suit-red',
}

/**
 * What a move was worth, in one word.
 *
 * The vocabulary a chess player already knows, because the job is the same:
 * you are walking a finished game and want to know, at a glance, which moves
 * to stop on. **Never colour alone** — the word is the label and the colour is
 * the emphasis.
 */
export function MoveChip({ verdict, className }: { verdict: MoveVerdict; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-2xs font-semibold tracking-wide',
        MOVE_STYLES[verdict],
        className,
      )}
    >
      {MOVE_LABELS[verdict]}
    </span>
  )
}
