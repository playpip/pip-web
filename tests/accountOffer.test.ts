import test from 'ava'
import { readFileSync, readdirSync } from 'node:fs'

// The account is now offered on the lobby, the end-of-run overlay and the
// AppBar (#97, technology#97). That is prominence, and the line between
// prominence and nagging is the whole reason the change was allowed: the
// landing page ships "No forced pop-ups, no pay-to-win, no nagging. Ever."
//
// docs/sync.md writes that line down. Nothing enforced it, and a document is
// not a gate: the next person to make the offer "work harder" reaches for a
// delay, a dismissal that expires, or a count of how many hands you have played
// without one, and every one of those ships green.
//
// So the line is mechanical here, in the same shape as the drills layer's
// meter and clock bans (tests/drills.test.ts). Four rules, all about what the
// code *can do* rather than what it says about itself.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')

/**
 * A file with its comments taken out.
 *
 * The bans are on behaviour, not on vocabulary: a comment explaining why there
 * is no dismissal here must not read as a dismissal. String literals stay,
 * because copy that counts something for the player is the fault too.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

/** The file holding both surfaces the player never asked for. */
const OFFER = 'src/components/settings/AccountOffer.tsx'

/**
 * The screens allowed to render one, and the reason each is allowed: the player
 * is already looking at it, and the offer is a piece of it rather than something
 * arriving on top. A fourth entry here is a decision, which is the point of
 * writing them down: you have to read the promise in rule 1 to add one.
 */
const SURFACES = [
  'src/components/menu/Home.tsx',
  'src/components/table/RunRecap.tsx',
  'src/components/AppBar.tsx',
]

/** Every `.tsx` under `src/`, so a new surface is caught the day it lands. */
const allSources = (): string[] => {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(new URL(`../${dir}`, import.meta.url), {
      withFileTypes: true,
    })) {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.tsx')) found.push(path)
    }
  }
  walk('src')
  return found
}

// 1. The sentence the whole design is measured against. If it is ever reworded
//    or dropped, that is the moment to re-read what the app now does next to
//    it, so failing here is the point rather than an inconvenience.
test('the landing page still promises no pop-ups and no nagging', (t) => {
  t.true(
    read('src/components/marketing/Landing.tsx').includes(
      'No forced pop-ups, no pay-to-win, no nagging. Ever.',
    ),
    'Landing.tsx no longer carries the promise the account offer is written against',
  )
})

// 2. The offer cannot wait, count or remember. A prompt thirty seconds in, a
//    banner that returns a week after it was closed and "you have played 20
//    hands without an account" are the three shapes ruled out, and every one of
//    them needs a timer, a stored key or a counter. The dialog the player opened
//    is deliberately not covered: it shows when sync last ran, which is a clock
//    reading in the service of telling them the truth.
test('the account offer cannot wait, count or remember', (t) => {
  const source = code(OFFER)
  t.notRegex(source, /setTimeout|setInterval|requestIdleCallback/, 'the offer opens on a clock')
  t.notRegex(source, /localStorage|sessionStorage|indexedDB/, 'the offer remembers a dismissal')
  t.notRegex(source, /\bDate\b|\bperformance\.now\b/, 'the offer reads the clock')
  t.notRegex(
    source,
    /\b(dismissCount|timesSeen|promptCount|handsSinceSignup|nagCount|seenCount)\b/i,
    'the offer counts the player',
  )
})

// 3. It only ever appears on a screen somebody is already on. This is the guard
//    that would fail on the real mistake: rendering the offer from a dialog, a
//    portal or a route transition, where a piece of furniture becomes an
//    interstitial and the promise on the landing page becomes false.
test('the account offer only renders on the three screens it is furniture on', (t) => {
  const rendering = allSources().filter(
    (path) => path !== OFFER && /<Account(Offer|BarButton)\b/.test(code(path)),
  )
  t.deepEqual(
    rendering.sort(),
    [...SURFACES].sort(),
    'a new account surface: check it is part of a screen and not something arriving over one, then add it here',
  )
})

// 4. An offer waits for `useSync().ready`. `status` starts at 'signed-out'
//    because that is the honest default before the stored session has been
//    looked for, so an unguarded offer flashes "create a free account" over a
//    returning player's own signed-in lobby on every single load. A dialog the
//    player opened themselves does not need the gate; a permanent surface does.
//
//    AccountOffer.tsx is the file that holds both permanent surfaces, so every
//    component it exports has to carry the guard.
test('every permanent account surface waits for the stored session', (t) => {
  const source = code('src/components/settings/AccountOffer.tsx')
  const components = source.match(/^export function /gm) ?? []
  const guards = source.match(/if \(!ready \|\| status !== 'signed-out'\) return null/g) ?? []
  t.true(components.length > 0, 'AccountOffer.tsx exports no components: the match is broken')
  t.is(
    guards.length,
    components.length,
    'every component in AccountOffer.tsx renders nothing until useSync().ready and only while signed out',
  )
})
