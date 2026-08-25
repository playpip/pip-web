import type { Metadata } from 'next'
import { contentAlternates, contentSocial } from './site'

// The blog's table of contents. Each post is a static page under
// src/app/blog/<slug>/ — this registry drives the index page, the sitemap, and
// per-post metadata, so a new post is one folder plus one entry here.

export interface BlogPost {
  /** URL segment — must match the post's folder under src/app/blog/. */
  slug: string
  title: string
  /** One-line summary, used on the index and as the meta description. */
  description: string
  /** ISO date, e.g. '2026-07-25'. */
  date: string
}

/** Newest first — the index renders this order as-is. */
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'what-we-got-wrong',
    title: 'Everything we have published that was wrong',
    description:
      'Every false claim we have shipped: what each one said, how long it served, how we found it, and the test that now fails if it comes back. The newest one is a sentence in this post.',
    date: '2026-08-24',
  },
  {
    slug: 'verify-todays-deal',
    title: 'Verify today’s deal yourself',
    description:
      'Everyone playing the Daily gets the same shuffle. Here are the six steps that produce it, a snippet that runs anywhere, and one day’s deck to check yourself against.',
    date: '2026-08-20',
  },
  {
    slug: 'two-devices-two-chip-counts',
    title: 'Two devices, two chip counts',
    description:
      'Pip now has an optional account that carries your progress to a second device. The interesting part isn’t the sign-in, it’s what happens when both devices have been played.',
    date: '2026-08-04',
  },
  {
    slug: 'agent-readable',
    title: 'Pip, for readers who aren’t people',
    description:
      'Every content page now answers Accept: text/markdown with its plain text version — a free-plan build of what Cloudflare offers as Markdown for Agents, in about ninety lines.',
    date: '2026-07-26',
  },
  {
    slug: 'launch-week',
    title: 'Launch week: what shipped',
    description:
      'A new card back, four more hand nicknames, a quicker freeroll, and three strangers in the credits — everything that changed in Pip’s first days in the open.',
    date: '2026-07-25',
  },
  {
    slug: 'pip-is-live',
    title: 'Pip is live, and it’s open source',
    description:
      'Single-player Texas Hold’em with no account needed, no ads, and no real money — now live at playpip.io, with the whole codebase in the open.',
    date: '2026-07-25',
  },
]

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/**
 * Everything a post's page needs to head itself: title, description, canonical,
 * feed link and share card, all from the registry entry.
 *
 * It is a helper rather than four hand-written blocks because hand-written is
 * where it went wrong. Each post declared its own title and description and
 * stopped there, which left all four unfurling as the home page's card, and the
 * next post would have made the same omission in the same place.
 */
export function postMetadata(post: BlogPost): Metadata {
  const path = `/blog/${post.slug}`
  return {
    title: `${post.title} · Pip`,
    description: post.description,
    alternates: contentAlternates(path),
    ...contentSocial({ path, title: post.title, description: post.description }),
  }
}

/** '2026-07-25' -> '25 July 2026'. Fixed format — no locale or timezone involved. */
export function formatPostDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

const SITE = 'https://playpip.io'

/** Escape the five XML entities so registry copy stays safe to edit. */
function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/**
 * RSS 2.0 feed for the blog, built from the registry as-is (newest first —
 * the order tests/blog.test.ts pins), served statically from /rss.xml.
 */
export function buildRssXml(posts: BlogPost[]): string {
  const items = posts
    .map((post) => {
      const url = `${SITE}/blog/${post.slug}`
      const pubDate = new Date(`${post.date}T00:00:00Z`).toUTCString()
      return [
        '    <item>',
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid>${url}</guid>`,
        `      <description>${escapeXml(post.description)}</description>`,
        `      <pubDate>${pubDate}</pubDate>`,
        '    </item>',
      ].join('\n')
    })
    .join('\n')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Blog · Pip</title>',
    `    <link>${SITE}/blog</link>`,
    // Tells aggregators the feed's own address, so a mirrored or proxied copy
    // still points home. The one thing the W3C validator asks for.
    `    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />`,
    '    <description>Notes from the Pip table — what shipped, what changed, and the occasional hand worth talking about.</description>',
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}
