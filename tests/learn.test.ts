import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'
import { type GuideArt, LEARN_GUIDES, guideBySlug, relatedGuides } from '@/config/learn'

test('every guide has a valid slug, ISO date, and non-empty copy', (t) => {
  for (const guide of LEARN_GUIDES) {
    t.regex(guide.slug, /^[a-z0-9-]+$/, `slug: ${guide.slug}`)
    t.regex(guide.date, /^\d{4}-\d{2}-\d{2}$/, `date: ${guide.date}`)
    t.true(guide.title.length > 0)
    t.true(guide.metaTitle.length > 0)
    t.true(guide.description.length > 0)
  }
})

test('slugs are unique', (t) => {
  const slugs = LEARN_GUIDES.map((g) => g.slug)
  t.is(new Set(slugs).size, slugs.length)
})

test('every registry entry has a matching page folder, and vice versa', (t) => {
  const folders = readdirSync(new URL('../src/app/learn', import.meta.url), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const slugs = LEARN_GUIDES.map((g) => g.slug).sort()
  t.deepEqual(folders, slugs)
})

test('a guide never links to itself', (t) => {
  for (const guide of LEARN_GUIDES) {
    t.false(guide.related.includes(guide.slug), `${guide.slug} links to itself`)
  }
})

// The whole point of relatedGuides: the copy names siblings before they are
// written, and an unwritten one must be dropped rather than rendered as a link
// to a 404.
test('relatedGuides drops siblings that are not published yet', (t) => {
  for (const guide of LEARN_GUIDES) {
    for (const sibling of relatedGuides(guide.slug)) {
      t.truthy(guideBySlug(sibling.slug), `${guide.slug} -> ${sibling.slug} is not in the registry`)
    }
  }
  const published = new Set(LEARN_GUIDES.map((g) => g.slug))
  const unwritten = LEARN_GUIDES.flatMap((g) => g.related).filter((s) => !published.has(s))
  for (const guide of LEARN_GUIDES) {
    t.false(relatedGuides(guide.slug).some((s) => unwritten.includes(s.slug)))
  }
})

test('relatedGuides preserves the order the guide asked for', (t) => {
  for (const guide of LEARN_GUIDES) {
    const published = guide.related.filter((slug) => guideBySlug(slug) !== undefined)
    t.deepEqual(
      relatedGuides(guide.slug).map((s) => s.slug),
      published,
    )
  }
})

// A filename is not a spec. The registry's width and height are what the
// browser reserves before the file lands, so a wrong pair is a page that jumps
// under whoever is reading it, and nothing else in the build ever compares the
// two. Read straight out of the PNG header: width and height are the eight
// bytes after the 8-byte signature, the IHDR length and the IHDR tag.
test('every piece of art exists and is the size the registry claims', (t) => {
  const art = LEARN_GUIDES.flatMap((guide) => [guide.hero, guide.chart]).filter(
    (piece): piece is GuideArt => piece !== undefined,
  )
  t.true(art.length > 0)
  for (const piece of art) {
    const header = readFileSync(new URL(`../public${piece.src}`, import.meta.url)).subarray(16, 24)
    t.is(header.readUInt32BE(0), piece.width, `${piece.src} width`)
    t.is(header.readUInt32BE(4), piece.height, `${piece.src} height`)
    t.true(piece.alt.length > 0, `${piece.src} has no alt text`)
  }
})

test('an unknown slug resolves to nothing rather than throwing', (t) => {
  t.is(guideBySlug('not-a-guide'), undefined)
  t.deepEqual(relatedGuides('not-a-guide'), [])
})
