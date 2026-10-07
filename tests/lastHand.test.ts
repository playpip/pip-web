import { readFileSync } from 'node:fs'
import test from 'ava'

// Seeing the hand that ended the run (pip-web#198).
//
// The end card covered the felt the moment the last hand resolved, so a player
// knocked out or crowned never saw the cards that did it. No browser here, so
// this checks the shape: the store keeps the line that names the winning hand,
// and every end card can be set aside and comes back.
//
// What this cannot cover, and needs somebody to bust on a phone: that the
// cards are face up and readable with the card set aside, and that "Back"
// brings the card back with its buttons working.

const code = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

const STORE = 'src/store/game.ts'
const TABLE = 'src/components/table/Table.tsx'

test('every end state keeps the line naming who won the last hand', (t) => {
  const source = code(STORE)
  for (const status of [
    "status: 'busted',\n        place,",
    "status: 'won',",
    "status: 'busted',\n        place: null,",
  ]) {
    const at = source.indexOf(status)
    t.true(at > -1, `no end state starting ${status}`)
    const block = source.slice(at, source.indexOf('})', at))
    t.regex(block, /message: describeResult\(hand\)/, `${status} clears the result line`)
  }
})

test('every end card offers the last hand, and steps aside for it', (t) => {
  const source = code(TABLE)
  const overlays = source.split('<EndOverlay').slice(1)
  t.is(overlays.length, 3, 'expected the cash bust, tournament bust and win cards')
  for (const o of overlays) t.regex(o.slice(0, o.indexOf('onHome=')), /onPeek=\{peek\}/)
  t.regex(source, /status === 'busted' &&\s*!peeking/)
  t.regex(source, /status === 'won' && !peeking/)
})

// Keyed on the hand it was set aside on, so a cash rebuy that busts again shows
// the card again rather than inheriting a stale "set aside" from the last bust.
test('setting the card aside lasts one hand', (t) => {
  const source = code(TABLE)
  t.regex(source, /peekedAt === handIndex/)
  t.regex(source, /setPeekedAt\(null\)/, 'nothing brings the end card back')
})
