'use client'

// The table's keyboard, on screen: the letters on the buttons, the one-line
// hint under them until it has been seen off, and the list `?` opens. What the
// keys do is decided in `lib/tableKeys`; this file only wires and draws it.
//
// The hint is furniture, not a pop-up (docs/brand.md, principle 5): one quiet
// line in the space under the buttons that is already there, never over the
// felt, and once it has been seen off it does not come back. It retires itself
// the first time a key is used or the list is opened, because by then the
// player knows, and a × does it for anybody who never wants to.
//
// Stored per device, like the text size and for the same reason: it describes
// this keyboard. A phone or a tablet never shows it, so syncing "seen" from the laptop
// would mean nothing there, and it costs no PERSIST_VERSION bump.

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMediaQuery } from '@/lib/useMediaQuery'
import {
  KEY_LIST,
  KEYBOARD_QUERY,
  keyboardDevice,
  KEYS_KNOWN_KEY,
  keysKnown,
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

// The "seen it" flag, as a tiny external store so every table on screen agrees
// the moment it flips, without an effect.
const knownListeners = new Set<() => void>()
const readKnown = () => {
  try {
    return keysKnown(localStorage.getItem(KEYS_KNOWN_KEY))
  } catch {
    return true
  }
}

/** Whether the hint has been seen off on this device, and how to see it off. */
export function useKeysKnown(): [known: boolean, markKnown: () => void] {
  const known = useSyncExternalStore(
    (cb) => {
      knownListeners.add(cb)
      return () => knownListeners.delete(cb)
    },
    readKnown,
    // The server and the first paint say "known", so nothing flashes in.
    () => true,
  )
  const markKnown = () => {
    if (readKnown()) return
    try {
      localStorage.setItem(KEYS_KNOWN_KEY, 'known')
    } catch {}
    for (const cb of knownListeners) cb()
  }
  return [known, markKnown]
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

/**
 * The hint, under the buttons. Absolutely placed in the padding that is already
 * there, so it appearing and retiring never moves the row above it.
 */
export function TableKeysHint({
  onList,
  onDismiss,
}: {
  onList: () => void
  onDismiss: () => void
}) {
  return (
    <div className="absolute inset-x-0 top-full mt-1.5 flex items-center justify-center gap-2 text-2xs text-muted-foreground">
      <span>
        Your keyboard plays too: the letter on each button, or <Kbd>Space</Kbd> to check.
      </span>
      <button
        type="button"
        onClick={onList}
        className="font-medium underline underline-offset-4 transition hover:text-foreground"
      >
        All keys
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide this tip"
        className="grid size-5 place-items-center rounded-md transition hover:bg-foreground/[0.06] hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </div>
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
          <DialogDescription>On your turn. The letter on a button presses it.</DialogDescription>
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
