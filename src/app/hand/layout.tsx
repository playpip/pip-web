import type { Metadata } from 'next'

// App, not content, and the one route where that is worth spelling out.
//
// A shared hand lives entirely in the URL fragment, which no crawler sends and
// no server sees, so every shared link indexes as the same empty shell under
// the home page's title. The share card is untouched by this: unfurlers read
// the og tags from app/hand/opengraph-image.tsx and do not consult a robots
// meta, so links still preview.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: 'A shared hand · Pip',
  description: 'A hand of Texas Hold’em, replayed from the link. No account, no server.',
}

export default function HandLayout({ children }: { children: React.ReactNode }) {
  return children
}
