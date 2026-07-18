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

export const metadata: Metadata = {
  title: 'Pip — clean poker',
  description: "Casual Texas Hold'em, redesigned. No fake felt, no neon.",
  appleWebApp: {
    capable: true,
    title: 'pip',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
  ],
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
      </body>
    </html>
  )
}
