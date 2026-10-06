'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { inApp } from '@/lib/nativeApp'

/**
 * The way out of a prose page.
 *
 * The installed PWA has no browser chrome, so leaving the app for /learn or
 * /privacy was a one-way trip: the only navigation these pages carried was the
 * wordmark, and that goes to the marketing landing page rather than back to the
 * table. Prefer this tab's own history, since that is where the reader actually
 * came from. With no history to use, send the installed app to /game and a
 * browser tab to the landing page.
 */
export function BackButton() {
  const router = useRouter()

  const back = () => {
    if (window.history.length > 1) {
      router.back()
      return
    }
    // iOS reports an installed PWA on navigator.standalone; everyone else
    // answers the media query. The store app has no browser chrome either.
    const installed =
      inApp() ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    router.push(installed ? '/game' : '/')
  }

  return (
    <button
      type="button"
      onClick={back}
      aria-label="Back"
      className="-ml-2 rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground active:scale-95"
    >
      <ChevronLeft className="size-5" />
    </button>
  )
}
