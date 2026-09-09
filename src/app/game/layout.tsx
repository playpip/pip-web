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
//
// The title and description are the other half, and noindex does nothing about
// them: content links into this subtree in three places (Landing.tsx and
// PlayCta to /game, /learn to /game/drills, /learn/hand-rankings to
// /game/drills/which-hand-wins), and a reader clicking through from a guide
// gets a tab, a bookmark and a back-button entry reading "Pip - clean poker".
// This is the subtree default: /game/page.tsx is a client component and cannot
// export metadata at all, so its title can only live here, and the ladder, the
// rail and the side tables are all fairly described by it. Drills override.
//
// `openGraph` stays the root layout's on purpose. Metadata merges a field at a
// time, so setting `title` and `description` here leaves the share card alone,
// which is what we want: a per-route og:url on a noindex page would be a claim
// that someone reads it, and share links took 4 views in 30 days.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: 'Play · Pip',
  description: 'The app itself: pick a table, sit down, play a hand. Play money, no ads.',
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return children
}
