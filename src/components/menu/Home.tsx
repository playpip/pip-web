'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Lock,
  ChevronRight,
  ChevronLeft,
  Info,
  Moon,
  MoonStar,
  Palette,
  RotateCcw,
  Settings,
  Store,
  Sun,
  Sunrise,
} from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { CountUp } from '@/components/CountUp'
import { useProfile } from '@/store/profile'
import { ProfileDialog } from '@/components/profile/ProfileDialog'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { StyleDialog } from '@/components/settings/StyleDialog'
import { ShopDialog } from './ShopDialog'
import { ThemeToggle } from '@/components/ThemeToggle'
import { VenueArt } from './VenueArt'
import { VenueInfoDialog } from './VenueInfoDialog'
import {
  VENUES,
  SIDE_TABLES,
  KITCHEN_TABLE,
  THE_DAILY,
  FORMAT_LABELS,
  freerollOpen,
  type Venue,
} from '@/config/venues'
import { dailyDateKey, dailyNumber, dailyShareText, ordinal } from '@/lib/daily'
import { rankFor } from '@/config/ranks'
import { characterById } from '@/config/cast'
import { useMoney } from '@/lib/useMoney'
import { greetingFor, kitchenHintFor, periodFor, type DayPeriod } from '@/lib/timeOfDay'
import { useHydrated } from '@/lib/useHydrated'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/** The sky outside, in one small glyph — a moon for the evening, and so on. */
const PERIOD_ICONS: Record<DayPeriod, typeof Moon> = {
  late: MoonStar,
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
}

interface VenueVM {
  venue: Venue
  index: number
  /** Ladder rung number; side tables have none. */
  tier?: number
  playable: boolean
  onEnter: () => void
  onInfo: () => void
}

export function Home() {
  const router = useRouter()
  const { name, avatar, roll, peakRoll, reset } = useProfile()
  const money = useMoney()
  const [editOpen, setEditOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  const [infoVenue, setInfoVenue] = useState<Venue | null>(null)

  const rank = rankFor(peakRoll)
  const broke = freerollOpen(roll)
  // Clock-derived copy renders client-side only (SSR has no local hour).
  const hydrated = useHydrated()
  const hour = hydrated ? new Date().getHours() : 12

  const modelsFor = (venues: readonly Venue[], tiered: boolean): VenueVM[] =>
    venues.map((venue, index) => ({
      venue,
      index,
      tier: tiered ? index + 1 : undefined,
      playable: roll >= venue.buyIn,
      onEnter: () => {
        sound.play('call')
        router.push(`/play/${venue.id}`)
      },
      onInfo: () => {
        sound.play('tap')
        setInfoVenue(venue)
      },
    }))

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-6 py-8 md:px-10">
      {/* top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            sound.play('tap')
            setEditOpen(true)
          }}
          className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 transition hover:bg-foreground/5 active:scale-[0.98]"
          aria-label="Edit player"
        >
          {avatar && <PlayerAvatar spec={avatar} size={40} />}
          <div className="text-left leading-tight">
            <div className="text-sm font-medium text-muted-foreground">{name}</div>
            <div className="text-[11px] text-muted-foreground/70">{rank.name}</div>
          </div>
        </button>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xl font-semibold lowercase tracking-tight text-muted-foreground">
            pip
          </span>
          <ThemeToggle />
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
          <button
            onClick={() => {
              if (confirm('Reset your profile and Roll?')) reset()
            }}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
            aria-label="Reset profile"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
      </div>

      {/* the Roll — compact balance */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start py-12 text-left"
      >
        {/* the greeting IS the label — one line, so it reads as part of the Roll */}
        <p className="text-sm text-muted-foreground">
          {hydrated ? <GreetingLine hour={hour} name={name} /> : 'Your Roll'}
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <CountUp
            value={roll}
            format={money}
            className="text-4xl font-semibold tracking-tight tabular-nums md:text-5xl"
          />
          <span className="text-lg font-medium text-muted-foreground">chips</span>
        </div>
        {broke && (
          <button
            onClick={() => {
              sound.play('call')
              router.push(`/play/${KITCHEN_TABLE.id}`)
            }}
            className="mt-4 rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
          >
            Play the freeroll — win {money(KITCHEN_TABLE.prize)}
          </button>
        )}
      </motion.div>

      {/* the shelves */}
      <div className="flex flex-1 flex-col justify-center gap-8 pb-2">
        {hydrated && <DailyCard roll={roll} />}
        <ShopCard
          onOpen={() => {
            sound.play('tap')
            setShopOpen(true)
          }}
        />
        <VenueShelf
          title="The Ladder"
          hint={kitchenHintFor(hour)}
          models={modelsFor(VENUES, true)}
        />
        <VenueShelf
          title="Side Tables"
          hint="Same game, different pressure."
          models={modelsFor(SIDE_TABLES, false)}
          delay={0.1}
        />
        {/* the tour's quiet permanent entry — one line, no badge, no pulse */}
        <p className="pb-1 text-center text-xs text-muted-foreground/70">
          New to poker?{' '}
          <Link
            href="/learn"
            onClick={() => sound.play('tap')}
            className="underline underline-offset-2 transition hover:text-foreground"
          >
            Take the tour.
          </Link>
        </p>
      </div>

      <ProfileDialog open={editOpen} onOpenChange={setEditOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <StyleDialog open={styleOpen} onOpenChange={setStyleOpen} />
      <ShopDialog open={shopOpen} onOpenChange={setShopOpen} />
      <VenueInfoDialog venue={infoVenue} onOpenChange={(o) => !o && setInfoVenue(null)} />
    </div>
  )
}

/** "Evening, Will 🌙 — your Roll": the little sky-glyph follows the name. */
function GreetingLine({ hour, name }: { hour: number; name: string }) {
  const Icon = PERIOD_ICONS[periodFor(hour)]
  return (
    <>
      {greetingFor(hour)}, {name} <Icon className="mb-0.5 inline size-3.5" aria-hidden /> — your
      Roll
    </>
  )
}

/**
 * The Daily Deal — one seeded tournament a day, the same shuffle for everyone.
 * Play state: a quiet enter row. Played state: today's result and a copyable
 * share line. No streaks, no countdown — tomorrow is simply another deal.
 */
function DailyCard({ roll }: { roll: number }) {
  const router = useRouter()
  const money = useMoney()
  const daily = useProfile((s) => s.daily)
  const [copied, setCopied] = useState(false)

  const today = dailyDateKey()
  const dayNo = dailyNumber(today)
  const playedToday = daily?.date === today
  const playable = !playedToday && roll >= THE_DAILY.buyIn

  const share = () => {
    if (!daily) return
    sound.play('tap')
    void navigator.clipboard
      ?.writeText(dailyShareText(daily.dayNo, daily.place, THE_DAILY.seats, daily.hands))
      .then(() => setCopied(true))
  }

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-3 px-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          The Daily <span className="tabular-nums">#{dayNo}</span>
        </p>
      </div>
      <div className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3 pl-4">
        <div className="min-w-0 flex-1">
          <span className="font-medium">{THE_DAILY.name}</span>
          <p className="truncate text-sm text-muted-foreground">
            {playedToday
              ? daily?.place
                ? daily.place === 1
                  ? `Won it · ${daily.hands} hands`
                  : `Finished ${ordinal(daily.place)} of ${THE_DAILY.seats} · ${daily.hands} hands`
                : 'Played today. Back tomorrow.'
              : THE_DAILY.tagline}
          </p>
        </div>
        {playedToday ? (
          daily?.place != null && (
            <button
              onClick={share}
              className="shrink-0 rounded-xl bg-foreground/[0.06] px-4 py-2.5 text-sm font-medium transition hover:bg-foreground/[0.12]"
            >
              {copied ? 'Copied' : 'Share'}
            </button>
          )
        ) : playable ? (
          <button
            onClick={() => {
              sound.play('call')
              router.push(`/play/${THE_DAILY.id}`)
            }}
            className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
          >
            Play — {money(THE_DAILY.buyIn)}
          </button>
        ) : (
          <LockTag venue={THE_DAILY} />
        )}
      </div>
    </motion.section>
  )
}

/** A titled, horizontally-snapping row of venues (vertical list on mobile). */
function VenueShelf({
  title,
  hint,
  models,
  delay = 0,
}: {
  title: string
  hint?: string
  models: VenueVM[]
  delay?: number
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const scrollBy = (dir: number) =>
    scroller.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
        <div className="flex items-center gap-3">
          {hint && <p className="hidden text-xs text-muted-foreground sm:block">{hint}</p>}
          <div className="hidden gap-1.5 md:flex">
            <ArrowButton dir="left" onClick={() => scrollBy(-1)} />
            <ArrowButton dir="right" onClick={() => scrollBy(1)} />
          </div>
        </div>
      </div>

      {/* desktop: horizontal slider */}
      <div
        ref={scroller}
        className="hidden gap-4 overflow-x-auto scroll-smooth pb-2 md:flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {models.map((m) => (
          <VenueTile key={m.venue.id} model={m} />
        ))}
      </div>

      {/* mobile: vertical list */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {models.map((m) => (
          <VenueRow key={m.venue.id} model={m} />
        ))}
      </div>
    </motion.section>
  )
}

/**
 * The Chip Shop's storefront — its own full-width band under the shelves,
 * sibling to the Daily card, with Pearl in the window. Always visible, never
 * shouting: same quiet card language as everything else on the home screen.
 */
function ShopCard({ onOpen }: { onOpen: () => void }) {
  const pearl = characterById('pearl')
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
    >
      <div className="mb-3 px-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">The Chip Shop</p>
      </div>
      <button
        onClick={onOpen}
        className="group flex w-full items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3 text-left transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]"
      >
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-foreground/[0.04]">
          {pearl && <PlayerAvatar spec={pearl.avatar} size={44} />}
        </div>
        <div className="min-w-0 flex-1">
          <span className="font-medium">Pearl&rsquo;s counter</span>
          <p className="truncate text-sm text-muted-foreground">
            Card backs, deck faces, souvenirs — style, never edge.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-foreground/[0.06] px-4 py-2.5 text-sm font-medium transition group-hover:bg-foreground/[0.12]">
          <Store className="size-4" />
          Browse
        </span>
      </button>
    </motion.section>
  )
}

function ArrowButton({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'}
      className="flex size-8 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.03] text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground active:scale-90"
    >
      <Icon className="size-4" />
    </button>
  )
}

/** Corner badge: the ladder rung number, or the format tag on side tables. */
function CornerTag({ venue, tier }: { venue: Venue; tier?: number }) {
  if (tier !== undefined) {
    return (
      <span
        className="flex size-7 items-center justify-center rounded-md bg-black/45 text-xs font-semibold backdrop-blur-sm"
        style={{ color: venue.accent }}
      >
        {tier}
      </span>
    )
  }
  if (!venue.format) return null
  return (
    <span
      className="rounded-md bg-black/45 px-2 py-1 text-[11px] font-semibold backdrop-blur-sm"
      style={{ color: venue.accent }}
    >
      {FORMAT_LABELS[venue.format]}
    </span>
  )
}

function ArtThumb({ venue, className }: { venue: Venue; className?: string }) {
  return (
    <div className={cn('shrink-0 overflow-hidden rounded-lg', className)}>
      <VenueArt id={venue.id} accent={venue.accent} className="size-full" />
    </div>
  )
}

function LockTag({ venue }: { venue: Venue }) {
  const money = useMoney()
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Lock className="size-3" /> {money(venue.buyIn)}
    </span>
  )
}

function Stakes({ venue }: { venue: Venue }) {
  const money = useMoney()
  return (
    <div>
      <div className="text-base font-semibold tabular-nums">{money(venue.buyIn)}</div>
      <div className="text-[11px] text-muted-foreground tabular-nums">win {money(venue.prize)}</div>
    </div>
  )
}

/** Desktop slider card — vertical tile, fixed width, snap target. */
function VenueTile({ model }: { model: VenueVM }) {
  const { venue, index, tier, playable, onEnter, onInfo } = model
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="relative w-64 shrink-0 snap-start"
    >
      <button
        disabled={!playable}
        onClick={() => playable && onEnter()}
        className={cn(
          // h-full: the wrapper stretches with the shelf row, so every card in a
          // shelf matches the tallest regardless of tagline length.
          'group flex h-full w-full flex-col rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3 text-left transition',
          playable
            ? 'hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]'
            : 'opacity-45',
        )}
      >
        <div className="relative aspect-square overflow-hidden rounded-xl">
          <VenueArt id={venue.id} accent={venue.accent} className="size-full" />
          <div className="absolute left-2 top-2">
            <CornerTag venue={venue} tier={tier} />
          </div>
          {!playable && (
            <div className="absolute bottom-2 right-2 rounded-md bg-black/45 px-1.5 py-0.5 backdrop-blur-sm">
              <LockTag venue={venue} />
            </div>
          )}
        </div>
        <div className="mt-3 flex-1 px-1">
          <h3 className="font-semibold">{venue.name}</h3>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">{venue.tagline}</p>
        </div>
        <div className="mt-3 flex items-end justify-between px-1">
          <Stakes venue={venue} />
          <ChevronRight
            className={cn(
              'size-4 text-muted-foreground transition group-hover:translate-x-0.5',
              !playable && 'opacity-0',
            )}
          />
        </div>
      </button>
      {/* sibling, not nested — buttons can't contain buttons */}
      <button
        onClick={onInfo}
        aria-label={`About ${venue.name}`}
        className="absolute right-5 top-5 rounded-full bg-black/45 p-1.5 text-white/75 backdrop-blur-sm transition hover:text-white"
      >
        <Info className="size-3.5" />
      </button>
    </motion.div>
  )
}

/** Mobile list row — horizontal. */
function VenueRow({ model }: { model: VenueVM }) {
  const { venue, playable, onEnter, onInfo } = model
  return (
    <div className="relative">
      <button
        disabled={!playable}
        onClick={() => playable && onEnter()}
        className={cn(
          'group flex w-full items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3 pr-16 text-left transition',
          playable
            ? 'hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]'
            : 'opacity-45',
        )}
      >
        <ArtThumb venue={venue} className="size-14" />
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{venue.name}</span>
            {venue.format && (
              <span
                className="shrink-0 rounded bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ color: venue.accent }}
              >
                {FORMAT_LABELS[venue.format]}
              </span>
            )}
          </span>
          <p className="truncate text-sm text-muted-foreground">{venue.tagline}</p>
        </div>
        <div className="shrink-0 text-right">
          {playable ? <Stakes venue={venue} /> : <LockTag venue={venue} />}
        </div>
      </button>
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        <button
          onClick={onInfo}
          aria-label={`About ${venue.name}`}
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
        >
          <Info className="size-4" />
        </button>
        <ChevronRight className={cn('size-4 text-muted-foreground', !playable && 'opacity-0')} />
      </div>
    </div>
  )
}
