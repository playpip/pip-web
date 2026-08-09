import type { Metadata } from 'next'
import test from 'ava'
import sitemap from '@/app/sitemap'
import { RSS_URL, SITE_URL } from '@/config/site'

// Every URL we put in the sitemap is a URL we are asking a search engine to
// index, so every one of them has to say which address it wants to be indexed
// under. Directories append tracking parameters, trailing slashes and ?ref=,
// and each variant is a candidate for its own entry in the index unless the
// page names itself.
//
// The list is read from the sitemap rather than written out here: a new
// indexable route is added to the sitemap by definition, and this then fails
// until it carries a canonical too.

/** '' for the home page, '/blog/launch-week' for a post. */
function pathOf(url: string): string {
  return url.slice(SITE_URL.length)
}

/** The route module behind a sitemap URL: /blog -> src/app/blog/page.tsx. */
async function metadataFor(path: string): Promise<Metadata> {
  const file = new URL(`../src/app${path}/page.tsx`, import.meta.url).href
  const mod = (await import(file)) as { metadata?: Metadata }
  if (!mod.metadata) throw new Error(`src/app${path}/page.tsx exports no metadata`)
  return mod.metadata
}

test('the sitemap is not empty and every URL is on our origin', (t) => {
  const urls = sitemap().map((entry) => entry.url)
  t.true(urls.length > 0)
  for (const url of urls) {
    t.true(url === SITE_URL || url.startsWith(`${SITE_URL}/`), url)
    t.false(url.endsWith('/'), `no trailing slash: ${url}`)
  }
})

test('every sitemap URL has a canonical tag pointing at itself', async (t) => {
  for (const { url } of sitemap()) {
    const meta = await metadataFor(pathOf(url))
    const alternates = meta.alternates
    t.is(alternates?.canonical, url, `canonical: ${url}`)
  }
})

// Next merges metadata one top-level field at a time, so a route declaring its
// own `alternates` drops the root layout's — feed discovery included. That is
// not hypothetical: it shipped on the two Learn routes in v1.3.0 and nothing
// failed. contentAlternates() carries both; this is what stops someone writing
// the object out by hand again.
test('declaring a canonical does not drop the RSS link', async (t) => {
  for (const { url } of sitemap()) {
    const meta = await metadataFor(pathOf(url))
    const types = meta.alternates?.types as Record<string, unknown> | undefined
    t.is(types?.['application/rss+xml'], RSS_URL, `feed link: ${url}`)
  }
})
