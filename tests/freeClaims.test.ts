import { readFileSync } from 'node:fs'
import test from 'ava'
import { DRILL_KINDS } from '@/config/drills'
import { ALL_VENUES, SIDE_SHELF } from '@/config/venues'

// A sentence listing what is free is a claim about `membersOnly`, so it reads
// `membersOnly`.
//
// **What went wrong.** On the day the side tables moved behind the membership,
// three public surfaces described them. `Landing.tsx` was updated to say they
// come with it, `/membership` put "Every side table" in the list of things you
// are buying — and README.md and ROADMAP.md both kept listing "every side
// table" among the things that are free, permanently. The same page offered a
// thing for sale and gave it away. Separately, both README.md and the
// `/membership` page named "Which hand wins?" as the free drill when two kinds
// are free, so the one sentence a buyer reads first understated what they
// already had.
//
// **Why prose and not the app.** `tests/roadmapDrills.test.ts` has caught the
// drill half of this twice, and it works: the registry checks the paragraph.
// Nothing did the same for venues, and nothing checked the positive direction —
// that a list of free things names all of them. Both files are markdown and
// cannot import a config, so a test is the only way they hear about a flag
// changing in somebody else's pull request.
//
// **The markers are deliberate.** A regex over prose to find "the free bit" is
// the next thing to drift, so the two documents mark the claim explicitly and
// this file fails if a marker goes missing. Inside the markers is a list of
// what is free; everything else in those files is out of scope here.
//
// **What it does not cover.** Only the two markdown documents and the shape of
// the membership page's free-drill line. Prose outside the markers, the app's
// own screens, and whether the gate actually turns a non-member away
// (`tests/sitDown.test.ts`) are somebody else's job.

const START = '<!-- free-claims:start'
const END = '<!-- free-claims:end -->'

/**
 * The marked block, whitespace flattened.
 *
 * Flattened for the reason `roadmapDrills.test.ts` records: markdown hard-wraps
 * at eighty columns and does it inside quotation marks, so "Pot odds" is really
 * `"Pot\nodds"` in the file and an unflattened `includes` reports it missing.
 */
function freeBlock(file: string): string {
  const raw = readFileSync(new URL(`../${file}`, import.meta.url), 'utf-8')
  const from = raw.indexOf(START)
  const to = raw.indexOf(END)
  if (from === -1 || to === -1 || to < from) {
    throw new Error(
      `${file} has no free-claims block. It said which parts of Pip are free and that ` +
        'claim is no longer checked against config. Put the markers back, or delete the list.',
    )
  }
  return raw.slice(from, to).replace(/\s+/g, ' ')
}

const DOCS = ['README.md', 'ROADMAP.md']

/**
 * Every name a paid thing goes by in public.
 *
 * Venue names and shelf families come out of the config, so a new paid room is
 * covered on the day it is registered. `side table` is written out because
 * `SIDE_TABLES` has no name of its own in config — it is a derived array — and
 * it is the exact phrase that shipped wrong.
 */
function paidNames(): string[] {
  const names = new Set<string>(['side table'])
  for (const venue of ALL_VENUES) if (venue.membersOnly) names.add(venue.name)
  for (const family of SIDE_SHELF) {
    if (!family.membersOnly) continue
    names.add(family.name)
    if (family.tag) names.add(family.tag)
  }
  return [...names]
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')

for (const file of DOCS) {
  test(`${file} does not give away something the membership sells`, (t) => {
    const block = freeBlock(file)
    t.true(block.length > 120, `${file}'s free-claims block is too short to be the list`)

    for (const name of paidNames()) {
      t.notRegex(
        block,
        new RegExp(`\\b${escapeRe(name)}s?\\b`, 'i'),
        `${file} lists "${name}" as free and it is behind the membership. ` +
          'One of the two is wrong, and the one on the sales page is the one people paid for.',
      )
    }

    for (const kind of DRILL_KINDS) {
      if (!kind.membersOnly) continue
      t.false(
        block.includes(kind.title),
        `${file} lists the drill "${kind.title}" as free and it is paid.`,
      )
    }
  })

  test(`${file} names every free drill, not just one of them`, (t) => {
    const block = freeBlock(file)
    for (const kind of DRILL_KINDS) {
      if (kind.membersOnly) continue
      t.true(
        block.includes(kind.title),
        `${file} does not name the free drill "${kind.title}". A list of what you get ` +
          'for nothing that leaves one out sells the membership on something already free.',
      )
    }
  })
}

// The page has the same job and can import, so the check is that it still does
// rather than that today's names are in it.
test('the membership page reads the free drills off the registry', (t) => {
  const page = readFileSync(new URL('../src/app/membership/page.tsx', import.meta.url), 'utf-8')
  t.regex(
    page,
    /DRILL_KINDS\s*\.?\s*\n?\s*\.filter\(/,
    'the membership page no longer derives its free-drill list. It said "the drill called ' +
      '“Which hand wins?”" while the feature list below it said two kinds are free.',
  )
  for (const kind of DRILL_KINDS) {
    if (!kind.membersOnly) continue
    t.false(
      page.includes(`“${kind.title}”`),
      `the membership page quotes the paid drill "${kind.title}" in prose; it should ` +
        'come from the feature list, which is generated.',
    )
  }
})
