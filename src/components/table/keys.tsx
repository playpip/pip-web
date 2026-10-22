'use client'

// The table's keyboard, on screen: the letters on the buttons and the list `?`
// opens. What the keys do is decided in `lib/tableKeys`.

import { useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMediaQuery } from '@/lib/useMediaQuery'
import {
  KEY_LIST,
  KEYBOARD_QUERY,
  keyboardDevice,
  listenForTableKeys,
  TOUCH_QUERY,
} from '@/lib/tableKeys'
import { cn } from '@/lib/utils'

/**
 * True on a device whose primary pointer is a mouse or a trackpad and which has
 * no touchscreen (lib/tableKeys). False on the server and on first paint.
 */
export function useTableKeyboard() {
  const fine = useMediaQuery(KEYBOARD_QUERY)
  const touch = useMediaQuery(TOUCH_QUERY)
  return keyboardDevice(fine, touch)
}

/**
 * Listen on `window` while `enabled`, on a keyboard device only.
 *
 * The handler is held in a ref and the listener bound once per `enabled`, as
 * in `ReviewTable`: depending on the handler would re-bind it every render.
 */
export function useTableKeys(enabled: boolean, onKey: (e: KeyboardEvent) => void) {
  const handler = useRef(onKey)
  handler.current = onKey
  useEffect(() => {
    if (!enabled) return
    return listenForTableKeys(window, (e) => handler.current(e)) ?? undefined
  }, [enabled])
}

/**
 * The letter in a button's corner. The drills' badge (`Answer` in
 * drills/felt.tsx), so a key reads the same everywhere it is offered.
 */
export function KeyBadge({
  k,
  onPrimary = false,
  small = false,
}: {
  k: string
  onPrimary?: boolean
  /** For the sizer's small preset buttons, as `HandSeat` sizes it in the drills. */
  small?: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute grid place-items-center font-medium leading-none',
        small
          ? 'right-1 top-1 h-4 min-w-4 rounded px-0.5 text-[0.6rem]'
          : 'right-2 top-2 h-5 min-w-5 rounded-md px-1 text-[0.65rem]',
        onPrimary
          ? 'bg-primary-foreground/10 text-primary-foreground/60'
          : 'bg-foreground/[0.06] text-muted-foreground',
      )}
    >
      {k}
    </span>
  )
}

/** A key, written out in a sentence or the list. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-5 min-w-5 place-items-center rounded-md bg-foreground/[0.08] px-1.5 font-sans text-[0.65rem] font-medium leading-none text-foreground/80">
      {children}
    </kbd>
  )
}

/** The list `?` opens. */
export function TableKeysDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard</DialogTitle>
        </DialogHeader>
        <dl className="flex flex-col gap-1.5 pt-1">
          {KEY_LIST.map((row) => (
            <div
              key={row.does}
              className="flex items-center justify-between gap-4 rounded-xl bg-foreground/[0.03] px-3 py-2"
            >
              <dt className="text-sm">{row.does}</dt>
              <dd className="flex shrink-0 gap-1">
                {row.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
