import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { THEME_BOOT_SCRIPT, ThemeProvider } from '@/components/theme-provider'
import { AppBoot } from '@/components/AppBoot'
import { UpdatePrompt } from '@/components/UpdatePrompt'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// Anonymous, cookieless analytics (Umami). Baked in at build time and loaded
// only in production when the website id is configured — dev/test/preview stay
// clean, and there's no tag at all until the id is set in the Pages env.
const UMAMI_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC ?? 'https://cloud.umami.is/script.js'

export const metadata: Metadata = {
  // Required so static-export OG/Twitter image URLs resolve to absolute links.
  metadataBase: new URL('https://playpip.io'),
  title: 'Pip — clean poker',
  description: "Casual Texas Hold'em, redesigned. No fake felt, no neon.",
  appleWebApp: {
    capable: true,
    title: 'pip',
    statusBarStyle: 'black-translucent',
  },
  // The og/twitter image comes from `app/opengraph-image.tsx` — Next wires it
  // into `openGraph.images` + `twitter.images` automatically.
  openGraph: {
    type: 'website',
    siteName: 'Pip',
    url: 'https://playpip.io',
    title: 'Poker without the casino.',
    description:
      "Real Texas Hold'em vs AI, wrapped in a calm, modern app. Play money, no accounts, open source.",
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Poker without the casino.',
    description: "Real Texas Hold'em vs AI. Play money, no accounts, open source.",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
  ],
  // Native-app feel: no pinch-zoom, and no auto-zoom when focusing an input.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full">
        {/* No-flash theme boot — inline from the server so it runs pre-paint
            (and React never sees a client-rendered script). */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, self-authored boot script */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <ThemeProvider>{children}</ThemeProvider>
        <AppBoot />
        <UpdatePrompt />
        {/* Umami's standard cookieless tag. Cross-origin, so the offline SW
            ignores it; fire-and-forget, so a blocked/failed load is harmless. */}
        {process.env.NODE_ENV === 'production' && UMAMI_ID && (
          <script defer src={UMAMI_SRC} data-website-id={UMAMI_ID} />
        )}
      </body>
    </html>
  )
}
