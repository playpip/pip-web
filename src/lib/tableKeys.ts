// The table's keyboard: which key does what, and when a key is the table's.
//
// F, C and R press the three buttons, whatever they say at that moment. R only
// opens the sizer, never bets: a size is a decision. Space and X only check, so
// a resting hand never calls.

import type { LegalActions } from '@/lib/poker/engine'

/**
 * A desktop: a mouse or trackpad, and no touchscreen anywhere. Tablets with a
 * trackpad and touchscreen laptops are out. Pointers, not width.
 */
export const KEYBOARD_QUERY = '(hover: hover) and (pointer: fine) and (not (any-pointer: coarse))'

/** What a key asks the table for. `sizer` opens the bet/raise sizer. */
export type TableIntent = 'fold' | 'check' | 'call' | 'sizer' | 'help'

/** The parts of a `KeyboardEvent` read here. */
export interface KeyPress {
  key: string
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  repeat?: boolean
  isComposing?: boolean
}

/** The letter on each button. */
export const BUTTON_KEYS = { fold: 'F', middle: 'C', raise: 'R' } as const

/** The sizer's presets, in order: ½ pot, ¾ pot, pot, max. */
export const SIZER_PRESET_KEYS = ['1', '2', '3', '4'] as const

/** The list `?` opens. `tests/tableKeys.test.ts` holds it to the code below. */
export const KEY_LIST: readonly { keys: readonly string[]; does: string }[] = [
  { keys: ['F'], does: 'Fold' },
  { keys: ['C'], does: 'Call / Check' },
  { keys: ['Space', 'X'], does: 'Check' },
  { keys: ['R'], does: 'Bet / Raise' },
  { keys: SIZER_PRESET_KEYS, does: '½ · ¾ · Pot · Max' },
  { keys: ['Enter'], does: 'Confirm' },
  { keys: ['Esc'], does: 'Close' },
  { keys: ['?'], does: 'This list' },
]

const ignored = (e: KeyPress) =>
  Boolean(e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.isComposing)

/** What a key asks for. `legal` is null off turn, when only `?` answers. */
export function intentFor(e: KeyPress, legal: LegalActions | null): TableIntent | null {
  if (ignored(e)) return null
  // `?` needs Shift on most layouts.
  if (e.key === '?') return 'help'
  if (e.shiftKey || !legal || legal.canDraw) return null

  if (e.key === ' ') return legal.canCheck ? 'check' : null
  switch (e.key.toLowerCase()) {
    case 'f':
      return 'fold'
    case 'c':
      return legal.canCheck ? 'check' : 'call'
    case 'x':
      return legal.canCheck ? 'check' : null
    case 'r':
      return legal.canBet || legal.canRaise ? 'sizer' : null
    default:
      return null
  }
}

/** Inside the open sizer: a preset (0–3, in `SIZER_PRESET_KEYS` order), or confirm. */
export type SizerIntent = { preset: number } | 'confirm'

/** The sizer's confirm button. */
export const SIZER_CONFIRM = '[data-sizer-confirm]'

/**
 * A key inside the open sizer. 1–4 pick a preset. Enter confirms, unless a
 * button other than confirm has focus: then it is that button's.
 */
export function sizerIntentFor(e: KeyPress, target?: KeyTarget | null): SizerIntent | null {
  if (ignored(e) || e.shiftKey) return null
  if (e.key === 'Enter') {
    const onButton = target?.closest?.('button') && !target.closest?.(SIZER_CONFIRM)
    return onButton ? null : 'confirm'
  }
  const preset = (SIZER_PRESET_KEYS as readonly string[]).indexOf(e.key)
  return preset === -1 ? null : { preset }
}

/** The parts of a DOM node read here. */
export interface KeyTarget {
  tagName?: string
  isContentEditable?: boolean
  closest?: (selector: string) => unknown
}

const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'
const ACTIVATES = 'button, a[href], summary, [role="button"], [role="link"], [role="checkbox"]'

/**
 * Not while typing, not while a dialog or menu is open, and Space or Enter not
 * on a focused button, which answers them itself.
 */
export function keysReachTable(
  e: KeyPress,
  target: KeyTarget | null,
  doc?: { querySelector: (selector: string) => unknown },
): boolean {
  if (doc?.querySelector(OVERLAY)) return false
  if (!target) return true
  const tag = target.tagName?.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
    return false
  }
  if (target.closest?.(OVERLAY)) return false
  if ((e.key === ' ' || e.key === 'Enter') && target.closest?.(ACTIVATES)) return false
  return true
}

/** The window listener's whole decision; null means leave the key alone. */
export function tableKeyFor(
  e: KeyPress,
  target: KeyTarget | null,
  doc: { querySelector: (selector: string) => unknown } | undefined,
  legal: LegalActions | null,
): TableIntent | null {
  return keysReachTable(e, target, doc) ? intentFor(e, legal) : null
}
