import type { Metadata } from 'next'

// App, not content: your own preferences, kept on your own device. Nothing to
// index (see src/app/stats/layout.tsx). `follow` stays on. No app banner: the
// store banners only go where installBannerRoute allows them.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: 'Settings · Pip',
  description: 'Text size, sound, notifications and your account.',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children
}
