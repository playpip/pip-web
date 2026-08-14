import type { MetadataRoute } from 'next'
import { BLOG_POSTS } from '@/config/blog'
import { LEARN_GUIDES } from '@/config/learn'
import { SITE_URL } from '@/config/site'

// Generated at build time into out/sitemap.xml (the app is a static export).
// Only the pages worth a crawler's time — the game itself is app, not content.

// Required for the static export — rendered once at build into out/sitemap.xml.
export const dynamic = 'force-static'

// Same constant the canonical tags are built from (src/config/site.ts), so a
// listed URL and the URL that page claims for itself cannot drift.
const BASE = SITE_URL

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [
    '',
    '/learn',
    '/tutorial',
    '/play-poker-free-no-signup',
    '/poker-odds-calculator',
    '/blog',
    '/credits',
    '/privacy',
    '/terms',
  ].map((path) => ({ url: `${BASE}${path}` }))
  const posts: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: post.date,
  }))
  const guides: MetadataRoute.Sitemap = LEARN_GUIDES.map((guide) => ({
    url: `${BASE}/learn/${guide.slug}`,
    lastModified: guide.date,
  }))
  return [...pages, ...posts, ...guides]
}
