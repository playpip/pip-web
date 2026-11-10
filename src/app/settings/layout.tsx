import type { Metadata } from 'next'
import { APP_BANNER } from '@/config/site'

// App, not content: your own preferences, kept on your own device. Nothing to
// index (see src/app/stats/layout.tsx). `follow` stays on.
export const metadata: Metadata = {
  ...APP_BANNER,
  robots: { index: false, follow: true },
  title: 'Settings · Pip',
  description: 'Text size, sound, notifications and your account.',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children
}
