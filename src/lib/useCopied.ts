'use client'

/**
 * The "Copied ✓" flag that puts itself away.
 *
 * Three places flipped a `copied` boolean to true and never set it back
 * (pip-web #20): the transfer dialog's Copy code button, the Daily tile's
 * share, and the hand-history share link. A confirmation that never clears
 * reads as a disabled button, and on the Daily tile it was worse than that,
 * because "Copied" sat in place of the player's finishing position for the
 * rest of the session.
 *
 * The timing lives here rather than in each component so the next copy button
 * cannot reintroduce it. `tests/useCopied.test.ts` drives the core with a fake
 * clock, which is the only way to assert the two things that actually go wrong:
 * a second click must restart the window rather than stack a stale timer, and
 * unmounting must cancel it rather than set state on a dead component.
 */

import { useEffect, useRef, useState } from 'react'

/** Long enough to read, short enough that you don't think it's stuck. */
export const COPIED_MS = 2000

/** Injectable so tests get a clock they control. */
export type CopiedTimers = {
  set: (fn: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
}

const realTimers: CopiedTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export type CopiedTimer = {
  /** Show the confirmation and (re)start the window. */
  fire: () => void
  /** Drop the pending reset without firing it. For unmount. */
  cancel: () => void
}

/**
 * The React-free half. `onChange` is the setter; everything else is one
 * pending handle, cleared before it is replaced.
 */
export function createCopiedTimer(
  onChange: (copied: boolean) => void,
  delay: number = COPIED_MS,
  timers: CopiedTimers = realTimers,
): CopiedTimer {
  let pending: unknown = null

  const cancel = () => {
    if (pending !== null) {
      timers.clear(pending)
      pending = null
    }
  }

  return {
    fire() {
      cancel()
      onChange(true)
      pending = timers.set(() => {
        pending = null
        onChange(false)
      }, delay)
    },
    cancel,
  }
}

/**
 * `const [copied, copy] = useCopied()`. Call `copy()` once the clipboard
 * write has actually resolved, so the tick never claims something that failed.
 */
export function useCopied(delay: number = COPIED_MS): readonly [boolean, () => void] {
  const [copied, setCopied] = useState(false)
  const timer = useRef<CopiedTimer | null>(null)
  if (timer.current === null) timer.current = createCopiedTimer(setCopied, delay)

  // Unmount only. A pending reset firing into a gone component is a no-op in
  // React 19, but it keeps a timer alive for two seconds for no reason.
  useEffect(() => () => timer.current?.cancel(), [])

  return [copied, () => timer.current?.fire()] as const
}
