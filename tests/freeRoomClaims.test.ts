import { readFileSync } from 'node:fs'
import test from 'ava'
import {
  CHALLENGE_TABLES,
  KITCHEN_TABLE,
  RING_TABLES,
  SIDE_TABLES,
  THE_DAILY,
  type Venue,
  VENUES,
} from '@/config/venues'

// README.md and ROADMAP.md are the two files a stranger reads before they play
// anything, and neither is covered by a test. Both keep a list of what is free,
// and that list is prose sitting a long way from `venues.ts`, which is the only
// thing that actually decides.
//
// They have already disagreed once. When every side table moved behind the
// membership check, `docs/membership.md` got the rewrite and these two did not,
// so the repo promised "free, permanently: ... every side table" while the
// config charged for all seven. A propagation gap, not a change of mind, and
// the kind that survives review because nobody diffs a README against a config.
//
// So this is the pairing made mechanical: **a room behind the check may not be
// named in a sentence that says it is free.**
//
// It is deliberately inert until a room is actually gated. On a tree where
// nothing carries the flag it proves nothing about the docs and says so
// through the self-test at the bottom, which runs the detector against a
// planted claim so an empty pass cannot be mistaken for a clean one.

/** The docs a stranger reads. Repo-root markdown, not site copy. */
const DOCS = ['../README.md', '../ROADMAP.md']

/**
 * The gate, read off the config rather than typed here.
 *
 * Cast because `membersOnly` is a field the membership work adds to `Venue`,
 * and this guard is meant to be sitting here waiting when it arrives rather
 * than added alongside it by whoever remembers. The day the field lands the
 * cast becomes redundant and can go; until then it is the whole point.
 */
const isGated = (venue: Venue): boolean =>
  (venue as Venue & { membersOnly?: boolean }).membersOnly === true

/**
 * What each group of rooms is called in prose.
 *
 * Keyed on the config's own exports, so a new group of rooms is a type error
 * here rather than a silent hole. The term is what the docs actually write:
 * nobody puts "CHALLENGE_TABLES" in a README, and matching venue names one by
 * one would miss "every side table", which is the exact sentence that went
 * wrong.
 */
const GROUPS: { rooms: readonly Venue[]; term: RegExp; label: string }[] = [
  { rooms: VENUES, term: /\bladder\b/i, label: 'the ladder' },
  { rooms: SIDE_TABLES, term: /\bside tables?\b/i, label: 'the side tables' },
  { rooms: RING_TABLES, term: /\b(cash games?|the Rail)\b/i, label: 'the Rail' },
  { rooms: CHALLENGE_TABLES, term: /\bchallenge tables?\b/i, label: 'the challenge tables' },
  { rooms: [KITCHEN_TABLE], term: /\bfreeroll\b/i, label: 'the freeroll' },
  { rooms: [THE_DAILY], term: /\bDaily\b/, label: 'the Daily' },
]

/**
 * Sentences that assert something is free.
 *
 * Only two forms, on purpose. "Free" is the word the promise is made in, and
 * "open to everybody" is the one place the docs say it without saying it.
 * Every other way of implying free costs more in false positives than it buys.
 */
const FREE_CLAIM = /\bfree\b|\bopen to every(body|one)\b/i

/**
 * Cut a markdown document into sentences.
 *
 * Two passes, and the first one is the one that matters. Flattening the whole
 * file and splitting on full stops looks right and is not: a bullet list has no
 * full stops in it, so an entire "## Shipped" section collapses into one chunk
 * and inherits the word "free" from whatever sentence follows it. Written that
 * way first, this test reported the ladder's changelog entry as a pricing
 * claim.
 *
 * So blocks first (a blank line, a heading or a list marker ends one), then
 * sentences inside a block. That keeps a hard-wrapped paragraph together, which
 * is the case that needs joining, without gluing a list to its neighbours.
 */
function blocksOf(source: string): string[] {
  const blocks: string[] = []
  let current: string[] = []
  const flush = () => {
    if (current.length > 0) blocks.push(current.join(' '))
    current = []
  }
  for (const line of source.split('\n')) {
    if (line.trim() === '' || /^\s*(#{1,6}\s|[-*+]\s|\d+\.\s|\|)/.test(line)) flush()
    current.push(line.trim())
  }
  flush()
  return blocks
}

/** The sentences in a document that assert something is free. */
function sentencesOf(source: string): string[] {
  return blocksOf(source)
    .flatMap((block) => block.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/))
    .filter((s) => FREE_CLAIM.test(s))
}

/**
 * Every complaint about one document.
 *
 * The rule is phrased as a rule about sentences rather than about documents
 * because the fix has to be a sentence: "the side tables are not free" would
 * trip this, and should, since the honest version does not need the word at
 * all. Say what the membership adds, in its own sentence.
 */
function claimsIn(source: string, gatedGroups: typeof GROUPS): string[] {
  const out: string[] = []
  for (const sentence of sentencesOf(source)) {
    for (const group of gatedGroups) {
      if (group.term.test(sentence)) {
        out.push(`${group.label}: "${sentence.trim()}"`)
      }
    }
  }
  return out
}

test('no public doc calls a members-only room free', (t) => {
  const gatedGroups = GROUPS.filter((g) => g.rooms.length > 0 && g.rooms.every(isGated))

  // Every violation in one failure rather than one failure each: the fix is a
  // pass over both documents, and a reporter that stops at the first hit sends
  // you back round for the second.
  const found: string[] = []
  for (const doc of DOCS) {
    const source = readFileSync(new URL(doc, import.meta.url), 'utf-8')
    t.true(source.length > 500, `${doc}: read nothing, so this proves nothing`)
    found.push(...claimsIn(source, gatedGroups).map((claim) => `${doc} calls ${claim}`))
  }

  t.deepEqual(
    found,
    [],
    'Every room in that group is behind the membership check in src/config/venues.ts. Take it out of the free list and name it under what the membership adds instead.',
  )
})

// The test above passes on a tree where nothing is gated, which is the state it
// was written in. That is the failure mode of every guard: correct, green, and
// wired to nothing. So plant the sentence that went wrong and require it to be
// caught, with the flag forced on.
test('the detector catches the sentence this exists for', (t) => {
  const planted =
    'Pip is free to play and most of it is open to everybody: the whole ladder, every side table, the cash games, and the Daily. Nothing here is a trial.'
  const gatedSideTables = GROUPS.filter((g) => g.term.test('side table'))

  const hits = claimsIn(planted, gatedSideTables)
  t.is(hits.length, 1, 'the planted free-list sentence was not caught')
  t.regex(hits[0], /side tables/)

  // And it does not fire on a sentence that keeps the rooms out of the claim.
  const rewritten =
    'Pip is free to play and most of it is open to everybody: the whole ladder, the cash games, and the Daily. The side tables come with the membership.'
  t.deepEqual(claimsIn(rewritten, gatedSideTables), [])
})
