import { readFileSync } from 'node:fs'
import test from 'ava'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActionBar } from '@/components/table/ActionBar'
import { applyAction, legalActions, startHand, type LegalActions } from '@/lib/poker/engine'
import {
  BUTTON_KEYS,
  intentFor,
  KEY_LIST,
  KEYBOARD_QUERY,
  keyboardDevice,
  keysKnown,
  keysReachTable,
  letterOf,
  listenForTableKeys,
  SIZER_PRESET_KEYS,
  sizerIntentFor,
  tableKeyFor,
  TOUCH_QUERY,
  type KeyPress,
  type KeyTarget,
  type KeyWindow,
} from '@/lib/tableKeys'

// Real spots from the real engine rather than hand-built flags, so the keys are
// tested against the same `legalActions` the buttons are drawn from.
const seats = () => [
  { id: 'hero', name: 'Player', stack: 200 },
  { id: 'villain', name: 'Villain', stack: 200 },
]
const preflop = () => startHand({ seats: seats(), buttonIndex: 0, smallBlind: 5, bigBlind: 10 })

/** The button facing the big blind: there is something to call. */
const facingBet = (): LegalActions => legalActions(preflop())!
/** The big blind after the button limps: nothing to call. */
const canCheck = (): LegalActions => legalActions(applyAction(preflop(), { type: 'call' }))!
/** Facing a shove for more than the stack: call or fold, nothing to raise. */
const callOrFold = (): LegalActions => ({
  ...facingBet(),
  canRaise: false,
  canBet: false,
})
const drawRound = (): LegalActions => ({ ...canCheck(), canDraw: true })

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  key,
  code: /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : key === ' ' ? 'Space' : undefined,
  ...extra,
})

test('the spots are what they say they are', (t) => {
  t.false(facingBet().canCheck)
  t.true(facingBet().callAmount > 0)
  t.true(canCheck().canCheck)
  t.true(canCheck().canBet || canCheck().canRaise)
})

test('facing a bet: F folds, C calls, R opens the sizer', (t) => {
  t.is(intentFor(press('f'), facingBet()), 'fold')
  t.is(intentFor(press('c'), facingBet()), 'call')
  t.is(intentFor(press('r'), facingBet()), 'sizer')
})

test('with nothing to call: C checks rather than calling, Space and X check', (t) => {
  t.is(intentFor(press('c'), canCheck()), 'check')
  t.is(intentFor(press(' '), canCheck()), 'check')
  t.is(intentFor(press('x'), canCheck()), 'check')
  t.is(intentFor(press('r'), canCheck()), 'sizer')
  // Fold is a button whenever it is your turn, so its letter is too.
  t.is(intentFor(press('f'), canCheck()), 'fold')
})

test('Space and X never call: facing a bet they do nothing', (t) => {
  t.is(intentFor(press(' '), facingBet()), null)
  t.is(intentFor(press('x'), facingBet()), null)
})

test('R never bets by itself: it only ever opens the sizer', (t) => {
  for (const legal of [facingBet(), canCheck()]) {
    t.is(intentFor(press('r'), legal), 'sizer')
  }
})

test('R does nothing when there is no Bet or Raise button', (t) => {
  t.is(intentFor(press('r'), callOrFold()), null)
  t.is(intentFor(press('c'), callOrFold()), 'call')
})

test('off turn, only ? answers', (t) => {
  for (const key of ['f', 'c', 'r', 'x', ' ', 'Enter']) {
    t.is(intentFor(press(key), null), null, key)
  }
  t.is(intentFor(press('?', { shiftKey: true }), null), 'help')
})

test('the draw round has no betting keys', (t) => {
  for (const key of ['f', 'c', 'r', 'x', ' ']) {
    t.is(intentFor(press(key), drawRound()), null, key)
  }
  t.is(intentFor(press('?', { shiftKey: true }), drawRound()), 'help')
})

test('a modifier always belongs to the browser', (t) => {
  for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) {
    for (const key of ['f', 'c', 'r', 'x', ' ', '?']) {
      t.is(intentFor(press(key, { [mod]: true }), facingBet()), null, `${mod}+${key}`)
      t.is(intentFor(press(key, { [mod]: true }), canCheck()), null, `${mod}+${key}`)
    }
  }
})

test('Shift stands everything down except ?, which needs it', (t) => {
  for (const key of ['F', 'C', 'R', 'X', ' ']) {
    t.is(intentFor(press(key, { shiftKey: true }), canCheck()), null, key)
  }
  t.is(intentFor(press('?', { shiftKey: true }), canCheck()), 'help')
  t.is(intentFor(press('?'), canCheck()), 'help')
})

test('a held key repeating does nothing, and nor does an IME composition', (t) => {
  t.is(intentFor(press('c', { repeat: true }), facingBet()), null)
  t.is(intentFor(press(' ', { repeat: true }), canCheck()), null)
  t.is(intentFor(press('?', { repeat: true }), canCheck()), null)
  t.is(intentFor(press('c', { isComposing: true }), facingBet()), null)
})

test('Caps Lock is not Shift: an upper-case letter with no Shift still works', (t) => {
  t.is(intentFor(press('F'), facingBet()), 'fold')
  t.is(intentFor(press('C'), facingBet()), 'call')
})

test('other keys do nothing', (t) => {
  for (const key of ['a', 'b', 'k', 'Enter', 'Escape', 'ArrowUp', '1', 'Tab']) {
    t.is(intentFor(press(key), facingBet()), null, key)
  }
})

test('the printed letter decides, and a non-Latin layout falls back to the physical key', (t) => {
  // Dvorak: the key printed F sits where QWERTY has Y.
  t.is(letterOf({ key: 'f', code: 'KeyY' }), 'f')
  // AZERTY: the key printed A is QWERTY's Q. It is A, not anything we map.
  t.is(letterOf({ key: 'a', code: 'KeyQ' }), 'a')
  // Russian: the key under F prints а. There is no F on the board, so the
  // physical key stands in.
  t.is(letterOf({ key: 'а', code: 'KeyF' }), 'f')
  t.is(intentFor({ key: 'с', code: 'KeyC' }, facingBet()), 'call')
  // Punctuation on the physical letter's key is not a letter.
  t.is(letterOf({ key: ';', code: 'KeyS' }), null)
  t.is(letterOf({ key: 'Enter', code: 'Enter' }), null)
})

test('in the sizer: 1–4 are the presets, Enter confirms, nothing else answers', (t) => {
  t.deepEqual(
    SIZER_PRESET_KEYS.map((key) => sizerIntentFor(press(key))),
    [{ preset: 0 }, { preset: 1 }, { preset: 2 }, { preset: 3 }],
  )
  t.is(sizerIntentFor(press('Enter')), 'confirm')
  for (const key of ['5', '0', 'r', ' ', 'Escape']) t.is(sizerIntentFor(press(key)), null, key)
  for (const mod of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'repeat'] as const) {
    t.is(sizerIntentFor(press('Enter', { [mod]: true })), null, mod)
    t.is(sizerIntentFor(press('1', { [mod]: true })), null, mod)
  }
})

// A pretend DOM node: a tag, and the selectors it sits inside.
const node = (tagName: string, inside: string[] = [], editable = false): KeyTarget => ({
  tagName,
  isContentEditable: editable,
  closest: (selector) =>
    selector
      .split(',')
      .map((s) => s.trim())
      .some((s) => inside.includes(s) || s === tagName.toLowerCase())
      ? {}
      : null,
})
const noDialog = { querySelector: () => null }

test('typing into anything never reaches the table', (t) => {
  for (const target of [node('INPUT'), node('TEXTAREA'), node('SELECT'), node('DIV', [], true)]) {
    for (const key of ['f', 'c', 'r', ' ', '?']) {
      t.false(keysReachTable(press(key), target, noDialog), `${target.tagName} ${key}`)
    }
  }
})

test('an open dialog or menu owns the keyboard', (t) => {
  const open = { querySelector: (s: string) => (s.includes('[role="dialog"]') ? {} : null) }
  t.false(keysReachTable(press('c'), node('BODY'), open))
  t.false(keysReachTable(press('f'), node('BUTTON', ['[role="dialog"]']), noDialog))
  t.false(keysReachTable(press('f'), node('DIV', ['[role="menu"]']), noDialog))
  t.false(keysReachTable(press('?'), node('DIV', ['[role="alertdialog"]']), noDialog))
})

test('Space on a focused button is that button’s, letters are still the table’s', (t) => {
  const button = node('BUTTON')
  t.false(keysReachTable(press(' '), button, noDialog))
  t.false(keysReachTable(press('Enter'), button, noDialog))
  t.false(keysReachTable(press(' '), node('A', ['a[href]']), noDialog))
  t.true(keysReachTable(press('f'), button, noDialog))
  t.true(keysReachTable(press('c'), button, noDialog))
})

test('the page itself reaches the table', (t) => {
  t.true(keysReachTable(press(' '), node('BODY'), noDialog))
  t.true(keysReachTable(press('c'), node('DIV'), noDialog))
  t.true(keysReachTable(press('c'), null, noDialog))
  t.true(keysReachTable(press('c'), null))
})

/**
 * A pretend window: how it answers the two media queries, and the listeners
 * it was handed. `undefined` is a window with no `matchMedia` at all.
 */
function fakeWindow(device: { fine: boolean; touch: boolean } | undefined) {
  const listeners = new Set<unknown>()
  const queries: string[] = []
  const win: KeyWindow = {
    // A method, not an arrow, and it insists on being called on the window the
    // way a browser's does: `const m = window.matchMedia; m(q)` throws there.
    matchMedia:
      device === undefined
        ? undefined
        : function (this: unknown, query: string) {
            if (this !== win) throw new TypeError('Illegal invocation')
            queries.push(query)
            return {
              matches:
                query === KEYBOARD_QUERY ? device.fine : query === TOUCH_QUERY && device.touch,
            }
          },
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
  }
  return { win, listeners, queries }
}

test('a mouse or trackpad and no touchscreen: it listens, and the cleanup stops it', (t) => {
  const { win, listeners, queries } = fakeWindow({ fine: true, touch: false })
  const stop = listenForTableKeys(win, () => {})
  t.is(listeners.size, 1)
  t.deepEqual(queries.sort(), [KEYBOARD_QUERY, TOUCH_QUERY].sort())
  t.truthy(stop)
  stop?.()
  t.is(listeners.size, 0)
})

test('a phone, a tablet, a tablet with a trackpad, a touchscreen laptop: nothing at all', (t) => {
  const devices = {
    // A finger is the only pointer.
    phone: { fine: false, touch: true },
    // An iPad with a trackpad case can report a fine primary pointer, and it
    // still has the touchscreen. So does a laptop with one.
    'tablet with a trackpad, or a touchscreen laptop': { fine: true, touch: true },
    // A TV remote or a stylus-only screen: no fine primary, nothing coarse.
    'no fine pointer': { fine: false, touch: false },
  }
  for (const [name, device] of Object.entries(devices)) {
    const { win, listeners } = fakeWindow(device)
    t.is(
      listenForTableKeys(win, () => {}),
      null,
      name,
    )
    t.is(listeners.size, 0, name)
  }
})

test('nowhere to ask, or no window: nothing registered', (t) => {
  const { win, listeners } = fakeWindow(undefined)
  t.is(
    listenForTableKeys(win, () => {}),
    null,
  )
  t.is(listeners.size, 0)
  t.is(
    listenForTableKeys(undefined, () => {}),
    null,
  )
})

test('the device test is: fine primary pointer, and no coarse pointer anywhere', (t) => {
  t.true(keyboardDevice(true, false))
  t.false(keyboardDevice(true, true))
  t.false(keyboardDevice(false, false))
  t.false(keyboardDevice(false, true))
})

test('desktop is the pointers, never the width, and every query parses', (t) => {
  t.is(KEYBOARD_QUERY, '(hover: hover) and (pointer: fine)')
  t.is(TOUCH_QUERY, '(any-pointer: coarse)')
  for (const query of [KEYBOARD_QUERY, TOUCH_QUERY]) {
    t.false(/width/.test(query), query)
    // `… and not (x)` is not a media query: browsers read it as `not all`,
    // which matches nothing and would switch the keys off without a word.
    t.false(/\bnot\b/.test(query), query)
  }
  // And nothing on the keyboard's path quietly re-gates it on the screen size.
  for (const file of ['src/lib/tableKeys.ts', 'src/components/table/keys.tsx']) {
    const src = readFileSync(file, 'utf8')
    t.false(/useIsMobile|max-width|min-width|\bsm:grid\b/.test(src), file)
  }
})

test('the listener stands down, and prevents nothing, for every press that is not the table’s', (t) => {
  const body = node('BODY')
  const field = node('INPUT')
  const open = { querySelector: (s: string) => (s.includes('[role="dialog"]') ? {} : null) }
  // Space facing a bet: not a call, and not prevented either.
  t.is(tableKeyFor(press(' '), body, noDialog, facingBet()), null)
  // Typing, an open dialog (the sizer itself, or the list), off turn.
  t.is(tableKeyFor(press('c'), field, noDialog, facingBet()), null)
  t.is(tableKeyFor(press('c'), body, open, facingBet()), null)
  t.is(tableKeyFor(press('r'), body, open, canCheck()), null)
  t.is(tableKeyFor(press('?', { shiftKey: true }), body, open, null), null)
  t.is(tableKeyFor(press('c'), body, noDialog, null), null)
  // A modifier, a repeat.
  t.is(tableKeyFor(press('c', { metaKey: true }), body, noDialog, facingBet()), null)
  t.is(tableKeyFor(press('c', { repeat: true }), body, noDialog, facingBet()), null)
  // Space on a focused button is that button's.
  t.is(tableKeyFor(press(' '), node('BUTTON'), noDialog, canCheck()), null)
})

test('the listener answers what the buttons say, wherever the page has focus', (t) => {
  const body = node('BODY')
  t.is(tableKeyFor(press('f'), body, noDialog, facingBet()), 'fold')
  t.is(tableKeyFor(press('c'), body, noDialog, facingBet()), 'call')
  t.is(tableKeyFor(press('r'), body, noDialog, facingBet()), 'sizer')
  t.is(tableKeyFor(press(' '), body, noDialog, canCheck()), 'check')
  // F still folds with a free check on offer: it is the Fold button's letter.
  t.is(tableKeyFor(press('f'), body, noDialog, canCheck()), 'fold')
  // A letter on a focused button is still the table's.
  t.is(tableKeyFor(press('c'), node('BUTTON'), noDialog, canCheck()), 'check')
  t.is(tableKeyFor(press('?', { shiftKey: true }), body, noDialog, null), 'help')
  t.is(tableKeyFor(press('?', { shiftKey: true }), body, noDialog, drawRound()), 'help')
})

test('in the sizer, Enter confirms from the slider or a preset, but not from the close button', (t) => {
  t.is(sizerIntentFor(press('Enter'), node('INPUT')), 'confirm')
  t.is(sizerIntentFor(press('Enter'), node('BUTTON')), 'confirm')
  t.is(sizerIntentFor(press('Enter'), null), 'confirm')
  const close = node('BUTTON', ['[data-slot="dialog-close"]'])
  t.is(sizerIntentFor(press('Enter'), close), null)
  // The presets answer wherever focus is.
  t.deepEqual(sizerIntentFor(press('3'), close), { preset: 2 })
})

test('server render and touch render: no letters, no hint, no aria-keyshortcuts', (t) => {
  // Rendered on the server the media queries answer false, which is exactly a
  // phone's answer, so this is the markup a phone gets as well as first paint.
  for (const hand of [
    startHand({ seats: seats(), buttonIndex: 0, smallBlind: 5, bigBlind: 10 }),
    applyAction(preflop(), { type: 'call' }),
  ]) {
    const html = renderToStaticMarkup(
      createElement(ActionBar, { hand, viewerId: hand.players[hand.toActIndex].id }),
    )
    t.regex(html, /Fold/)
    t.false(html.includes('aria-keyshortcuts'))
    t.false(/keyboard/i.test(html))
    for (const letter of Object.values(BUTTON_KEYS)) t.false(html.includes(`>${letter}<`), letter)
  }
})

test('the list says what the keys do, and every key in it is one that answers', (t) => {
  const listed = KEY_LIST.flatMap((row) => row.keys)
  for (const letter of Object.values(BUTTON_KEYS)) t.true(listed.includes(letter), letter)
  for (const digit of SIZER_PRESET_KEYS) t.true(listed.includes(digit), digit)
  for (const key of ['Space', 'X', 'Enter', 'Esc', '?']) t.true(listed.includes(key), key)

  // The letters on the buttons press what the buttons say.
  t.is(intentFor(press(BUTTON_KEYS.fold.toLowerCase()), facingBet()), 'fold')
  t.is(intentFor(press(BUTTON_KEYS.middle.toLowerCase()), facingBet()), 'call')
  t.is(intentFor(press(BUTTON_KEYS.middle.toLowerCase()), canCheck()), 'check')
  t.is(intentFor(press(BUTTON_KEYS.raise.toLowerCase()), facingBet()), 'sizer')
})

test('the hint retires on "known" and on nothing else', (t) => {
  t.true(keysKnown('known'))
  for (const raw of [null, undefined, '', '1', 'true', 'KNOWN']) t.false(keysKnown(raw))
})
