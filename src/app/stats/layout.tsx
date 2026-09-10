import type { Metadata } from 'next'

// App, not content: your own lifetime numbers, read out of your own browser.
// Nothing to index, and until this file it shipped as another static page
// wearing the home page's title (see src/app/play/layout.tsx for the whole
// story). `follow` stays on.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: 'Your stats · Pip',
  description: 'Your own lifetime numbers, kept in your browser.',
}

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children
}
