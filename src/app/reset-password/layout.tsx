import type { Metadata } from 'next'

// Where the password-reset email lands. A step in a flow, reachable only with a
// token, and it was indexable under the home page's title.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: 'Reset your password · Pip',
  description: 'Set a new password for your Pip account.',
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
