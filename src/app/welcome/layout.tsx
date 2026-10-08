import type { Metadata } from 'next'

// The welcome flow: a new player's first four screens. App, not content.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: 'Welcome · Pip',
  description: 'Make your player and play your first game.',
}

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children
}
