'use client'

// The table's keyboard on screen. What the keys do is in `lib/tableKeys`.

import { useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { KEY_LIST, KEYBOARD_QUERY } from '@/lib/tableKeys'

/** Whether this device gets the keys at all. False on the server and first paint. */
export const useTableKeyboard = () => useMediaQuery(KEYBOARD_QUERY)

/** A window keydown listener while `enabled`. The handler lives in a ref, as in `ReviewTable`. */
export function useTableKeys(enabled: boolean, onKey: (e: KeyboardEvent) => void) {
  const handler = useRef(onKey)
  handler.current = onKey
  useEffect(() => {
    if (!enabled) return
    const listener = (e: KeyboardEvent) => handler.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [enabled])
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
                  <kbd
                    key={k}
                    className="inline-grid h-5 min-w-5 place-items-center rounded-md bg-foreground/[0.08] px-1.5 font-sans text-[0.65rem] font-medium leading-none text-foreground/80"
                  >
                    {k}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
