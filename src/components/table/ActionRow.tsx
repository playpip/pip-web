'use client'

// The row under the table: the hero's buttons, Next hand, moves set ahead, the
// catching-up line, the spectating line, or nothing while another seat acts. It
// never changes height, or the `flex-1` felt above it resizes: an invisible copy
// of an action button's own box, not a px number, shares one grid cell with
// whatever the row shows, so the row is the buttons' height at any text size or
// zoom. The buttons do not wrap. A `line` over it is the caller's to hold.

import { cn } from '@/lib/utils'

/** Everything that sets an action button's height; the buttons are tested to match. */
export const ACTION_BUTTON_BOX = 'py-4 text-base font-semibold'

export function ActionRow({
  compact,
  line,
  children,
}: {
  /** The phone layout: the row sits under the thumb, clear of the home indicator. */
  compact: boolean
  /** Words over the row (the room's whose-move line), outside the reserve. */
  line?: React.ReactNode
  /** What the row shows now. Nothing at all while another seat acts. */
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'relative z-20 w-full',
        compact
          ? 'px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]'
          : 'mx-auto max-w-xl px-6 pt-4 pb-7',
      )}
    >
      {line}
      <div className="grid items-center *:col-start-1 *:row-start-1">
        <div aria-hidden className={cn(ACTION_BUTTON_BOX, 'invisible')}>
          {' '}
        </div>
        {children}
      </div>
    </div>
  )
}
