'use client'

// The sidebar: who you are, and everywhere you can go (Will, 2026-11-22).
//
// One list, two homes. On a desktop menu screen it stands at the left the whole
// time (`DesktopSidebar`, from PageShell). On a phone it slides in from the left
// when you tap your face in the bar (`SidebarDrawer`). It is never on a table:
// the felt keeps the whole screen, and its bar keeps Style and Settings.
//
// It took Style, Settings and the profile off the top bar, which now says pip
// and shows the Friends count only when something is waiting.

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Crown,
  Dumbbell,
  GraduationCap,
  House,
  Layers,
  type LucideIcon,
  Map as MapIcon,
  Palette,
  Settings,
  ShoppingBag,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Wifi,
  X,
} from 'lucide-react'
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { ProfileDialog } from '@/components/profile/ProfileDialog'
import { useOpenOwnProfile } from '@/components/social/useOpenOwnProfile'
import { ShopDialog } from '@/components/menu/ShopDialog'
import { AccountDialog } from '@/components/settings/AccountDialog'
import { StyleDialog } from '@/components/settings/StyleDialog'
import { avatarRingById } from '@/config/cosmetics'
import { rankFor } from '@/config/ranks'
import { roomsConfigured } from '@/lib/multiplayer/client'
import { ratingOf } from '@/lib/rating'
import { ratingEnabled } from '@/lib/rating/local'
import { socialEnabled } from '@/lib/social/api'
import { syncConfigured } from '@/lib/sync/client'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'
import { useSocial } from '@/store/social'
import { useSync } from '@/store/sync'

interface Item {
  href: string
  label: string
  icon: LucideIcon
  /** Also lit on these paths, for pages a section opens. */
  also?: string[]
  badge?: number
}

/** Your face, name, rank and rating. Tapping it opens your profile (`useOpenOwnProfile`). */
function Who({ onOpen, roomRight }: { onOpen: () => void; roomRight?: boolean }) {
  const { name, avatar, peakRoll, avatarRing, rating } = useProfile()
  const handle = useSocial((s) => s.me?.handle)
  return (
    <button
      type="button"
      onClick={() => {
        sound.play('tap')
        onOpen()
      }}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-foreground/[0.05] active:scale-[0.98]',
        // In the drawer the close button sits top right.
        roomRight && 'pr-10',
      )}
    >
      {avatar ? (
        <PlayerAvatar spec={avatar} size={44} ring={avatarRingById(avatarRing)} />
      ) : (
        <span className="size-11 shrink-0 rounded-full bg-foreground/[0.08]" />
      )}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate font-medium">{name || 'Player'}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {handle ? `@${handle} · ` : ''}
          {rankFor(peakRoll).name}
          {ratingEnabled() && ` · ${ratingOf(rating.core).toLocaleString('en-GB')}`}
        </span>
      </span>
    </button>
  )
}

function NavLink({ item, onGo }: { item: Item; onGo?: () => void }) {
  const path = usePathname()
  const on =
    item.href === '/game'
      ? path === '/game'
      : path === item.href ||
        path.startsWith(`${item.href}/`) ||
        (item.also ?? []).some((p) => path.startsWith(p))
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={() => {
        sound.play('tap')
        onGo?.()
      }}
      aria-current={on ? 'page' : undefined}
      className={cn(
        // 44px rows in the phone drawer, for a thumb; Mac-sized on a desktop.
        'relative flex min-h-11 items-center gap-3.5 rounded-xl px-3 py-2 text-[0.9375rem] font-medium transition lg:min-h-8 lg:gap-3 lg:py-1 lg:text-sm',
        on
          ? 'text-foreground'
          : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
      )}
    >
      {on && (
        <motion.span
          layoutId="sidebar-on"
          className="absolute inset-0 rounded-xl bg-foreground/[0.08]"
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        />
      )}
      <Icon className="relative size-5 shrink-0 lg:size-[1.125rem]" />
      <span className="relative min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="relative rounded-full bg-primary px-1.5 text-2xs font-semibold leading-5 text-primary-foreground tabular-nums">
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      ) : null}
    </Link>
  )
}

function Action({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        sound.play('tap')
        onClick()
      }}
      className="flex min-h-11 w-full items-center gap-3.5 rounded-xl px-3 py-2 text-left text-[0.9375rem] font-medium text-muted-foreground lg:min-h-8 lg:gap-3 lg:py-1 lg:text-sm transition hover:bg-foreground/[0.04] hover:text-foreground"
    >
      <Icon className="size-5 shrink-0 lg:size-[1.125rem]" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

/** The list itself. `onGo` closes the drawer on a phone. */
function SidebarBody({ onGo }: { onGo?: () => void }) {
  const unread = useSocial((s) => s.unread)
  const member = useEntitlement()
  const signedOut = useSync((s) => s.ready && s.status === 'signed-out') && syncConfigured()
  const [profileOpen, setProfileOpen] = useState(false)
  const openOwn = useOpenOwnProfile(() => setProfileOpen(true))
  const [styleOpen, setStyleOpen] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const play: Item[] = [
    { href: '/game', label: 'Home', icon: House },
    { href: '/game/ladder', label: 'Venues', icon: MapIcon, also: ['/game/table'] },
    { href: '/game/rail', label: 'The Rail', icon: Sparkles },
    { href: '/game/side', label: 'Side Tables', icon: Layers, also: ['/game/blackjack'] },
    ...(roomsConfigured()
      ? [{ href: '/game/multiplayer', label: 'Multiplayer', icon: Wifi, also: ['/game/room'] }]
      : []),
  ]
  const people: Item[] = [
    ...(socialEnabled()
      ? [
          {
            href: '/game/friends',
            label: 'Friends',
            icon: Users,
            also: ['/game/player'],
            badge: unread,
          },
        ]
      : []),
    ...(ratingEnabled() ? [{ href: '/game/leaderboard', label: 'Leaderboard', icon: Trophy }] : []),
  ]
  const better: Item[] = [
    { href: '/game/drills', label: 'Drills', icon: Dumbbell },
    { href: '/game/learn', label: 'Learn with Webb', icon: GraduationCap, also: ['/game/lessons'] },
    { href: '/stats', label: 'Your stats', icon: BarChart3 },
  ]

  return (
    // In the phone drawer the whole list scrolls as one, so nothing hides under
    // a pinned footer; on a desktop the footer stays put and the places scroll.
    <div className="-mx-1 flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-1 lg:mx-0 lg:overflow-visible lg:px-0">
      <Who
        onOpen={() => {
          openOwn()
          onGo?.()
        }}
        roomRight={Boolean(onGo)}
      />
      {signedOut && (
        <button
          type="button"
          onClick={() => {
            sound.play('tap')
            setAccountOpen(true)
          }}
          className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/85 active:scale-[0.98]"
        >
          <UserPlus className="size-4" /> Create a free account
        </button>
      )}
      {/* A small heading over each group, as a sidebar on a Mac has: space
          alone between groups did not read as a break. */}
      <nav className="flex shrink-0 flex-col gap-3.5 lg:-mx-1 lg:min-h-0 lg:flex-1 lg:shrink lg:overflow-y-auto lg:px-1">
        {(
          [
            ['Play', play],
            ['People', people],
            ['Learn', better],
          ] as const
        )
          .filter(([, items]) => items.length > 0)
          .map(([heading, items]) => (
            <section key={heading} className="flex flex-col gap-0.5">
              <h2 className="px-3 pb-0.5 text-2xs font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
                {heading}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} onGo={onGo} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </nav>
      <div className="flex flex-col gap-0.5 border-t border-foreground/[0.07] pt-3">
        <Action icon={ShoppingBag} label="Pearl’s counter" onClick={() => setShopOpen(true)} />
        <Action icon={Palette} label="Style" onClick={() => setStyleOpen(true)} />
        {!member && (
          <NavLink item={{ href: '/membership', label: 'Membership', icon: Crown }} onGo={onGo} />
        )}
        <NavLink item={{ href: '/settings', label: 'Settings', icon: Settings }} onGo={onGo} />
      </div>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <StyleDialog open={styleOpen} onOpenChange={setStyleOpen} />
      <ShopDialog open={shopOpen} onOpenChange={setShopOpen} />
      <AccountDialog open={accountOpen} mode="signup" onOpenChange={setAccountOpen} />
    </div>
  )
}

/** Desktop menu screens: always there, at the left. */
export function DesktopSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-foreground/[0.07] bg-foreground/[0.015] px-3 pt-5 pb-3 lg:flex">
      <SidebarBody />
    </aside>
  )
}

/** Phones and narrow windows: slides in from the left. */
export function SidebarDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay
          forceRender
          className="bg-background/60 duration-300 data-closed:duration-200 data-closed:fill-mode-forwards"
        />
        <DialogPrimitive.Popup
          aria-label="Menu"
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100%-3rem))] flex-col bg-popover text-popover-foreground ring-1 ring-foreground/10 outline-none',
            'pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] px-3',
            'shadow-[24px_0_60px_-20px_rgba(0,0,0,0.6)] rounded-r-[1.75rem]',
            'duration-300 ease-out data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left data-closed:duration-200 data-closed:fill-mode-forwards',
          )}
        >
          <DialogPrimitive.Close
            aria-label="Close menu"
            className="absolute top-[max(1.25rem,env(safe-area-inset-top))] right-3 z-10 rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
          <SidebarBody onGo={() => onOpenChange(false)} />
        </DialogPrimitive.Popup>
      </DialogPortal>
    </DialogPrimitive.Root>
  )
}
