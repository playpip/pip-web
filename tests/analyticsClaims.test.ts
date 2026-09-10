import { readdirSync, readFileSync } from 'node:fs'
import test from 'ava'

// /privacy used to say we count "a couple of milestones (someone made a profile,
// someone played their first hand)". By the time it said that, sync had been
// recording `sync-signed-up` and `sync-conflict` for weeks. The sentence was not
// a lie anyone told; it was true when written and nobody went back to it.
//
// The page now enumerates every event by name, which is better copy and a
// bigger liability: it is false the moment somebody adds a sixth `track()` call.
// A privacy page is exactly the document where "we forgot to update it" is not
// an available excuse, and no gate anywhere could see the drift.
//
// So this is the gate. Add an event and the build fails until you say, here,
// what it is called on /privacy. Then it checks that description is really on
// the page. The registry is the point of friction: it makes describing the event
// to players part of shipping it, rather than a thing to remember afterwards.

/**
 * Every analytics event the app can send, and the words on /privacy that tell a
 * player it exists. Page views are not here: they come from Umami's own tag in
 * layout.tsx rather than a `track()` call, and the page names them separately.
 */
const DESCRIBED_ON_PRIVACY: Record<string, string> = {
  'profile-created': 'someone made a profile',
  'first-hand': 'someone played their first hand',
  'sync-signed-up': 'someone created an account',
  'sync-conflict': 'two devices disagreed about a Roll',
  'sync-auth-unreachable': 'whether a sign-in reached our servers at all',
}

/** `track('x')` and `trackOnce('x')`, single or double quoted, literals only. */
const CALL = /\btrack(?:Once)?\(\s*['"]([\w-]+)['"]\s*\)/g

/** The wrapper's own definition and re-export, which are not call sites. */
const NOT_A_CALL_SITE = /src\/lib\/analytics\.ts$/

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) sourceFiles(path, out)
    else if (/\.tsx?$/.test(entry.name) && !NOT_A_CALL_SITE.test(path)) out.push(path)
  }
  return out
}

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf-8')
}

/** JSX wraps mid-sentence, so compare on collapsed whitespace, not raw source. */
const PRIVACY_PROSE = read('../src/app/privacy/page.tsx').replace(/\s+/g, ' ')

const FIRED: string[] = []
const FILES = sourceFiles('../src')
for (const path of FILES) {
  for (const match of read(path).matchAll(CALL)) FIRED.push(match[1])
}

test('the walk found the call sites, so a pass means something', (t) => {
  t.true(FILES.length > 100, 'the source walk found almost nothing')
  t.true(FIRED.length >= 4, `expected several track() calls, found ${FIRED.length}`)
})

test('every event the app sends is described on /privacy', (t) => {
  for (const event of new Set(FIRED)) {
    t.true(
      event in DESCRIBED_ON_PRIVACY,
      `${event} is sent but not in this file. Add it, and add words for it to /privacy: ` +
        'the page enumerates what we count, so an undescribed event makes it false.',
    )
  }
})

test('every description in the registry is really on the page', (t) => {
  // Guards the other direction: rewording /privacy must not quietly drop an
  // event's description and leave this file asserting a sentence nobody serves.
  for (const [event, description] of Object.entries(DESCRIBED_ON_PRIVACY)) {
    t.true(
      PRIVACY_PROSE.includes(description),
      `/privacy no longer says "${description}", which is how it describes ${event}`,
    )
  }
})

test('nothing in the registry has stopped being sent', (t) => {
  // A described event that no longer fires is the same fault pointing the other
  // way: the page would be telling players about a count we do not keep.
  for (const event of Object.keys(DESCRIBED_ON_PRIVACY)) {
    t.true(FIRED.includes(event), `/privacy describes ${event}, but nothing sends it any more`)
  }
})
