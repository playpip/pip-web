'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronRight, Lock, Moon, MoonStar, Store, Sun, Sunrise } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { CountUp } from '@/components/CountUp'
import { PageShell } from '@/components/PageShell'
import { useProfile } from '@/store/profile'
import type { RollPoint } from '@/store/profile'
import { ShopDialog } from './ShopDialog'
import { CategoryArt } from './CategoryArt'
import { RollSparkline } from './RollSparkline'
import { VenueInfoDialog } from './VenueInfoDialog'
import {
  VENUES,
  SIDE_TABLES,
  RING_TABLES,
  KITCHEN_TABLE,
  THE_DAILY,
  freerollOpen,
} from '@/config/venues'
import { dailyDateKey, dailyNumber, dailyShareText, ordinal } from '@/lib/daily'
import { characterById } from '@/config/cast'
import { accentFromSwatch } from '@/lib/avatar'
import { useMoney } from '@/lib/useMoney'
import { greetingFor, periodFor, type DayPeriod } from '@/lib/timeOfDay'
import { useHydrated } from '@/lib/useHydrated'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/** The sky outside, in one small glyph — a moon for the evening, and so on. */
const PERIOD_ICONS: Record<DayPeriod, LucideIcon> = {
  late: MoonStar,
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
}

export function Home() {
  const router = useRouter()
  const { name, roll, avatar, rollHistory } = useProfile()
  const money = useMoney()
  const [shopOpen, setShopOpen] = useState(false)

  const broke = freerollOpen(roll)
  // Clock-derived copy renders client-side only (SSR has no local hour).
  const hydrated = useHydrated()
  const hour = hydrated ? new Date().getHours() : 12
  // The player's own colour — worn by the ambient backdrop and the sparkline.
  const accent = avatar ? accentFromSwatch(avatar.backgroundColor) : 'var(--color-pip)'
  const todayDelta = hydrated ? rollToday(rollHistory, roll) : 0

  const go = (href: string) => {
    sound.play('tap')
    router.push(href)
  }

  return (
    <PageShell leading="profile">
      {/* the Roll — compact balance, quietly alive */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start py-10 text-left"
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
        {hydrated && rollHistory.length >= 2 && (
          <div className="mt-3 flex items-center gap-3">
            <RollSparkline points={rollHistory} accent={accent} className="h-7 w-28" />
            {todayDelta !== 0 && (
              <span
                className={cn(
                  'text-sm font-medium tabular-nums',
                  todayDelta > 0 ? 'text-emerald-500' : 'text-suit-red',
                )}
              >
                {todayDelta > 0 ? '+' : '−'}
                {money(Math.abs(todayDelta))} today
              </span>
            )}
          </div>
        )}
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

      {/* the main menu — Pearl's shop up top, then one tap into each corner */}
      <div className="flex flex-1 flex-col gap-4 pb-2">
        <ShopCard
          onOpen={() => {
            sound.play('tap')
            setShopOpen(true)
          }}
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {hydrated && <DailyTile roll={roll} delay={0} />}
          <CategoryCard
            art="rail"
            accent="#4FB477"
            title="The Rail"
            subtitle={`Cash · from ${money(RING_TABLES[0].buyIn)}`}
            onClick={() => go('/game/rail')}
            delay={0.05}
          />
          <CategoryCard
            art="venues"
            accent="#E0A458"
            title="Venues"
            subtitle={`${VENUES.length} rungs · from ${money(VENUES[0].buyIn)}`}
            onClick={() => go('/game/ladder')}
            delay={0.1}
          />
          <CategoryCard
            art="side"
            accent="#E06D8C"
            title="Side Tables"
            subtitle={`${SIDE_TABLES.length} formats`}
            onClick={() => go('/game/side')}
            delay={0.15}
          />
        </div>

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

      <ShopDialog open={shopOpen} onOpenChange={setShopOpen} />
    </PageShell>
  )
}

/** Net change in the Roll since the start of the local day, from the history. */
function rollToday(history: RollPoint[], roll: number): number {
  if (history.length === 0) return 0
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const t0 = start.getTime()
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].t < t0) return roll - history[i].roll
  }
  // No sample from before today — measure from the oldest we have.
  return roll - history[0].roll
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
 * A main-menu tile: a flat-geometric art panel over a title and hint. Taps into
 * one corner of the game. When `locked` it dims the label and shows a padlock in
 * the art corner, so it never reads as a dead button.
 */
function CategoryCard({
  art,
  accent,
  title,
  badge,
  subtitle,
  onClick,
  locked = false,
  delay = 0,
}: {
  art: string
  accent: string
  title: string
  badge?: string
  subtitle: string
  onClick: () => void
  locked?: boolean
  delay?: number
}) {
  return (
    // The rise animates a plain wrapper, not the card itself: animating
    // opacity/transform on an element that also clips (overflow-hidden +
    // rounded) makes iOS WebKit re-rasterise the rounded mask each frame and
    // flicker. Keeping the clipped card a static child sidesteps it — the same
    // structure the venue tiles use.
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <button
        onClick={onClick}
        className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-left transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]"
      >
        <div className="relative aspect-[16/10] w-full">
          <CategoryArt id={art} accent={accent} className="absolute inset-0 size-full" />
          <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-black/40 backdrop-blur-sm">
            {locked ? (
              <Lock className="size-3.5 text-white/85" />
            ) : (
              <ChevronRight className="size-4 text-white/85 transition group-hover:translate-x-0.5" />
            )}
          </span>
        </div>
        <div className={cn('p-3 md:p-4', locked && 'opacity-60')}>
          <h3 className="flex items-center gap-1.5 font-semibold">
            {title}
            {badge && (
              <span className="text-xs font-medium tabular-nums text-muted-foreground/70">
                {badge}
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </button>
    </motion.div>
  )
}

/**
 * The Daily as a menu tile — reflects today's state. Unplayed and affordable:
 * tap to play. Played: tap copies the calm share line. Can't afford the buy-in:
 * a clear locked tile (the Daily costs a real buy-in — there's no free daily).
 */
function DailyTile({ roll, delay }: { roll: number; delay: number }) {
  const router = useRouter()
  const money = useMoney()
  const daily = useProfile((s) => s.daily)
  const [copied, setCopied] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  const today = dailyDateKey()
  const dayNo = dailyNumber(today)
  const playedToday = daily?.date === today
  const affordable = roll >= THE_DAILY.buyIn
  const locked = !playedToday && !affordable

  const subtitle = copied
    ? 'Copied'
    : playedToday
      ? daily?.place
        ? daily.place === 1
          ? 'Won it today'
          : `Finished ${ordinal(daily.place)} of ${THE_DAILY.seats}`
        : 'Played today'
      : affordable
        ? 'Same cards for everyone'
        : `Need ${money(THE_DAILY.buyIn)} to play`

  // Played: tap copies the share line. Otherwise: open the details dialog (the
  // same one the venues use), where playing is a deliberate second tap.
  const onClick = () => {
    if (playedToday) {
      if (!daily?.place) return
      sound.play('tap')
      void navigator.clipboard
        ?.writeText(dailyShareText(daily.dayNo, daily.place, THE_DAILY.seats, daily.hands))
        .then(() => setCopied(true))
      return
    }
    sound.play('tap')
    setInfoOpen(true)
  }

  return (
    <>
      <CategoryCard
        art="daily"
        accent={THE_DAILY.accent}
        title="The Daily"
        badge={`#${dayNo}`}
        subtitle={subtitle}
        onClick={onClick}
        locked={locked}
        delay={delay}
      />
      <VenueInfoDialog
        venue={infoOpen ? THE_DAILY : null}
        playable={affordable}
        onOpenChange={(o) => !o && setInfoOpen(false)}
        onPlay={(venue) => {
          sound.play('call')
          router.push(`/play/${venue.id}`)
        }}
      />
    </>
  )
}

/**
 * The Chip Shop's storefront — a full-width band under the grid, with Pearl in
 * the window. Same quiet card language as everything else on the menu.
 */
function ShopCard({ onOpen }: { onOpen: () => void }) {
  const pearl = characterById('pearl')
  return (
    // Same as the tiles: animate the wrapper, keep the rounded card static so
    // iOS doesn't re-rasterise (and flicker) its rounded mask each frame.
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.35, ease: 'easeOut' }}
    >
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
    </motion.div>
  )
}
