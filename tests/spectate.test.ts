import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'

// Watching it out after you bust (pip-web#120).
//
// There is no browser here, so what can be checked is the shape of the thing
// rather than the screen: that the spectator view cannot be reached while a
// hand is live, that it changes nothing about the run, and that the table still
// does not know what a membership is.
//
// What this cannot cover, and what still needs somebody to sit down and bust:
// that the pause between hands reads as a pause rather than a freeze, that six
// seats playing down to one is watchable rather than long, and that the cards
// going face up feels like the reward it is meant to be.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

const STORE = 'src/store/game.ts'
const TABLE = 'src/components/table/Table.tsx'
const DIALOG = 'src/components/table/PlayerDialog.tsx'

// The three refusals, in the store, where both callers have to go through them.
// A screen deciding for itself is the `lib/sitDown` bug one room over.
test('watching is refused to non-members, at cash tables, and before you are out', (t) => {
  const source = code(STORE)
  const body = source.slice(source.indexOf('watchItOut: () =>'))
  t.regex(body, /if \(!venue \|\| venue\.cash\) return/, 'a cash table has no finish to watch')
  t.regex(body, /if \(status !== 'busted'\) return/, 'watching is reachable before busting')
  t.regex(body, /if \(!member\) return/, 'watching is not gated on the membership')
})

// The equity readout is the part that would be a cheat if it leaked. The guard
// belongs upstream of the component, so that a prop nobody passed is not the
// only thing standing between a live opponent and their hole cards.
test('the spectator readout answers nothing while a hand is live', (t) => {
  const source = code(STORE)
  const body = source.slice(source.indexOf('spectatorEquity: (playerId)'))
  t.regex(
    body,
    /if \(status !== 'watching' \|\| !hand\) return null/,
    'spectatorEquity answers outside the spectator view',
  )
  t.regex(
    body,
    /status === 'folded' \|\| player\.status === 'out'/,
    'a folded player still returns an equity',
  )
})

// Busting already records the place, the venue result, the challenge result and
// the recap. Watching afterwards is a spectator seat at a game that is over, so
// the recording path must not be reachable a second time.
test('watching records nothing — the run was settled when the chips went', (t) => {
  // Bounded by two pieces of *code*, not by a comment: `code()` strips comments
  // before this runs, so slicing to a `//` marker silently ran to the end of the
  // file and scanned the whole store. The end marker is the human-outcome
  // branch the watching branch sits immediately above.
  const source = code(STORE)
  const start = source.indexOf("if (get().status === 'watching') {")
  const end = source.indexOf('if (!humanAlive) {', start)
  t.true(start > 0, 'the watching branch is gone from finishHand')
  t.true(end > start, 'the watching branch is no longer above the human-outcome branch')
  const watchBlock = source.slice(start, end)
  for (const forbidden of [
    'recordVenueResult',
    'recordChallengeResult',
    'recordDailyResult',
    'recordRollPoint',
    'adjustRoll',
    'makeRecap',
    'mergeStats',
  ]) {
    t.false(watchBlock.includes(forbidden), `the watching branch calls ${forbidden}`)
  }
})

// The rule from tests/membershipSurfaces.test.ts, restated from the other side:
// the table is *told* whether this is a member's table when it opens, and never
// asks. This is the test that fails if somebody "simplifies" it to a hook.
test('the table is handed its membership and never looks it up', (t) => {
  const store = code(STORE)
  t.regex(store, /member: human\.member/, 'sitDown does not carry the membership onto the table')
  t.notRegex(
    store,
    /useEntitlement|useMembership/,
    'the game store reaches for the entitlement store',
  )
  t.notRegex(
    code(TABLE),
    /useEntitlement|useMembership/,
    'the table reaches for the entitlement store',
  )
})

// Nothing may be revealed by the spectator view that a live table would keep
// back. The reveal flag is one expression and it is worth pinning, because
// widening it by accident shows a live opponent's cards.
test('cards go face up for a spectator and for a showdown, and nothing else', (t) => {
  const source = code(TABLE)
  t.regex(source, /const spectating = status === 'watching'/)
  t.regex(source, /const revealAll = showdownReveal \|\| spectating/)
  // Every seat's reveal reads the combined flag, so there is one rule rather
  // than one per render site.
  const reveals = source.match(/reveal=\{[^}]*\}/g) ?? []
  t.true(reveals.length >= 2, `found ${reveals.length} reveal sites, expected the table's two`)
  for (const site of reveals) {
    t.true(site.includes('revealAll'), `a reveal site does not use the shared rule: ${site}`)
  }
})

// The dialog takes the cards and the number as props it can only be given, and
// never reaches for them itself.
test('the player dialog cannot find a hole card on its own', (t) => {
  const source = code(DIALOG)
  t.notRegex(source, /useGame/, 'the dialog reads the game store directly')
  t.regex(source, /hole\?: readonly Card\[\] \| null/)
  t.regex(source, /equity\?: number \| null/)
})

// A spectated table still has to clean up after itself. The pause between hands
// is a timer, and a timer that outlives the table deals a hand into a store
// that has moved on.
test('leaving cancels the pause between spectated hands', (t) => {
  const source = code(STORE)
  const clear = source.slice(source.indexOf('function clearTimers()'))
  t.regex(clear.slice(0, 200), /watchTimer/, 'clearTimers does not cancel the spectator pause')
  t.regex(source, /let watchTimer/, 'the spectator pause is not held anywhere it can be cancelled')
})

// Sanity: the files this test reasons about all still exist and are the ones
// named. A test that silently reads nothing passes for the wrong reason.
test('the files this test reads are really there', (t) => {
  for (const path of [STORE, TABLE, DIALOG]) {
    t.true(read(path).length > 500, `${path} is missing or suspiciously small`)
  }
  t.true(readdirSync(new URL('../src/components/table', import.meta.url)).includes('Table.tsx'))
})
