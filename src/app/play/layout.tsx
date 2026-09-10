import type { Metadata } from 'next'

// The same defect as /game, on twenty-nine more URLs, left behind when /game
// was fixed.
//
// `src/app/sitemap.ts` excludes the whole app on the grounds that "the game
// itself is app, not content", and that is not an instruction to anybody: it
// keeps a route off the list we submit and does nothing to stop it being
// reached and indexed. /game was indexed exactly that way, wearing the home
// page's title and description, and took 23 impressions at average position
// 28.1 against the home page's 86 at 4.9 (Search Console, 2026-08-28).
//
// /play/[venue] prerenders one static HTML file per venue for the export, and
// there are twenty-nine of them. Before this layout every one shipped with
// `<title>Pip — clean poker</title>`, the home page's description, no canonical
// and nothing telling a crawler to leave it alone. The noindex guard added with
// the /game fix reads `src/app/game` only, so nothing failed.
//
// noindex rather than a canonical to /, for the reason written there: a
// canonical would be a claim that a table *is* the home page. `follow` stays
// on. The title is the other half and noindex does not fix it, because a
// bookmark or a shared table link still reads whatever the tab said.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: 'At the table · Pip',
  description: 'A table in the app: sit down, play a hand. Play money, no ads.',
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return children
}
