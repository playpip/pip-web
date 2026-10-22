// The table's keyboard, as pure data and pure decisions.
//
// Desktop only, and "desktop" is decided by the pointers, not the width: a
// phone in landscape and a tablet are both wide, and neither has a keyboard
// you can count on. Two things have to be true:
//
//   - the primary pointer hovers and is fine: a mouse or a trackpad, and
//   - there is no coarse pointer anywhere: no touchscreen at all.
//
// The second is what keeps a tablet out, including an iPad with a trackpad
// case, whose primary pointer can report fine. It also leaves out a laptop
// with a touchscreen, which is the accepted cost: a stray letter on a button
// somebody taps is worse than a shortcut a keyboard player goes without.
// Anything that fails either test gets nothing: no listener, no letters on the
// buttons.
//
// Two queries rather than one: `… and (not (any-pointer: coarse))` needs Media
// Queries 4, and written without the inner brackets it does not parse at all
// and quietly matches nothing. Each of these is Level 3 and reads everywhere.
//
// The keys follow the buttons rather than the other way round. There are
// three buttons and three letters, and each letter presses whatever its button
// says at that moment, so the letter on a button is the whole manual:
//
//   F  the left button, Fold.
//   C  the middle button: Call, or Check when there is nothing to call.
//   R  the right button: opens the Bet or Raise sizer. It never bets by
//      itself. A size is a decision, and one key that shoved a default amount
//      in would be the easiest misfire on the table to make and the hardest to
//      take back. Enter puts the chips in once the sizer is open.
//
// Space and X check and only check. Space is the key a hand rests on, so it is
// the one most likely to be pressed by accident, and facing a bet it does
// nothing at all rather than calling. C is the deliberate key for that.

import type { LegalActions } from '@/lib/poker/engine'

/** The primary pointer is a mouse or a trackpad. See the note at the top. */
export const KEYBOARD_QUERY = '(hover: hover) and (pointer: fine)'

/** Any pointer at all is a finger: a touchscreen. Its presence turns the keys off. */
export const TOUCH_QUERY = '(any-pointer: coarse)'

/** Whether a device gets the table's keys, from its two media query answers. */
export const keyboardDevice = (fine: boolean, touch: boolean) => fine && !touch

/** What a key asks the table for. `sizer` opens the bet/raise sizer. */
export type TableIntent = 'fold' | 'check' | 'call' | 'sizer' | 'help'

/** The parts of a `KeyboardEvent` these decisions read. */
export interface KeyPress {
  key: string
  code?: string
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  repeat?: boolean
  isComposing?: boolean
}

/** The letter on the button each one presses, for the buttons themselves. */
export const BUTTON_KEYS = { fold: 'F', middle: 'C', raise: 'R' } as const

/** The sizer's presets, in the order they sit: ½ pot, ¾ pot, pot, max. */
export const SIZER_PRESET_KEYS = ['1', '2', '3', '4'] as const

/**
 * Everything, as the shortcuts list shows it. The decisions below are what
 * actually run; `tests/tableKeys.test.ts` holds this list to them.
 */
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

const anyModifier = (e: KeyPress) => Boolean(e.ctrlKey || e.metaKey || e.altKey)

/**
 * The letter a key press means, lower case, or null.
 *
 * The printed key first, so F is F on AZERTY and on Dvorak. When the printed
 * key is not a Latin letter at all (a Cyrillic or Greek layout) the physical
 * key stands in, which is where a player on that layout would look for it.
 */
export function letterOf(e: KeyPress): string | null {
  if (/^[a-z]$/i.test(e.key)) return e.key.toLowerCase()
  const physical = e.code?.match(/^Key([A-Z])$/)
  return physical && e.key.length === 1 && !/[\x20-\x7e]/.test(e.key)
    ? physical[1].toLowerCase()
    : null
}

/**
 * What a key press asks the table for, given what is legal right now.
 *
 * `legal` is null whenever it is not the player's turn, and then only `?`
 * answers. A modifier, a held-down key repeating and an IME composition answer
 * nothing: Ctrl+R is the browser's, and a held C must not call this street and
 * then check the next one.
 */
export function intentFor(e: KeyPress, legal: LegalActions | null): TableIntent | null {
  if (anyModifier(e) || e.repeat || e.isComposing) return null
  // `?` is Shift+/ on most layouts, so it is the one key Shift is allowed on.
  if (e.key === '?') return 'help'
  if (e.shiftKey) return null
  // The draw round has one button and it is about which cards, not chips.
  if (!legal || legal.canDraw) return null

  if (e.key === ' ') return legal.canCheck ? 'check' : null
  switch (letterOf(e)) {
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

/**
 * A key press inside the open sizer. 1–4 pick a preset. Enter confirms from
 * the slider or the confirm button; on any other button it is that button's.
 */
export function sizerIntentFor(e: KeyPress, target?: KeyTarget | null): SizerIntent | null {
  if (anyModifier(e) || e.shiftKey || e.repeat || e.isComposing) return null
  if (e.key === 'Enter') {
    const onButton = target?.closest?.('button') && !target.closest?.(SIZER_CONFIRM)
    return onButton ? null : 'confirm'
  }
  const preset = (SIZER_PRESET_KEYS as readonly string[]).indexOf(e.key)
  return preset === -1 ? null : { preset }
}

/** The parts of a DOM node these checks read; duck-typed so node can test them. */
export interface KeyTarget {
  tagName?: string
  isContentEditable?: boolean
  closest?: (selector: string) => unknown
}

/** The sizer's confirm button. */
export const SIZER_CONFIRM = '[data-sizer-confirm]'
/** Something already open over the table that owns the keyboard while it is. */
const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'
/** Elements whose own Space and Enter already do something. */
const ACTIVATES = 'button, a[href], summary, [role="button"], [role="link"], [role="checkbox"]'

/**
 * Whether a key press aimed at `target` is the table's to answer.
 *
 * Not when somebody is typing (an input, a textarea, a select, anything
 * editable), not when a dialog or a menu is open, and Space or Enter not when
 * a focused button would answer them itself: a player who tabbed to Fold and
 * pressed Space meant that button, not a check.
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

/**
 * Everything the table's listener decides, in one place: what a key press on
 * `target` asks for, or null for "not ours, leave it alone" (and then nothing
 * is prevented). `legal` is null when it is not the player's turn.
 */
export function tableKeyFor(
  e: KeyPress,
  target: KeyTarget | null,
  doc: { querySelector: (selector: string) => unknown } | undefined,
  legal: LegalActions | null,
): TableIntent | null {
  return keysReachTable(e, target, doc) ? intentFor(e, legal) : null
}

/** The parts of `window` registering the listener needs. */
export interface KeyWindow {
  matchMedia?: (query: string) => { matches: boolean }
  addEventListener: (type: 'keydown', listener: (e: KeyboardEvent) => void) => void
  removeEventListener: (type: 'keydown', listener: (e: KeyboardEvent) => void) => void
}

/**
 * Listen for the table's keys, on a device with a keyboard only.
 *
 * Returns the cleanup, or null when nothing was registered — which is every
 * phone, every tablet, every touchscreen laptop, and anywhere without
 * `matchMedia` at all.
 */
export function listenForTableKeys(
  win: KeyWindow | undefined,
  onKey: (e: KeyboardEvent) => void,
): (() => void) | null {
  // Called on `win`, never pulled off it: `matchMedia` is a method of the
  // window, and a browser throws "Illegal invocation" if it is called bare.
  if (!win?.matchMedia) return null
  const fine = win.matchMedia(KEYBOARD_QUERY).matches
  const touch = win.matchMedia(TOUCH_QUERY).matches
  if (!keyboardDevice(fine, touch)) return null
  win.addEventListener('keydown', onKey)
  return () => win.removeEventListener('keydown', onKey)
}
