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

/**
 * The `openGraph` + `twitter` blocks a page needs to preview as itself.
 *
 * Same trap as `contentAlternates`, one field along. A route that sets only
 * `title` and `description` keeps the root layout's `openGraph.title`, so the
 * tab said "Pip, for readers who aren't people" while every share of that link
 * unfurled as "Poker without the casino." — the home page's card, on a post
 * about something else. The Learn guides carry their own block for this reason;
 * the blog never got one.
 *
 * Declaring `openGraph` replaces the root block whole, so everything that is not
 * per-page — siteName, locale, the Twitter handles, **the image** — is repeated
 * here rather than inherited. The image is the part that bites: the root card
 * comes from `app/opengraph-image.tsx`, and a page that declares `openGraph`
 * without naming an image ships a `summary_large_image` card with no image in
 * it. Two Learn guides are live in exactly that state today.
 *
 * @param path Route path with a leading slash.
 * @param title Bare page title, no " · Pip" suffix — the card says Pip already.
 * @param image The page's own card, if it has one; otherwise Pip's.
 */
export function contentSocial({
  path,
  title,
  description,
  type = 'article',
  image = SITE_CARD,
}: {
  path: string
  title: string
  description: string
  type?: 'article' | 'website'
  image?: SocialImage
}): Pick<Metadata, 'openGraph' | 'twitter'> {
  const images = [image]
  return {
    openGraph: {
      type,
      siteName: 'Pip',
      locale: 'en_GB',
      url: `${SITE_URL}${path}`,
      title,
      description,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      site: '@playpipio',
      creator: '@playpipio',
      title,
      description,
      images,
    },
  }
}

export interface SocialImage {
  /** Absolute — relative image URLs are dropped by most unfurlers. */
  url: string
  width: number
  height: number
  alt: string
}

/**
 * Pip's own card, for pages without art of their own. The URL is the static
 * export of `app/opengraph-image.tsx`; Next adds a cache-busting query to its
 * own copy of the link, and the bare path serves the same PNG. Size matches
 * `ogSize` in src/lib/og.tsx, written out rather than imported so that a page's
 * metadata does not pull `next/og` in behind it.
 */
const SITE_CARD: SocialImage = {
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: 'Pip — poker without the casino',
}
