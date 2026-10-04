'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * How long a note has to be before it is worth hiding half of it.
 *
 * **A character count rather than a measurement**, and that is a deliberate
 * trade. Knowing whether text has actually overflowed means rendering it,
 * measuring it in an effect and setting state from what you found — which is
 * the `set-state-in-effect` pattern this project rules out (docs/development.md),
 * and which also flickers on the frame between the two.
 *
 * So the rule is arithmetic: roughly four lines at the dialog's width. It is
 * approximate at the edges — a very wide window or the largest text scale will
 * put the fold in a slightly different place — and the failure mode is a "More"
 * on a note that did not quite need one, which costs a tap and no information.
 * The alternative failure mode, a note silently cut off with no way to open it,
 * is the one worth spending accuracy to avoid.
 */
const WORTH_FOLDING = 260

/**
 * A paragraph that stops after a few lines, fades out, and opens on a tap.
 *
 * The long notes are the ones that earn it: Short Deck and Omaha Hi-Lo have
 * genuinely two rule-sets to explain, and a player who already knows Omaha
 * should not have to scroll past a paragraph of it to reach the button the
 * dialog exists for (Will, 2026-09-20). The short ones render as plain text
 * with no control at all, because a "More" that reveals one more line is worse
 * than the line.
 *
 * The fade is `from-popover`, not `from-background`: this lives inside the
 * dialog, and fading to the page colour would put a pale band across a panel
 * that is a different shade in both themes.
 */
export function ExpandableNote({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const body = cn('text-sm leading-relaxed text-muted-foreground', className)

  if (text.length <= WORTH_FOLDING) return <p className={body}>{text}</p>

  return (
    <div>
      <div className="relative">
        <p className={cn(body, !open && 'line-clamp-4')}>{text}</p>
        {!open && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-popover to-transparent"
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        // `aria-expanded` rather than clever labelling: a screen reader gets
        // the state from the control, and the control's own words stay short.
        aria-expanded={open}
        className="mt-1 text-sm font-medium text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
      >
        {open ? 'Less' : 'More…'}
      </button>
    </div>
  )
}
