import { readFileSync } from 'node:fs'
import test from 'ava'
import { DRILL_KINDS, freeDrillNote } from '@/config/drills'

// What a drill costs, said on a page outside the app.
//
// **What went wrong.** /learn is where a search drops people, and it told them
// "Guides, a tour and drills. All free, no signup." under the title, plus "Free,
// unlimited, no signup." on the card that links to the drills room. Three of the
// four kinds carry `membersOnly`, `DrillIndex` filters them off the shelf, and
// `DrillRunner` answers "This one comes with the membership" if you open one by
// URL. So the app was honest and the page selling the app was not, and it had
// been since the second kind went behind the check on 25 August 2026.
//
// **Both sentences were written when every kind was free.** That is the failure
// mode worth a test rather than a correction: nothing edited them, the product
// moved underneath them. `tests/roadmapDrills.test.ts` already stops the
// disclosure in ROADMAP.md drifting the same way, and it works, so this is the
// same trick pointed at the other kind of page.
//
// **Why the sentence is computed.** A prose claim about which kinds are free is
// a claim about `membersOnly`, and the one place that flag cannot drift away
// from is the file it lives in. `freeDrillNote()` builds the sentence there;
// this file checks the sentence says what the flags say, and that the page still
// asks for it rather than keeping its own copy.
//
// **What it does not cover.** One page and one function. Somebody can write a
// fresh free-drill claim in different words elsewhere on /learn, or on a page
// this file does not name, and nothing here would see it: a blacklist of
// phrasings is the next thing to go stale (see tests/priceClaims.test.ts for the
// half that is worth doing that way). It also says nothing about whether the
// gate turns a non-member away, which is tests/drills.test.ts, nor about the
// tour, the guides or the calculator, all of which are free and unconditional.

const PAGE = '../src/app/learn/page.tsx'

const page = readFileSync(new URL(PAGE, import.meta.url), 'utf-8')

test('the note names every free kind', (t) => {
  const note = freeDrillNote()
  for (const kind of DRILL_KINDS) {
    if (kind.membersOnly) continue
    t.true(
      note.includes(kind.title),
      `"${kind.title}" is free and the note does not name it. A sentence about what costs ` +
        'nothing that leaves one out sells the membership on something a reader already has.',
    )
  }
})

test('the note names no kind that comes with the membership', (t) => {
  const note = freeDrillNote()
  for (const kind of DRILL_KINDS) {
    if (!kind.membersOnly) continue
    t.false(
      note.includes(kind.title),
      `"${kind.title}" comes with the membership and the note names it among the free ones.`,
    )
  }
})

test('the note says the rest are paid exactly when some are', (t) => {
  const note = freeDrillNote()
  const anyPaid = DRILL_KINDS.some((kind) => kind.membersOnly)
  t.is(
    note.includes('comes with the membership') || note.includes('come with the membership'),
    anyPaid,
    anyPaid
      ? 'some kinds are behind the membership and the note does not say so, which is the ' +
          'exact sentence /learn shipped wrong'
      : 'no kind is behind the membership and the note says some are',
  )
})

test('/learn asks the registry rather than keeping its own copy', (t) => {
  t.regex(
    page,
    /\{freeDrillNote\(\)\}/,
    'the drills card on /learn no longer renders the computed note. It said "Free, ' +
      'unlimited, no signup." for a month while three kinds were paid.',
  )
})

test('/learn does not name the drills in a claim it cannot keep', (t) => {
  const subtitle = /subtitle="([^"]*)"/.exec(page)?.[1]
  t.truthy(subtitle, 'the /learn subtitle is no longer a plain string, so this check is blind')
  t.false(
    /drill/i.test(subtitle ?? ''),
    'the /learn subtitle names drills inside "All free, no signup". It did until ' +
      '2026-09-23 and three of the four kinds were paid. The card below carries the ' +
      'computed sentence; the subtitle covers the guides and the tour, which are free.',
  )
})
