import { readFileSync } from 'node:fs'
import test from 'ava'
import sitemap from '@/app/sitemap'
import { SITE_URL } from '@/config/site'

// The README links six posts about files in this repo. That is the return leg
// of the source links the posts carry, and it rots the same way: rename a slug
// and the README serves a 404 to a developer who was already reading the code,
// which is the one reader we have the fewest of.
//
// Nothing else in the suite reads the README. `tests/blog.test.ts` checks the
// registry against the folders on disk, so a renamed post stays internally
// consistent while every link to it from outside `src/` breaks quietly.
//
// The check is against the sitemap rather than a list of slugs, because the
// sitemap is already the one place every public route has to be. It therefore
// covers `/privacy` and the home page too, not only the posts. Written first as
// a grep for `/blog/<slug>` against BLOG_POSTS, it passed while `/privacy`
// three paragraphs down was unprotected.

/** Every absolute link to our own site, query string and all. */
const SITE_LINK = new RegExp(`${SITE_URL.replace(/\./g, '\\.')}([^)\\s"'<>]*)`, 'g')

function readmePaths(): string[] {
  const text = readFileSync(new URL('../README.md', import.meta.url), 'utf-8')
  const paths = new Set<string>()
  for (const [, tail] of text.matchAll(SITE_LINK)) {
    // Trailing punctuation from the prose is not part of the URL.
    paths.add(tail.replace(/[.,)]+$/, '').split('?')[0] || '/')
  }
  return [...paths]
}

test('every playpip.io link in the README is a route we publish', (t) => {
  const paths = readmePaths()
  const published = new Set(sitemap().map(({ url }) => url.slice(SITE_URL.length) || '/'))

  t.true(
    paths.filter((path) => path.startsWith('/blog/')).length >= 5,
    'the README has stopped linking the posts written about this code. It linked six; if that was deliberate, change the number here and say why in the commit.',
  )

  for (const path of paths) {
    t.true(
      published.has(path),
      `README.md links ${SITE_URL}${path}, which is not in the sitemap. A renamed slug breaks the link silently: update the README, or drop the link.`,
    )
  }
})
