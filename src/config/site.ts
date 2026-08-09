import type { Metadata } from 'next'

// The site's own address, in one place. The sitemap, the canonical tags and
// anything else absolute are built from it, so they cannot drift apart.

/** No trailing slash — every path below is written with a leading one. */
export const SITE_URL = 'https://playpip.io'

/** The feed, linked from every content page for reader discovery. */
export const RSS_URL = `${SITE_URL}/rss.xml`

/**
 * The `alternates` block an indexable content route needs: its canonical URL
 * and the feed link.
 *
 * Both live in here rather than one, and that is the whole reason the helper
 * exists. Next merges metadata a top-level field at a time, so a route that
 * declares `alternates: { canonical }` replaces the root layout's `alternates`
 * wholesale and takes the RSS <link> down with it. That already happened once:
 * the two Learn routes shipped a canonical in v1.3.0 and quietly lost feed
 * discovery, and nothing failed. Going through this helper means a route can't
 * gain one and lose the other.
 *
 * @param path Route path with a leading slash; '' for the home page.
 */
export function contentAlternates(path: string): Metadata['alternates'] {
  return {
    canonical: `${SITE_URL}${path}`,
    types: { 'application/rss+xml': RSS_URL },
  }
}
