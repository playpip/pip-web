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
// advantage, nothing that shipped free gets metered later, and there is nothing
// here you can actually lose. Every one of those is a statement about how Pip
// is built rather than about what happens to exist in the shop today.

/** Absolutes about money that a membership would falsify. */
const BORROWED = [
  /nothing to buy/i,
  /no paid tier/i,
  /(can'?t|cannot|could not|couldn'?t) take your money/i,
  /(can'?t|cannot) charge you/i,
]

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

test('no page claims there is nothing to buy', (t) => {
  const files = [...surfaces('../src/app'), ...surfaces('../src/components')]
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
  }
})
