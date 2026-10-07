import type { Metadata } from 'next'

// Where the unsubscribe link in every Pip email lands. A step in a flow,
// reachable only with a token from an email, so it is kept out of search.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: 'Stop Pip emails · Pip',
  description: 'Turn off the emails Pip sends to your account.',
}

export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return children
}
