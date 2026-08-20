'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { BookOpen, Moon, MoonStar, Play, Store, Sun, Sunrise, Target } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { CountUp } from '@/components/CountUp'
import { PageShell } from '@/components/PageShell'
import { useProfile } from '@/store/profile'
import type { RollPoint } from '@/store/profile'
import { ShopDialog } from './ShopDialog'
import { ChallengeCard } from './ChallengeCard'
import { CategoryCard } from './CategoryCard'
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
import { currentChallenge } from '@/lib/challenge'
import { characterById } from '@/config/cast'
import { accentFromSwatch } from '@/lib/avatar'
import { useMoney } from '@/lib/useMoney'
import { greetingFor, periodFor, type DayPeriod } from '@/lib/timeOfDay'
import { useHydrated } from '@/lib/useHydrated'
import { useCopied } from '@/lib/useCopied'
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
  const { name, roll, avatar, rollHistory, venueRecords, challengeWins, challengesPlayed } =
    useProfile()
  const money = useMoney()
  const [shopOpen, setShopOpen] = useState(false)
  // The two faces on the shelf. Pearl keeps the shop; Webb keeps Learn, being
  // the one in the cast who "wrote the book", so his face is the least
  // arbitrary icon available for it.
  const pearl = characterById('pearl')
  const webb = characterById('webb')

  const broke = freerollOpen(roll)
  // Clock-derived copy renders client-side only (SSR has no local hour).
  const hydrated = useHydrated()
  // Who is waiting, derived here rather than inside the tile: the grid has to
  // know whether there is a fifth tile before it can pick its column count.
  // Client-only for the same reason the Daily is — it comes from the persisted
  // profile, which the prerender doesn't have, so the first client render has
  // to match the server's and produce the four-tile grid.
  const challenge = hydrated
    ? currentChallenge({ roll, venueRecords, challengeWins, challengesPlayed })
    : null
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

      {/* the main menu — one tap into each corner, plus the three side rooms */}
      <div className="flex flex-1 flex-col gap-4 pb-2">
        {/* The tables come first, and that is the whole hierarchy of this
            screen: this is a poker app, so the places you sit down sit directly
            under the Roll. They used to sit under the shop, Learn and the
            drills, and three full-width bands on a phone pushed them off the
            bottom of it (Will, 14 Aug: "the venue and play cards get lost").
            The challenger leads the row: a challenge is a table you sit at like
            any other, and it is the one tile whose contents change on their
            own. The row widens to hold it instead of stranding a fifth tile on
            a row of its own. */}
        <div
          className={cn(
            'grid grid-cols-2 gap-3 md:gap-4',
            challenge ? 'md:grid-cols-5' : 'md:grid-cols-4',
          )}
        >
          {challenge && <ChallengeCard challenge={challenge} delay={0.05} />}
          {hydrated && <DailyTile roll={roll} delay={0.1} />}
          <CategoryCard
            art="rail"
            accent="#4FB477"
            title="The Rail"
            subtitle={`Cash · from ${money(RING_TABLES[0].buyIn)}`}
            onClick={() => go('/game/rail')}
            delay={0.15}
          />
          <CategoryCard
            art="venues"
            accent="#E0A458"
            title="Venues"
            subtitle={`${VENUES.length} rungs · from ${money(VENUES[0].buyIn)}`}
            onClick={() => go('/game/ladder')}
            delay={0.2}
          />
          <CategoryCard
            art="side"
            accent="#E06D8C"
            title="Side Tables"
            subtitle={`${SIDE_TABLES.length} formats`}
            onClick={() => go('/game/side')}
            delay={0.25}
          />
        </div>

        {/* The three side rooms: the shop, Learn and the drills are places you
            step out of a hand into, so they belong under the tables and they
            read as a shelf. Three across at every width — on a phone that is
            one row of faces rather than three bands, which is what keeps them
            from competing with the tables. */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <RoomCard
            title="Pearl’s counter"
            blurb="Card backs, deck faces, souvenirs — style, never edge."
            verb="Browse"
            icon={Store}
            face={pearl && <PlayerAvatar spec={pearl.avatar} size={44} />}
            onClick={() => {
              sound.play('tap')
              setShopOpen(true)
            }}
            delay={0.3}
          />
          <RoomCard
            title="Learn with Webb"
            blurb="A three-minute tour, plus written guides."
            verb="Open"
            icon={BookOpen}
            face={webb && <PlayerAvatar spec={webb.avatar} size={44} />}
            href="/learn"
            delay={0.34}
          />
          <RoomCard
            title="Drills"
            blurb="Short spots with a right answer."
            verb="Play"
            icon={Play}
            // No face on this one: the shop is Pearl's and Learn is Webb's, and
            // a drill is nobody's.
            face={<Target className="size-5 text-muted-foreground md:size-6" />}
            href="/game/drills"
            delay={0.38}
          />
        </div>
      </div>

      <ShopDialog open={shopOpen} onOpenChange={setShopOpen} />
    </PageShell>
  )
}

/**
 * One of the three side rooms: the shop, Learn, the drills. A link or a button,
 * depending on whether the room is a screen or a dialog.
 *
 * **Two shapes, one card, and the narrow one is the point.** Below md it is a
 * face over a label, three across in a single row; from md there is width for
 * the sentence and the verb and it is the wide card it always was. These were
 * three full-width bands at every size, which on a phone is most of the screen
 * spent on the places you are not playing (Will, 14 Aug).
 */
function RoomCard({
  title,
  blurb,
  verb,
  icon: Icon,
  face,
  href,
  onClick,
  delay = 0,
}: {
  title: string
  blurb: string
  verb: string
  icon: LucideIcon
  face: React.ReactNode
  href?: string
  onClick?: () => void
  delay?: number
}) {
  const className =
    'group flex h-full w-full flex-col items-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3 text-center transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99] md:flex-row md:gap-4 md:text-left'

  const body = (
    <>
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-foreground/[0.04] md:size-14">
        {face}
      </span>
      <span className="min-w-0 md:flex-1">
        <span className="block text-xs font-medium leading-tight md:text-base md:leading-normal">
          {title}
        </span>
        {/* Desktop only: at a third of a phone this line either truncates
            mid-word or doubles the height of the shelf. */}
        <span className="hidden truncate text-sm text-muted-foreground md:block">{blurb}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-foreground/[0.06] px-4 py-2.5 text-sm font-medium transition group-hover:bg-foreground/[0.12] md:flex">
        <Icon className="size-4" />
        {verb}
      </span>
    </>
  )

  return (
    // Animate the wrapper, keep the rounded card static: animating a clipped,
    // rounded element makes iOS WebKit re-rasterise its mask each frame.
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
    >
      {href ? (
        <Link href={href} onClick={() => sound.play('tap')} className={className}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={className}>
          {body}
        </button>
      )}
    </motion.div>
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
 * The Daily as a menu tile — reflects today's state. Unplayed and affordable:
 * tap to play. Played: tap copies the calm share line. Can't afford the buy-in:
 * a clear locked tile (the Daily costs a real buy-in — there's no free daily).
 */
function DailyTile({ roll, delay }: { roll: number; delay: number }) {
  const router = useRouter()
  const money = useMoney()
  const daily = useProfile((s) => s.daily)
  // Worst of the three #20 sites: 'Copied' sat in place of the finishing
  // position for the rest of the session, so a tile that had real information
  // on it lost it to a confirmation.
  const [copied, copy] = useCopied()
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
        .then(() => copy())
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
