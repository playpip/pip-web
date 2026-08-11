import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { THEME_BOOT_SCRIPT, ThemeProvider } from '@/components/theme-provider'
import { TEXT_SCALE_BOOT_SCRIPT, TextScaleProvider } from '@/components/text-scale-provider'
import { AppBoot } from '@/components/AppBoot'
import { SyncConflictDialog } from '@/components/settings/SyncConflictDialog'
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
  // Feed discovery for readers — emitted as a <link rel="alternate"> on every page.
  alternates: { types: { 'application/rss+xml': 'https://playpip.io/rss.xml' } },
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
      "Real Texas Hold'em vs AI, wrapped in a calm, modern app. Play money, no account needed, open source.",
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@playpipio',
    creator: '@playpipio',
    title: 'Poker without the casino.',
    description: "Real Texas Hold'em vs AI. Play money, no account needed, open source.",
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
        {/* Same trick for the text size setting: root font size before first
            paint, or every rem in the app reflows after hydration. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, self-authored boot script */}
        <script dangerouslySetInnerHTML={{ __html: TEXT_SCALE_BOOT_SCRIPT }} />
        <ThemeProvider>
          <TextScaleProvider>{children}</TextScaleProvider>
        </ThemeProvider>
        <AppBoot />
        <SyncConflictDialog />
        <UpdatePrompt />
        {/* Umami's standard cookieless tag. Cross-origin, so the offline SW
            ignores it; fire-and-forget, so a blocked/failed load is harmless.

            data-exclude-hash is not housekeeping. Supabase returns an auth
            session in the URL fragment (see lib/sync/client.ts), so without it
            a confirm or password-reset landing records the player's access
            token (which carries their email address) as a page path. The
            attribute makes Umami blank the fragment on the page URL, the
            referrer, and SPA navigations alike, before anything is sent.

            Search params are deliberately NOT excluded: campaign attribution
            reads utm_* from the query, and nothing secret arrives there today.
            If sync ever moves to the PKCE flow the code lands in the query
            instead, and this decision has to be revisited (technology#30). */}
        {process.env.NODE_ENV === 'production' && UMAMI_ID && (
          <script defer src={UMAMI_SRC} data-website-id={UMAMI_ID} data-exclude-hash="true" />
        )}
      </body>
    </html>
  )
}
