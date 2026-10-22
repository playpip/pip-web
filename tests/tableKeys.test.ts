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
  keysReachTable,
  SIZER_PRESET_KEYS,
  sizerIntentFor,
  tableKeyFor,
  type KeyPress,
  type KeyTarget,
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

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({ key, ...extra })

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

test('desktop is one query on the pointers, never the width', (t) => {
  // A fine hovering primary pointer, and no touchscreen anywhere: that keeps
  // out tablets with a trackpad and touchscreen laptops as well as phones.
  t.is(KEYBOARD_QUERY, '(hover: hover) and (pointer: fine) and (not (any-pointer: coarse))')
  for (const file of ['src/lib/tableKeys.ts', 'src/components/table/keys.tsx']) {
    const src = readFileSync(file, 'utf8')
    t.false(/useIsMobile|max-width|min-width/.test(src), file)
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

test('in the sizer, Enter bets from the slider, the confirm button or no focus', (t) => {
  t.is(sizerIntentFor(press('Enter'), node('INPUT')), 'confirm')
  t.is(sizerIntentFor(press('Enter'), node('BUTTON', ['[data-sizer-confirm]'])), 'confirm')
  t.is(sizerIntentFor(press('Enter'), node('DIV', ['[role="dialog"]'])), 'confirm')
  t.is(sizerIntentFor(press('Enter'), null), 'confirm')
})

test('in the sizer, Enter on a focused preset picks it rather than betting', (t) => {
  // Tabbed to Pot, or to Max, or to the close button: Enter is that button's.
  t.is(sizerIntentFor(press('Enter'), node('BUTTON')), null)
  t.is(sizerIntentFor(press('Enter'), node('BUTTON', ['[data-slot="dialog-close"]'])), null)
  // The presets' digits answer wherever focus is.
  t.deepEqual(sizerIntentFor(press('3'), node('BUTTON')), { preset: 2 })
})

test('server render and touch render: no letters, no aria-keyshortcuts', (t) => {
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
