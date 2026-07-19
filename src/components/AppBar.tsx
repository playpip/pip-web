'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Palette, Settings } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { ProfileDialog } from '@/components/profile/ProfileDialog'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { StyleDialog } from '@/components/settings/StyleDialog'
import { useProfile } from '@/store/profile'
import { rankFor } from '@/config/ranks'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

type Leading = 'profile' | 'back' | 'none'

/**
 * The one navigation bar for the whole app. Every screen drops this in rather
 * than hand-rolling its own, so the back arrow, the pip wordmark, and the
 * Style + Settings buttons are identical everywhere. It owns the Profile,
 * Style and Settings dialogs — those live here, not per-page.
 *
 * - `leading='profile'` — the home lobby: avatar + name + rank, taps to edit.
 * - `leading='back'` — every sub-screen: a chevron back (to the menu by
 *   default, or `onBack` for a custom exit like the table's leave-confirm).
 * - `title` — an optional centred label (the table shows venue + blinds).
 * - `actions` — page-specific buttons (e.g. the table's History / Help),
 *   rendered just before the shared pip · Style · Settings cluster.
 */
export function AppBar({
  leading = 'back',
  backLabel = 'Menu',
  onBack,
  title,
  actions,
  showWordmark = true,
  className,
}: {
  leading?: Leading
  backLabel?: string
  onBack?: () => void
  title?: React.ReactNode
  actions?: React.ReactNode
  /** The pip wordmark. Off on the table, where the venue name is the title. */
  showWordmark?: boolean
  className?: string
}) {
  const router = useRouter()
  const { name, avatar, peakRoll } = useProfile()
  const [profileOpen, setProfileOpen] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const back = () => {
    sound.play('tap')
    if (onBack) onBack()
    else router.push('/game')
  }

  return (
    <header className={cn('w-full px-6 pt-6 md:px-10 md:pt-8', className)}>
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3">
        {/* leading */}
        {leading === 'profile' ? (
          <button
            onClick={() => {
              sound.play('tap')
              setProfileOpen(true)
            }}
            className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 transition hover:bg-foreground/5 active:scale-[0.98]"
            aria-label="Edit player"
          >
            {avatar && <PlayerAvatar spec={avatar} size={40} />}
            <div className="text-left leading-tight">
              <div className="text-sm font-medium text-muted-foreground">{name}</div>
              <div className="text-[11px] text-muted-foreground/70">{rankFor(peakRoll).name}</div>
            </div>
          </button>
        ) : leading === 'back' ? (
          <button
            onClick={back}
            className="-ml-2 flex items-center gap-1 rounded-full py-1.5 pl-2 pr-4 text-sm font-medium text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground active:scale-[0.98]"
          >
            <ChevronLeft className="size-4" />
            {backLabel}
          </button>
        ) : (
          <div />
        )}

        {/* centred title (absolute so it stays centred regardless of side widths) */}
        {title && (
          <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center leading-tight">
            {title}
          </div>
        )}

        {/* the shared right cluster: page actions, then pip · Style · Settings */}
        <div className="flex items-center gap-0.5 md:gap-1">
          {actions}
          {showWordmark && (
            <span className="mx-1 select-none text-xl font-semibold lowercase tracking-tight text-muted-foreground">
              pip
            </span>
          )}
          <button
            onClick={() => {
              sound.play('tap')
              setStyleOpen(true)
            }}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
            aria-label="Style"
          >
            <Palette className="size-4" />
          </button>
          <button
            onClick={() => {
              sound.play('tap')
              setSettingsOpen(true)
            }}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>

      {leading === 'profile' && <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />}
      <StyleDialog open={styleOpen} onOpenChange={setStyleOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  )
}

/** A single icon button styled for the AppBar's `actions` slot. */
export function AppBarAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
    >
      {children}
    </button>
  )
}
