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
import { AccountOffer } from '@/components/settings/AccountOffer'
import { useProfile } from '@/store/profile'
import type { RollPoint } from '@/store/profile'
import { ShopDialog } from './ShopDialog'
import { ChallengeCard } from './ChallengeCard'
import { CategoryCard } from './CategoryCard'
import { LadderStrip } from './LadderStrip'
import { NextUpCard } from './NextUpCard'
import { QuickPlayCard } from './QuickPlayCard'
import { RollSparkline } from './RollSparkline'
import { VenueInfoDialog } from './VenueInfoDialog'
import { SIDE_SHELF, RING_TABLES, THE_DAILY } from '@/config/venues'
import { dailyDateKey, dailyNumber, dailyShareText, ordinal } from '@/lib/daily'
import { nextUp, quickPlay } from '@/lib/nextUp'
import { challengeOnOffer } from '@/lib/sitDown'
import { deviceId } from '@/lib/sync/client'
import { characterById } from '@/config/cast'
import { accentFromSwatch } from '@/lib/avatar'
import { useMoney } from '@/lib/useMoney'
import { greetingFor, periodFor, type DayPeriod } from '@/lib/timeOfDay'
import { useHydrated } from '@/lib/useHydrated'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
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
  // Clock-derived copy renders client-side only (SSR has no local hour).
  const hydrated = useHydrated()
  // Everything on this screen that opens a table is decided on the spendable
  // Roll and by the same functions the route uses (lib/sitDown, lib/nextUp): a
  // buy-in sitting on another device's table is not being broke, and it is not
  // a locked band. Client-only because `deviceId()` reads localStorage, which
  // the prerender does not have.
  const escrow = useProfile((s) => s.escrow)
  const sitDown = hydrated ? { roll, escrow, venueRecords, challengeWins, challengesPlayed } : null
  // The one table this screen leads with. Derived here rather than inside the
  // card because the shelf below has to know what won the hero slot — whatever
  // did is left off it, so the same face never appears twice down the page.
  const pick = sitDown ? nextUp(sitDown, deviceId()) : null
  // Somewhere to dip into for ten minutes, when the Roll can stand one.
  const quick = sitDown ? quickPlay(sitDown, deviceId()) : null
  // Who is waiting, derived here for the same reason.
  const challenge = sitDown ? challengeOnOffer(sitDown, deviceId()) : null
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
        {/* The freeroll used to be a button here, shown only when broke. It is
            now the first thing `nextUp` offers, so a player out of chips gets
            it as the hero rather than as a second, differently-shaped way in. */}
        {/* Under the Roll, because the Roll is the thing an account keeps.
            Signed out only, and it renders nothing until the stored session has
            been checked. */}
        <AccountOffer />
      </motion.div>

      {/* the main menu — one recommendation, the spine, the detours, the rooms */}
      <div className="flex flex-1 flex-col gap-4 pb-2">
        {/* The spine. Everything below this pair is optional and reads as
            optional, which is the whole point of the rearrangement (Will,
            2026-09-20): five identically sized tiles made the ladder — the
            game's actual progression — look like one of four alternatives, so
            a player had to evaluate all of them before sitting anywhere, and
            nothing on the screen ever said where they were. Now the app answers
            "what do I play" itself, and the ladder is a position rather than a
            door. */}
        <div className="flex min-h-20 flex-col gap-3 md:min-h-[8.75rem] md:gap-4">
          {/* Two questions, one row: what is next, and what if you have ten
              minutes. They are different axes — progress and time — which is
              the only reason a second card is allowed up here at all. A third
              would make this a tile grid again, which is the thing the whole
              screen was rearranged to stop being. The quick card is absent
              whenever there is no honest stake for it, and the hero simply
              takes the width back. */}
          <div className="flex flex-col gap-3 md:flex-row md:gap-4">
            {hydrated && pick && (
              <div className="min-w-0 flex-1">
                <NextUpCard pick={pick} delay={0.05} />
              </div>
            )}
            {hydrated && quick && (
              <div className="min-w-0 md:w-[38%]">
                <QuickPlayCard room={quick} delay={0.1} />
              </div>
            )}
          </div>
          <LadderStrip delay={0.15} />
        </div>

        {/* The detours: the same game somewhere else, picked by mood rather
            than by progress. Still 16:10 tiles and still one tap, but under a
            hero and a strip they read as the alternatives they are.

            **Four tiles, and the lobby does not grow one per feature.** The
            membership briefly added two, and six 16:10 tiles across made every
            table smaller — the opposite of what this row is for (Will,
            2026-09-19). Everything the membership adds is a format twist, so it
            lives on the side tables with the other format twists.

            **The Daily lives here and only here** (Will, 2026-09-20). It is a
            once-a-day novelty rather than a step up, so it never takes the hero
            slot — and this is where its state is worth reading anyway: played,
            placed, or priced out. The challenger is dropped from the row only
            on the rare turn it *is* the hero, because the same face twice down
            one screen reads as the app repeating itself. The grid keeps its
            column count either way, so the tiles never resize — a short row
            ends in a gap instead. */}
        <div>
          <h2 className="mb-2 px-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            Other ways to play
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <CategoryCard
              art="rail"
              accent="#4FB477"
              title="The Rail"
              subtitle={`Cash · from ${money(RING_TABLES[0].buyIn)}`}
              onClick={() => go('/game/rail')}
              delay={0.15}
            />
            <CategoryCard
              art="side"
              accent="#E06D8C"
              title="Side Tables"
              subtitle={`${SIDE_SHELF.length} ways to play`}
              onClick={() => go('/game/side')}
              delay={0.2}
            />
            {hydrated && <DailyTile delay={0.25} />}
            {challenge && pick?.kind !== 'challenge' && (
              <ChallengeCard challenge={challenge} delay={0.3} />
            )}
          </div>
        </div>

        {/* The three side rooms: the shop, Learn and the drills are places you
            step out of a hand into, so they belong under the tables and they
            read as a shelf. Three across at every width — on a phone that is
            one row of faces rather than three bands, which is what keeps them
            from competing with the tables. */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <RoomCard
            title="Pearl’s counter"
            blurb="Card backs, rings, buttons, sounds, souvenirs — style, never edge."
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
            blurb="Lessons at the table, a tour, and the guides."
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
function DailyTile({ delay }: { delay: number }) {
  const router = useRouter()
  const money = useMoney()
  const daily = useProfile((s) => s.daily)
  const spendable = useSpendableRoll()
  // Worst of the three #20 sites: 'Copied' sat in place of the finishing
  // position for the rest of the session, so a tile that had real information
  // on it lost it to a confirmation.
  const [copied, copy] = useCopied()
  const [infoOpen, setInfoOpen] = useState(false)

  const today = dailyDateKey()
  const dayNo = dailyNumber(today)
  const playedToday = daily?.date === today
  const affordable = spendable >= THE_DAILY.buyIn
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
