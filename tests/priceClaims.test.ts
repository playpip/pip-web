import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'

// Two sentences in the Product Hunt copy were pulled on 17 August for the same
// reason, and this file is that ruling turned into something that cannot be
// forgotten: **"nothing to buy" and "it can't take your money" are borrowed,
// not true.** Both were accurate the day they were written. Both go false the
// day anything optional goes on sale, and a launch thread is permanent.
//
// The general test they came from: name the feature that would falsify the
// sentence, then ask whether that feature is on the roadmap. If it is, the
// sentence is borrowed. For these two the feature is the membership, it is on
// the public roadmap, and since 25 August one drill kind sits behind its
// entitlement check.
//
// The ruling was applied to the launch copy and not to the site, so
// `/play-poker-free-no-signup` carried all three of these into production and
// served them for sixteen days. That is the third time a ruling has been
// applied to the surface it was aimed at and not to the one sixty lines away,
// so this time it is a test rather than a note.
//
// **What to say instead.** The permanent forms are the ones that survive
// whatever we ever charge for: the chips are not for sale, you cannot buy an
// advantage, and there is nothing here you can actually lose. Every one of
// those is a statement about how Pip is built rather than about what happens to
// exist in the shop today.
//
// This comment used to offer "nothing that shipped free gets metered later" as
// a fourth permanent form, and that was wrong. It is a promise about what we
// will do rather than about how Pip is built, and on 2026-09-20 the rule behind
// it was narrowed to the core game (the ladder, the Rail, the Daily, the
// freeroll) because the seven side tables had moved behind the membership
// check. A guard that recommends a sentence its own subject has already broken
// is worse than one that says nothing, so the absolute is in BORROWED now and
// the advice above no longer names it.

/** Absolutes about money that a membership would falsify. */
const BORROWED = [
  /nothing to buy/i,
  /no paid tier/i,
  /(can'?t|cannot|could not|couldn'?t) take your money/i,
  /(can'?t|cannot) charge you/i,
  // Added after a sweep of the merged membership branch found four more
  // phrasings of the same claim that none of the four above match. Six guides
  // carried "no money involved anywhere and none to spend" and
  // `/play-poker-free-no-signup` carried the other two, which is the second
  // time this ruling has been applied to the phrasing that produced the first
  // hit rather than to the fact. List the phrasings, then grep every surface.
  /no money involved/i,
  /none to spend/i,
  /no purchase/i,
  /takes? payment/i,
]

/**
 * The permanence absolute, which is a different claim from the ones above.
 * Those say there is nothing to buy today; these say that whatever is free
 * today will still be free later. The membership does not falsify them on the
 * day it goes on sale. It falsifies them on the day anything free moves behind
 * the check, which happened on 2026-09-20 to the seven side tables.
 *
 * Kept apart from BORROWED because the fix is different. A borrowed claim is
 * replaced with a permanent form. This one has no permanent form at the
 * sitewide scale, so it is replaced by naming what the promise actually covers:
 * the ladder, the ring games, the Daily and the freeroll, which rule 1 protects
 * and `tests/sitDown.test.ts` enforces.
 *
 * **Scoped on purpose.** "Nothing here is metered" about the drills is true and
 * wanted: it means no sampling and no three-a-week, and it is the behaviour
 * this product is positioned against. So these match the sitewide absolute and
 * nothing narrower. Five scoped uses in src/config/drills.ts, src/config/learn.ts
 * and src/components/drills/DrillRunner.tsx are all legitimate and all stay.
 */
const PERMANENCE = [
  /nothing in it gets metered/i,
  /nothing (here|on this site) gets metered/i,
  /nothing (that|which) ship(s|ped) free (ever )?gets metered/i,
  /anything that shipped free is free forever/i,
]

/**
 * A blog post is a dated record: it keeps its sentence and gains a correction
 * note rather than an edit, which is why dataClaims.test.ts exempts posts and
 * src/config/corrections.ts exists. The comment below used to say nothing
 * published had ever carried one of these claims. That was true of BORROWED
 * when it was written and is not true of PERMANENCE:
 * src/app/blog/august-what-shipped/page.tsx quotes the roadmap's version of it.
 * That post is handled as a correction, not by this test.
 */
const DATED_RECORD = /^\.\.\/src\/app\/blog\//

// Deliberately no exemption for /blog/, unlike dataClaims.test.ts. There a
// published post genuinely contained the absolute and a post is a dated record
// that gets a correction note rather than an edit. Here nothing published ever
// carried one — checked across all six posts when this file was written — so
// there is no history to protect and the cheapest thing is to hold the whole
// site to it, including posts not yet written.
function surfaces(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) surfaces(path, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(path)
  }
  return out
}

// `src/config` is walked because the replacement sentences live there: moving a
// claim into a constant moved it out of the guard's reach, which is how a guard
// stops covering the thing it is named after.
test('no page claims there is nothing to buy', (t) => {
  const files = [
    ...surfaces('../src/app'),
    ...surfaces('../src/components'),
    ...surfaces('../src/config'),
  ]
  t.true(files.length > 40, 'the walk found nothing, so it is proving nothing')

  for (const file of files) {
    // Flattened for the same reason as dataClaims: JSX breaks a sentence across
    // lines and the phrase only exists once the whitespace is gone.
    const source = readFileSync(new URL(file, import.meta.url), 'utf-8').replace(/\s+/g, ' ')
    for (const claim of BORROWED) {
      const match = claim.exec(source)
      t.falsy(
        match,
        `${file}: "${match?.[0]}" is an absolute a membership makes false. Say what cannot change instead: the chips are not for sale, and no advantage is.`,
      )
    }

    if (DATED_RECORD.test(file)) continue
    for (const claim of PERMANENCE) {
      const match = claim.exec(source)
      t.falsy(
        match,
        `${file}: "${match?.[0]}" promises that everything free stays free, and the seven side tables moved behind the membership on 2026-09-20. Name what the promise covers instead: the ladder, the ring games and the Daily.`,
      )
    }
  }
})
