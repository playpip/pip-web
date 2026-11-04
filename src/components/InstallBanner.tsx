'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { trackOnce } from '@/lib/analytics'
import { inApp } from '@/lib/nativeApp'
import { sound } from '@/lib/sound'
import {
  INSTALL_DISMISSED_KEY,
  INSTALL_VISITS_KEY,
  installBannerDue,
  installBannerRoute,
} from '@/lib/installBanner'

/** Chrome's install offer, as held by INSTALL_BOOT_SCRIPT. */
interface InstallOffer extends Event {
  prompt: () => Promise<void>
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __pipInstall?: InstallOffer | null
    __pipInstalled?: boolean
  }
}

const CHANGE = 'pip-install-change'

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange)
  return () => window.removeEventListener(CHANGE, onChange)
}

const offer = () => (window.__pipInstalled ? null : (window.__pipInstall ?? null))
const noOffer = () => null

function readNumber(key: string): number | null {
  try {
    const v = localStorage.getItem(key)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}

/** Android Chrome on a phone, in the browser rather than installed or in the store app. */
function eligibleDevice(): boolean {
  if (inApp()) return false
  if (!/Android/i.test(navigator.userAgent)) return false
  return !window.matchMedia('(display-mode: standalone)').matches
}

/**
 * A slim row offering to add Pip to the home screen, on Android only. It is
 * Chrome's own install offer (`beforeinstallprompt`) given the look of the
 * Smart App Banner Safari shows on iPhone. From the second visit, on the
 * lobby and reading pages only, and gone for 30 days once closed.
 */
export function InstallBanner() {
  const event = useSyncExternalStore(subscribe, offer, noOffer)
  const pathname = usePathname()
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    const installed = () => trackOnce('app-installed')
    window.addEventListener('appinstalled', installed)
    return () => window.removeEventListener('appinstalled', installed)
  }, [])

  if (!event || closed || !installBannerRoute(pathname) || !eligibleDevice()) return null
  const visits = readNumber(INSTALL_VISITS_KEY) ?? 0
  if (!installBannerDue(visits, readNumber(INSTALL_DISMISSED_KEY), Date.now())) return null

  const close = () => {
    sound.play('tap')
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()))
    } catch {
      // Storage blocked: it stays closed for this page and comes back later.
    }
    setClosed(true)
  }

  const install = async () => {
    sound.play('tap')
    trackOnce('install-banner-tapped')
    // The offer can be used once. Whatever the answer, drop it.
    window.__pipInstall = null
    setClosed(true)
    try {
      await event.prompt()
    } catch {
      // Chrome refused to show it (already shown, or gone stale). Nothing to do.
    }
  }

  return <Row onClose={close} onInstall={install} />
}

function Row({ onClose, onInstall }: { onClose: () => void; onInstall: () => void }) {
  useEffect(() => trackOnce('install-banner-seen'), [])
  return (
    <div className="relative z-40 border-b border-foreground/10 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-ml-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground active:scale-95"
        >
          <X className="size-4" />
        </button>
        <img
          src="/icons/icon-192.png"
          alt=""
          width={44}
          height={44}
          className="size-11 shrink-0 rounded-xl shadow-md shadow-black/40 ring-1 ring-foreground/10"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Pip: Poker</p>
          <p className="truncate text-xs text-muted-foreground">Add Pip to your home screen</p>
        </div>
        <button
          type="button"
          onClick={onInstall}
          className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/20 transition hover:bg-primary/90 active:scale-95"
        >
          Install
        </button>
      </div>
    </div>
  )
}
