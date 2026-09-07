import type { Metadata } from 'next'

// The app is not content, and until now nothing said so to a crawler.
//
// `src/app/sitemap.ts` has always excluded this subtree on the stated grounds
// that "the game itself is app, not content". That kept the routes out of the
// list we submit; it never stopped Google reaching them, because the landing
// page's Play button links straight here. So /game got indexed anyway, and it
// got indexed wearing the home page's clothes: no route under here exports
// metadata, so all six inherit the root layout's title ("Pip - clean poker"),
// the home page's description and an og:url pointing at the home page. None of
// them carries a canonical, because canonical.test.ts only reads the sitemap.
//
// Measured on 2026-08-28 (Search Console, Pages tab): /game took 23 impressions
// at average position 28.1 and 1 click, while / took 86 at position 4.9. Two
// URLs with the same title and description, competing on the same queries.
//
// noindex rather than a canonical to /, because a canonical is a claim these
// pages are the home page and /game/drills plainly is not. `follow` stays on:
// the links out of here are real and worth crawling.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return children
}
