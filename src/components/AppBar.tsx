'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Palette, Settings } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { ProfileDialog } from '@/components/profile/ProfileDialog'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { AccountBarButton } from '@/components/settings/AccountOffer'
import { StyleDialog } from '@/components/settings/StyleDialog'
import { useProfile } from '@/store/profile'
import { avatarRingById } from '@/config/cosmetics'
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
 * - `actions` — page-specific buttons, rendered just before the shared
 *   pip · Style · Settings cluster.
 * - `chrome={false}` — no account, Style or Settings buttons: for a screen a
 *   stranger lands on from a link, where only the page's own actions belong.
 * - `account={false}` — Style and Settings, but no account button: for the
 *   first game, where onboarding asks about an account straight afterwards.
 * - `leading='none'` — nothing on the left, and the title sits there in the
 *   flow instead of floating centred, so it can never run under the actions.
 * - `settings` — what the gear opens: `'sheet'` (the default) over a screen you
 *   can't walk off mid-game, `'page'` (/settings) from a menu screen, which
 *   PageShell asks for, or `'none'` on the settings page itself.
 */
export function AppBar({
  leading = 'back',
  backLabel = 'Menu',
  onBack,
  title,
  actions,
  showWordmark = true,
  chrome = true,
  account = true,
  settings = 'sheet',
  className,
}: {
  leading?: Leading
  backLabel?: string
  onBack?: () => void
  title?: React.ReactNode
  actions?: React.ReactNode
  /** The pip wordmark. Off on the table, where the venue name is the title. */
  showWordmark?: boolean
  /** The account · Style · Settings buttons. Off on a shared hand. */
  chrome?: boolean
  /** The signed-out account button. Off on the welcome table. */
  account?: boolean
  /** What the gear opens. */
  settings?: 'sheet' | 'page' | 'none'
  className?: string
}) {
  const router = useRouter()
  const { name, avatar, peakRoll, avatarRing } = useProfile()
  // The player's own ring, on the player's own face. Every other avatar in
  // the app belongs to somebody in the cast and wears nothing.
  const ring = avatarRingById(avatarRing)
  const [profileOpen, setProfileOpen] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const centred = Boolean(title) && leading !== 'none'
  const row = useRef<HTMLDivElement>(null)
  const stacked = useStackedTitle(row, centred)

  const back = () => {
    sound.play('tap')
    if (onBack) onBack()
    else router.push('/game')
  }

  return (
    // A container, so the bar can fit itself to the room it has in rem: at 200%
    // text on a phone (Settings → Text size) the row is under 11rem wide, and
    // the wordmark, the back label and the buttons' padding give way in turn
    // rather than pushing the last button off the screen.
    <header className={cn('@container w-full px-6 pt-6 md:px-10 md:pt-8', className)}>
      <div
        ref={row}
        className={cn(
          'mx-auto max-w-6xl items-center',
          // With a centred title: three columns, the sides equal while there
          // is room so the title sits dead centre. When the buttons leave it
          // no room (a phone, a bigger text size), it drops to its own line.
          centred
            ? 'grid grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)] gap-x-3 gap-y-1'
            : 'flex justify-between gap-3',
        )}
      >
        {/* leading */}
        {leading === 'profile' ? (
          <button
            onClick={() => {
              sound.play('tap')
              setProfileOpen(true)
            }}
            className="flex items-center gap-3 justify-self-start rounded-full py-1 pl-1 pr-3 transition hover:bg-foreground/5 active:scale-[0.98]"
            aria-label="Edit player"
          >
            {avatar && <PlayerAvatar spec={avatar} size={40} ring={ring} />}
            <div className="text-left leading-tight">
              <div className="text-sm font-medium text-muted-foreground">{name}</div>
              <div className="text-2xs text-muted-foreground/70">{rankFor(peakRoll).name}</div>
            </div>
          </button>
        ) : leading === 'back' ? (
          <button
            onClick={back}
            className="-ml-2 flex items-center gap-1 justify-self-start whitespace-nowrap rounded-full py-1.5 pl-2 pr-2 @[14rem]:pr-4 text-sm font-medium text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground active:scale-[0.98]"
          >
            <ChevronLeft className="size-4 shrink-0" />
            {/* Below 14rem the chevron alone is the button; the label stays for screen readers. */}
            <span className="sr-only @[14rem]:not-sr-only">{backLabel}</span>
          </button>
        ) : title ? (
          <div className="flex min-w-0 flex-col items-start leading-tight">{title}</div>
        ) : (
          <div />
        )}

        {/* centred title, in its own column so it can never overlap the sides */}
        {centred && (
          <div
            className={cn(
              'flex min-w-0 flex-col items-center leading-tight [&>*]:max-w-full [&>*]:truncate',
              stacked && 'col-span-full row-start-2',
            )}
          >
            {title}
          </div>
        )}

        {/* the shared right cluster: page actions, then pip · Style · Settings */}
        <div
          className={cn(
            'flex items-center gap-0.5 md:gap-1',
            centred && 'col-start-3 row-start-1 justify-self-end',
          )}
        >
          {actions}
          {showWordmark && (
            <span className="mx-1 hidden select-none text-xl @[20rem]:inline font-semibold lowercase tracking-tight text-muted-foreground">
              pip
            </span>
          )}
          {/* Signed out only, and it vanishes permanently once there is an
              account. One tap from anywhere beats three taps from two screens. */}
          {chrome && (
            <>
              {account && <AccountBarButton />}
              <button
                onClick={() => {
                  sound.play('tap')
                  setStyleOpen(true)
                }}
                className="rounded-full p-1.5 text-muted-foreground transition @[20rem]:p-2 hover:bg-foreground/5 hover:text-foreground"
                aria-label="Style"
              >
                <Palette className="size-4" />
              </button>
              {settings !== 'none' && (
                <button
                  onClick={() => {
                    sound.play('tap')
                    if (settings === 'page') router.push('/settings')
                    else setSettingsOpen(true)
                  }}
                  className="rounded-full p-1.5 text-muted-foreground transition @[20rem]:p-2 hover:bg-foreground/5 hover:text-foreground"
                  aria-label="Settings"
                >
                  <Settings className="size-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {leading === 'profile' && <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />}
      {chrome && (
        <>
          <StyleDialog open={styleOpen} onOpenChange={setStyleOpen} />
          {settings === 'sheet' && (
            <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
          )}
        </>
      )}
    </header>
  )
}

/**
 * Whether a centred title has to drop below the bar's buttons: true when the
 * back button, the title and the right cluster can't share one row. Measured,
 * not guessed, because the text size, the label and the buttons all vary.
 * The row's children are always [leading, title, actions].
 */
function useStackedTitle(row: React.RefObject<HTMLDivElement | null>, enabled: boolean): boolean {
  const [stacked, setStacked] = useState(false)
  useEffect(() => {
    const el = row.current
    if (!enabled || !el) return
    const measure = () => {
      const [lead, title, actions] = Array.from(el.children) as HTMLElement[]
      if (!lead || !title || !actions) return
      // The title's own width, untruncated: its lines' full text widths.
      const need = Math.max(0, ...Array.from(title.children).map((c) => c.scrollWidth))
      const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0
      setStacked(lead.offsetWidth + need + actions.offsetWidth + gap * 2 > el.clientWidth)
    }
    // Resize callbacks land after layout and before paint, so the first
    // measurement never shows a frame of overlap.
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [row, enabled])
  return enabled && stacked
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
      className="rounded-full p-1.5 text-muted-foreground transition @[20rem]:p-2 hover:bg-foreground/5 hover:text-foreground"
    >
      {children}
    </button>
  )
}
