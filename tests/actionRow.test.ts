import { readFileSync } from 'node:fs'
import test from 'ava'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActionBar } from '@/components/table/ActionBar'
import { ACTION_BUTTON_BOX, ActionRow } from '@/components/table/ActionRow'
import { PreActions } from '@/components/room/PreActions'
import { startHand } from '@/lib/poker/engine'

// The action row must hold one height in every state, or the `flex-1` felt
// above it resizes. These hold it to one reserve with the buttons' own box, no px.

const SRC = new URL('../src/', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, SRC), 'utf-8')

const ROW_FILES = [
  'components/table/ActionRow.tsx',
  'components/table/ActionBar.tsx',
  'components/table/Table.tsx',
  'components/room/RoomTable.tsx',
  'components/room/PreActions.tsx',
]

test('nothing in the action row is held to a height written in px', (t) => {
  // A px height is right at one root font size. The text size setting and the
  // browser's own font size both move the root, and the buttons go with it.
  const offenders: string[] = []
  for (const file of ROW_FILES) {
    for (const match of read(file).matchAll(/\b(?:min-|max-)?h-\[[0-9.]+px\]/g)) {
      offenders.push(`${file}: ${match[0]}`)
    }
  }
  t.deepEqual(offenders, [], `reserve the row with ActionRow instead:\n${offenders.join('\n')}`)
})

test('both tables put their actions in the one row', (t) => {
  for (const file of ['components/table/Table.tsx', 'components/room/RoomTable.tsx']) {
    const source = read(file)
    t.true(source.includes('<ActionRow'), `${file} lost <ActionRow>`)
    // Its own copy of the container would be a row without the reserve.
    t.false(source.includes('max-w-xl px-6 pt-4 pb-7'), `${file} draws its own row`)
  }
})

test('every state of the room’s row sits inside the one row', (t) => {
  const row = read('components/room/RoomTable.tsx').split('<ActionRow')[1]?.split('</ActionRow>')[0]
  for (const state of ['catchUp.skip', '<PreActions', '<ActionBar', 'Watching it out']) {
    t.true(row?.includes(state), `${state} is outside <ActionRow>`)
  }
})

test('the catching-up line fills the row instead of setting a height', (t) => {
  const row = read('components/room/RoomTable.tsx').split('<ActionRow')[1] ?? ''
  const line = row.split('catching ? (')[1]?.split(') : hero && pending')[0] ?? ''
  const box = line.match(/className="([^"]*)"/)?.[1] ?? ''
  t.true(box.includes('self-stretch'), box)
  t.false(/(?:^|\s)(?:min-|max-)?h-/.test(box), `the line sets its own height: ${box}`)
})

test('the whose-move line over the room’s row is there whenever the row is yours', (t) => {
  // Shown only after catching up, it would add a line to the row as it ends.
  const open = read('components/room/RoomTable.tsx')
    .split('<ActionRow')[1]
    ?.split('\n          >')[0]
  const line = open?.split('line={')[1] ?? ''
  t.true(line.includes('{turnLine}'), 'the whose-move line is not the row’s line')
  t.false(line.includes('!catching'), 'the whose-move line goes away while catching up')
  const html = renderToStaticMarkup(
    createElement(ActionRow, { compact: true, line: createElement('p', null, 'Your move') }),
  )
  // Over the reserve's cell, not in it.
  t.regex(html, /<p>Your move<\/p><div class="grid /)
})

test('the reserve has exactly the action buttons’ box', (t) => {
  // The reserve matches the buttons only while it has their padding and type.
  const tokens = ACTION_BUTTON_BOX.split(' ')
  const pill = read('components/table/ActionBar.tsx').split('function Pill(')[1] ?? ''
  const nextHand = read('components/table/Table.tsx').split('onClick={nextHand}')[1] ?? ''
  const pre = read('components/room/PreActions.tsx').split('<motion.button')[1] ?? ''
  for (const [name, source] of [
    ['Pill', pill],
    ['Next hand', nextHand.split('</button>')[0]],
    ['PreActions', pre.split('<span')[0]],
  ] as const) {
    for (const token of tokens) t.true(source.includes(token), `${name} lost ${token}`)
    t.false(/\bpy-(?!4\b)\d/.test(source.split('className')[1] ?? ''), `${name} has other padding`)
    // A label that wraps is a taller button than the reserve.
    t.true(source.includes('whitespace-nowrap'), `${name} can wrap`)
  }
})

test('the reserve is one invisible line, out of the accessibility tree', (t) => {
  const html = renderToStaticMarkup(
    createElement(ActionRow, { compact: false }, createElement('button', null, 'Next hand')),
  )
  // One grid cell for everything: the cell is as tall as the tallest thing in it.
  t.regex(html, /class="grid items-center \*:col-start-1 \*:row-start-1"/)
  t.regex(
    html,
    /<div aria-hidden="true" class="py-4 text-base font-semibold invisible">\u00a0<\/div>/,
  )
  t.regex(html, /<button>Next hand<\/button>/)
})

test('off turn the bar draws nothing, and the row keeps its height by itself', (t) => {
  // It used to draw a 56px placeholder of its own, which was the bug.
  const hand = startHand({
    seats: [
      { id: 'hero', name: 'Player', stack: 200 },
      { id: 'villain', name: 'Villain', stack: 200 },
    ],
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
  })
  const toAct = hand.players[hand.toActIndex].id
  const other = hand.players.find((p) => p.id !== toAct)!.id
  t.is(renderToStaticMarkup(createElement(ActionBar, { hand, viewerId: other })), '')
  t.regex(renderToStaticMarkup(createElement(ActionBar, { hand, viewerId: toAct })), /Fold/)
})

test('moves set ahead show only while somebody else acts, on one line each', (t) => {
  const hand = startHand({
    seats: [
      { id: 'hero', name: 'Player', stack: 200 },
      { id: 'villain', name: 'Villain', stack: 200 },
    ],
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
  })
  const toAct = hand.players[hand.toActIndex].id
  const other = hand.players.find((p) => p.id !== toAct)!.id
  const render = (heroId: string) =>
    renderToStaticMarkup(
      createElement(PreActions, { hand, handIndex: 1, heroId, pre: null, onSet: () => {} }),
    )
  // Your turn is the ActionBar's; the row keeps its height by itself in between.
  t.is(render(toAct), '')
  const html = render(other)
  const buttons = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1])
  t.is(buttons.length, 2)
  for (const box of buttons) {
    for (const token of [...ACTION_BUTTON_BOX.split(' '), 'whitespace-nowrap']) {
      t.true(box.split(' ').includes(token), `a set-ahead button lost ${token}`)
    }
  }
})
