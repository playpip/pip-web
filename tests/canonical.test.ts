import { readFile, readdir } from 'node:fs/promises'
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
// Written as an exclusion rather than a list of the routes we happen to share:
// a new indexable route is one somebody will paste somewhere, and the version
// of this that named /blog and /learn would have let it ship without a card.
const SITE_CARD_ROUTES = new Set([
  '', // the home page — the root layout's card is the home page's card
  '/privacy',
  '/terms',
])

test('every shared content route previews as itself, not as the home page', async (t) => {
  const shared = sitemap().filter((entry) => !SITE_CARD_ROUTES.has(pathOf(entry.url)))
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

// The other half of the rule. Without this, "no card" and "card deliberately
// inherited from the root layout" look identical from the outside, and the next
// page to forget one gets read as a decision.
test('the pages that inherit the site card do it on purpose', async (t) => {
  for (const path of SITE_CARD_ROUTES) {
    const meta = await metadataFor(path)
    t.is(meta.openGraph, undefined, `${path || '/'} declares no card of its own`)
    t.is(meta.twitter, undefined, `${path || '/'} declares no card of its own`)
  }
})

// The other side of the sitemap: routes we deliberately left out of it.
//
// Leaving a route out of the sitemap is not an instruction to anybody. The app
// subtree was excluded from day one and Google indexed /game regardless, via
// the Play button, where it inherited the root layout's title and description
// and competed with the home page for the same queries. Every test above reads
// the sitemap, so nothing here was covered by anything.
//
// Read from the filesystem rather than from a list, so a new screen under
// /game is covered the day it is added rather than the day someone remembers.
const APP_SUBTREE = 'src/app/game'

test('every route in the app subtree is noindex, and none of them is in the sitemap', async (t) => {
  const dir = new URL(`../${APP_SUBTREE}`, import.meta.url)
  const pages = (await readdir(dir, { recursive: true })).filter((f) =>
    String(f).endsWith('page.tsx'),
  )
  t.true(pages.length > 0, 'found no routes under the app subtree')

  const { metadata } = (await import(
    new URL(`../${APP_SUBTREE}/layout.tsx`, import.meta.url).href
  )) as { metadata?: Metadata }
  const robots = metadata?.robots as { index?: boolean; follow?: boolean } | undefined
  t.is(robots?.index, false, `${APP_SUBTREE}/layout.tsx must set robots.index = false`)
  t.is(robots?.follow, true, 'links out of the app are still worth following')

  // A route that set its own `robots` would drop the layout's, the same
  // field-at-a-time merge that cost the Learn routes their feed link.
  //
  // Read the source as well as the module, because the module check only sees
  // half of it. A route under a dynamic segment declares its title from
  // `generateMetadata` instead, and a `robots` returned from there is invisible
  // here: the export is a function, `mod.metadata` is undefined, the assertion
  // passes, and the route quietly indexes itself. Same mistake, so both forms
  // fail.
  for (const page of pages) {
    const mod = (await import(new URL(`../${APP_SUBTREE}/${page}`, import.meta.url).href)) as {
      metadata?: Metadata
    }
    t.is(mod.metadata?.robots, undefined, `${APP_SUBTREE}/${page} must not override robots`)

    const source = await readFile(new URL(`../${APP_SUBTREE}/${page}`, import.meta.url), 'utf-8')
    t.notRegex(
      source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' '),
      /\brobots\b/,
      `${APP_SUBTREE}/${page} must not mention robots: the subtree's noindex is the layout's`,
    )
  }

  const listed = sitemap().map((entry) => pathOf(entry.url))
  t.false(
    listed.some((path) => path === '/game' || path.startsWith('/game/')),
    'the app subtree stays out of the sitemap',
  )
})

interface Card {
  url: string
  alt: string
}
