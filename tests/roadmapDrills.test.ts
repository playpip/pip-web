import { readFileSync } from 'node:fs'
import test from 'ava'
import { DRILL_KINDS } from '@/config/drills'

// ROADMAP.md is the only public page that says which drills sit behind the
// membership. The drills index hides a `membersOnly` kind from anyone who is
// not a member, so a reader cannot get the list off the app: they can only
// check a kind they already know the name of, by opening its URL. That makes
// the roadmap paragraph a disclosure rather than a nicety, and it is why the
// fix here is to pin the list rather than to delete it.
//
// **It has gone stale twice, and both times the same way.** The first version
// said the membership wasn't built after the entitlement check had shipped. The
// correction said one drill was behind it when it was already two. The
// paragraph itself calls that out and calls itself "the second fix", so a third
// is not a typo, it is a pattern: a hand-written list of a registry's contents
// goes wrong every time the registry changes, and the registry changes in
// somebody else's pull request.
//
// So this is the registry checking the prose. Register a kind with
// `membersOnly` and the build fails until ROADMAP.md names it; take the flag
// off a kind and the build fails until the name comes out. Neither can land
// quietly.
//
// Deliberately whole-file rather than scoped to the membership section: a
// section boundary is a regex over prose and would be the next thing to drift.

// Flattened for the reason priceClaims.test.ts records: markdown hard-wraps at
// eighty columns and does it inside quotation marks, so "Pot odds" is really
// `"Pot\nodds"` in the file and an unflattened `includes` reports it missing.
// The first run of this test failed on exactly that.
const ROADMAP = readFileSync(new URL('../ROADMAP.md', import.meta.url), 'utf-8').replace(
  /\s+/g,
  ' ',
)

test('the roadmap names every drill that comes with the membership', (t) => {
  t.true(ROADMAP.length > 1000, 'the roadmap read empty, so this file is proving nothing')

  for (const kind of DRILL_KINDS) {
    if (!kind.membersOnly) continue
    t.true(
      ROADMAP.includes(kind.title),
      `"${kind.title}" is behind the membership and ROADMAP.md does not name it. ` +
        'The membership section is where a reader checks what is paid, and it is now wrong.',
    )
  }
})

test('the roadmap does not name a free drill as paid', (t) => {
  for (const kind of DRILL_KINDS) {
    if (kind.membersOnly) continue
    t.false(
      ROADMAP.includes(kind.title),
      `"${kind.title}" is free and ROADMAP.md names it. Every drill title in that file is ` +
        'read as one of the paid ones, so a free kind listed there reads as a thing we charge for.',
    )
  }
})
