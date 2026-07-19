'use client'

import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { AppBar } from './AppBar'

/**
 * The standard screen frame: the shared AppBar over a `max-w-6xl` content
 * column. Every menu-like page (home, the section browsers, stats) uses this so
 * they line up to the same width and share one navigation bar. The full-screen
 * game table is the deliberate exception — it renders `<AppBar>` directly over
 * an immersive, full-bleed felt.
 */
export function PageShell({
  children,
  ...appBar
}: { children: React.ReactNode } & ComponentProps<typeof AppBar>) {
  // The home lobby (leading='profile') opens with the Roll hero, which brings
  // its own generous top space; the back-led pages open straight into a title,
  // so they need a real gap under the nav bar to breathe.
  const spacious = appBar.leading !== 'profile'

  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar {...appBar} />
      {/* Padding lives on the outer wrapper and the max-w cap on the inner
          column — the SAME structure as AppBar — so the content column lines up
          exactly with the nav bar's, rather than sitting a padding's-width in. */}
      <main
        className={cn(
          'flex flex-1 flex-col px-6 pb-8 md:px-10',
          spacious ? 'pt-10 md:pt-14' : 'pt-4',
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">{children}</div>
      </main>
    </div>
  )
}
