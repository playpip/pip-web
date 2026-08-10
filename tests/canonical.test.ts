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

// The routes we hand to other people: posts get pasted into X, Reddit threads
// and directory submissions, so what the link unfurls into is the first thing
// most readers see of them. Metadata merges a field at a time here too, so a
// page that sets `title` and `description` and stops there keeps the root
// layout's `openGraph` — right title in the tab, home page's card in the
// timeline. All four blog posts shipped that way and nothing failed.
//
// The guides under /learn/<slug> are the same kind of link but not yet the same
// code: they hand-write a block each and build the image from the Learn
// registry's art. Route them through contentSocial() and this widens to
// startsWith('/learn') on its own.
const isShared = (url: string) => url.startsWith(`${SITE_URL}/blog`) || url === `${SITE_URL}/learn`

test('every shared content route previews as itself, not as the home page', async (t) => {
  const shared = sitemap().filter((entry) => isShared(entry.url))
  t.true(shared.length > 0)
  for (const { url } of shared) {
    const meta = await metadataFor(pathOf(url))
    const og = meta.openGraph as
      | { title?: string; description?: string; url?: string | URL; images?: Card[] }
      | undefined
    const twitter = meta.twitter as
      | { title?: string; description?: string; images?: Card[] }
      | undefined
    t.truthy(og, `openGraph block: ${url}`)
    t.true((og?.title?.length ?? 0) > 0, `og:title: ${url}`)
    t.is(og?.description, meta.description ?? undefined, `og:description is the page's own: ${url}`)
    t.is(String(og?.url), url, `og:url points at itself: ${url}`)
    t.is(twitter?.title, og?.title, `twitter:title matches og:title: ${url}`)
    t.is(twitter?.description, og?.description, `twitter:description matches: ${url}`)
    // The image has to be named here too. It does not come along with the rest
    // of the root layout's block, and a summary_large_image card with nothing
    // to show is a worse share than the generic picture it replaced.
    const [image] = og?.images ?? []
    t.truthy(image, `og:image: ${url}`)
    t.true(image?.url.startsWith(`${SITE_URL}/`), `og:image is absolute: ${url}`)
    t.true((image?.alt.length ?? 0) > 0, `og:image:alt: ${url}`)
    t.deepEqual(twitter?.images, og?.images, `twitter image matches: ${url}`)
  }
})

interface Card {
  url: string
  alt: string
}
