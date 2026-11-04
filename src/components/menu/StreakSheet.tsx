'use client'

// The streak sheet (Will, 2026-11-04: "I just want to see what i've had and
// what's coming up so I can see rewards i'm gonna get as well as my current
// streak"). Opened from the flame under the Roll (components/StreakBadge). It
// shows the rules in lib/dailyReward and lib/streak and changes none of them.
//
// Three things: the streak, big; then one timeline, oldest at the top, with
// the days already had, today, and the days still to come.
//
// **What is known about the past.** Only the run's length and its last day
// are stored (`profile.streak`), and the last claim (`profile.dailyReward`).
// So each past day's chips are worked out from the rules at today's table, and
// an unlock is ticked only if it is in `owned`. Days at the top rate are one
// row, so a long streak stays short.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { Check, Flame } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { trackOnce } from '@/lib/analytics'
import {
  LADDER,
  MILESTONES,
  claimDay,
  claimable,
  rewardFor,
  yourTable,
  type Reward,
} from '@/lib/dailyReward'
import { dailyDateKey } from '@/lib/daily'
import { emptyStreak, liveStreak } from '@/lib/streak'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'
import { Coin, RewardArt } from './RewardArt'

const SPRING = { type: 'spring', stiffness: 380, damping: 26 } as const

/** How many days after today get a row of their own. */
const AHEAD = 5

/** How much of what comes after today the sheet opens showing, in pixels. */
const SHOW_AFTER_TODAY = 110

/** The UTC day key `n` days after `key` (negative for before). */
function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function dateLabel(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

type When = 'had' | 'today' | 'coming'

/** One row of the timeline: a single day, or a run of days that pay the same. */
type Row =
  | { kind: 'day'; when: When; reward: Reward; key: string; offset: number }
  | { kind: 'run'; when: When; from: number; to: number; chips: number }

/**
 * The timeline for a streak whose today lands on `todayDay`. Days 1 to 6 each
 * pay something different, so they each get a row; from day 7 the chips hold,
 * so plain days had between unlocks are one row.
 */
function timeline(todayDay: number, buyIn: number, member: boolean, today: string): Row[] {
  const rows: Row[] = []
  const day = (d: number, when: When) =>
    rows.push({
      kind: 'day',
      when,
      reward: rewardFor(d, buyIn, member),
      key: addDays(today, d - todayDay),
      offset: d - todayDay,
    })
  const run = (from: number, to: number, when: When) => {
    if (to < from) return
    if (from === to) return day(from, when)
    rows.push({ kind: 'run', when, from, to, chips: rewardFor(from, buyIn, member).chips })
  }
  const flat = LADDER.length
  const isUnlock = (d: number) => MILESTONES.some((m) => m.day === d)

  // Had: day 1 up to yesterday.
  let start = 1
  for (let d = 1; d < todayDay; d++) {
    if (d < flat || isUnlock(d)) {
      run(start, d - 1, 'had')
      day(d, 'had')
      start = d + 1
    }
  }
  run(start, todayDay - 1, 'had')

  day(todayDay, 'today')

  // Coming: the next few days each, then every unlock still ahead. By then
  // the chips have held for a while, so the days between need no rows.
  const near = todayDay + AHEAD
  for (let d = todayDay + 1; d <= near; d++) day(d, 'coming')
  for (const m of MILESTONES) if (m.day > near) day(m.day, 'coming')
  return rows
}

export function StreakSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Like an iOS large title: once the big streak scrolls away, the title row
  // takes it over, so the streak is always in sight.
  const [heroGone, setHeroGone] = useState(false)
  const streak = useProfile((s) => s.streak)
  const run = streak ? liveStreak(streak, dailyDateKey()) : 0
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        onClose={() => onOpenChange(false)}
        title={
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={heroGone ? 'run' : 'name'}
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {heroGone && <Flame className={flameClass(run, 'size-5')} aria-hidden />}
              <span className="tabular-nums">{heroGone ? runLabel(run) : 'Streak'}</span>
            </motion.span>
          </AnimatePresence>
        }
      >
        <Body onHero={setHeroGone} />
      </SheetContent>
    </Sheet>
  )
}

function runLabel(run: number): string {
  return run > 0 ? `${run} ${run === 1 ? 'day' : 'days'}` : 'No streak yet'
}

function flameClass(run: number, size: string): string {
  return cn(size, run > 0 ? 'fill-streak/35 text-streak' : 'text-streak/60')
}

function Body({ onHero }: { onHero: (gone: boolean) => void }) {
  const member = useEntitlement()
  const streak = useProfile((s) => s.streak) ?? emptyStreak()
  const record = useProfile((s) => s.dailyReward)
  const owned = useProfile((s) => s.owned)
  const buyIn = yourTable(useProfile((s) => s.venueRecords)).buyIn
  const todayRef = useRef<HTMLLIElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => trackOnce('streak-sheet-opened'), [])
  // Open with today and the next day or two in sight, scrolling no further
  // than that, so the streak at the top stays up when it can.
  useEffect(() => {
    const row = todayRef.current
    const box = row?.closest<HTMLElement>('.overflow-y-auto')
    if (!row || !box) return
    const bottom = row.getBoundingClientRect().bottom - box.getBoundingClientRect().top
    const over = bottom + SHOW_AFTER_TODAY - box.clientHeight
    if (over > 0) box.scrollTop = over
  }, [])
  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const watch = new IntersectionObserver(([entry]) => onHero(!entry.isIntersecting), {
      root: hero.closest('.overflow-y-auto'),
      threshold: 0.35,
    })
    watch.observe(hero)
    return () => watch.disconnect()
  }, [onHero])

  const today = dailyDateKey()
  const run = liveStreak(streak, today)
  const todayDay = claimDay(streak, today)
  const claimed = !claimable(record, today)
  const rows = timeline(todayDay, buyIn, member, today)

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col pb-1">
        {/* --- the streak -------------------------------------------------- */}
        <div ref={heroRef} className="relative flex flex-col items-center pt-1 pb-6 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-4 h-40"
            style={{
              background:
                'radial-gradient(45% 55% at 50% 40%, color-mix(in oklab, var(--color-streak) 26%, transparent), transparent 75%)',
            }}
          />
          <motion.span
            className="relative"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Flame
              className={cn(
                flameClass(run, 'size-16'),
                run > 0 && 'drop-shadow-[0_6px_18px_rgba(255,138,61,0.45)]',
              )}
              aria-hidden
            />
          </motion.span>
          <p className="relative mt-2 text-4xl font-semibold tracking-tight tabular-nums">
            {runLabel(run)}
          </p>
        </div>

        {/* --- had, today, coming ----------------------------------------- */}
        <ol aria-label="Streak rewards" className="flex flex-col">
          {rows.map((row, i) => (
            <TimelineRow
              key={row.kind === 'day' ? row.reward.streakDay : `${row.from}-${row.to}`}
              row={row}
              first={i === 0}
              last={i === rows.length - 1}
              nextWhen={rows[i + 1]?.when}
              owned={
                row.kind === 'day' && !!row.reward.unlock && owned.includes(row.reward.unlock.id)
              }
              claimed={claimed}
              index={i}
              ref={row.when === 'today' ? todayRef : undefined}
            />
          ))}
        </ol>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Miss a day and it starts again.
        </p>
      </div>
    </MotionConfig>
  )
}

function TimelineRow({
  row,
  first,
  last,
  nextWhen,
  owned,
  claimed,
  index,
  ref,
}: {
  row: Row
  first: boolean
  last: boolean
  nextWhen: When | undefined
  owned: boolean
  claimed: boolean
  index: number
  ref?: React.Ref<HTMLLIElement>
}) {
  const money = useMoney()
  const { when } = row
  const unlock = row.kind === 'day' ? row.reward.unlock : null
  const isToday = when === 'today'
  const had = when === 'had'

  const tomorrow = row.kind === 'day' && row.offset === 1
  const title =
    row.kind === 'run'
      ? `Days ${row.from} to ${row.to}`
      : isToday
        ? 'Today'
        : unlock
          ? unlock.name
          : tomorrow
            ? 'Tomorrow'
            : `Day ${row.reward.streakDay}`

  const sub =
    row.kind === 'run'
      ? `${row.to - row.from + 1} days`
      : [
          isToday || unlock || tomorrow ? `Day ${row.reward.streakDay}` : null,
          isToday && unlock ? unlock.name : null,
          isToday
            ? claimed
              ? 'Claimed'
              : 'Not claimed yet'
            : had
              ? dateLabel(row.key)
              : unlock && tomorrow
                ? 'Tomorrow'
                : tomorrow
                  ? null
                  : `in ${row.offset} days`,
          unlock && when === 'coming' && owned ? 'Already yours' : null,
        ]
          .filter(Boolean)
          .join(' · ')

  const chips = row.kind === 'run' ? row.chips : row.reward.chips

  // The rail: solid through the days had, dashed through the days to come.
  const above = had || isToday
  const below = nextWhen === 'had' || (isToday ? false : nextWhen === 'today')

  return (
    <motion.li
      ref={ref}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: Math.min(index, 12) * 0.025 }}
      className={cn(
        'relative flex items-center gap-3 rounded-2xl py-1.5 pr-3 pl-1',
        isToday && 'my-1.5 py-2.5 ring-1 ring-streak/45',
      )}
      style={
        isToday
          ? {
              background:
                'linear-gradient(115deg, color-mix(in oklab, var(--color-streak) 16%, var(--color-card)), color-mix(in oklab, var(--color-streak) 4%, var(--color-card)) 70%)',
            }
          : undefined
      }
    >
      {/* the rail, above and below this row's node */}
      {!first && (
        <span
          aria-hidden
          className={cn(
            'absolute top-0 left-[1.6rem] h-1/2 -translate-x-1/2',
            above ? 'w-0.5 bg-streak/55' : 'border-l-2 border-dashed border-foreground/15',
            isToday && '-top-1.5 h-[calc(50%+0.375rem)]',
          )}
        />
      )}
      {!last && (
        <span
          aria-hidden
          className={cn(
            'absolute bottom-0 left-[1.6rem] h-1/2 -translate-x-1/2',
            below ? 'w-0.5 bg-streak/55' : 'border-l-2 border-dashed border-foreground/15',
            isToday && '-bottom-1.5 h-[calc(50%+0.375rem)]',
          )}
        />
      )}

      <span className="relative z-10 grid w-12 shrink-0 place-items-center">
        <Node row={row} owned={owned} claimed={claimed} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate font-semibold',
            isToday ? 'text-base' : 'text-sm',
            had && 'text-foreground/70',
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            'block truncate text-xs',
            isToday ? 'font-medium text-streak' : 'text-muted-foreground',
          )}
        >
          {sub}
        </span>
      </span>

      <span
        className={cn(
          'flex shrink-0 items-center gap-1.5 text-right tabular-nums',
          had && 'opacity-70',
        )}
      >
        <span className="flex flex-col items-end">
          <span
            className={cn(
              'font-semibold tracking-tight whitespace-nowrap',
              isToday ? 'text-lg' : 'text-sm',
            )}
          >
            {money(chips)}
          </span>
          <span className="text-2xs text-muted-foreground whitespace-nowrap">
            {row.kind === 'run' ? 'chips a day' : 'chips'}
          </span>
        </span>
        <Coin size={isToday ? 22 : 16} />
      </span>
    </motion.li>
  )
}

/** The mark on the rail: a lit flame for a day had, the item art for an unlock. */
function Node({ row, owned, claimed }: { row: Row; owned: boolean; claimed: boolean }) {
  const { when } = row
  const unlock = row.kind === 'day' ? row.reward.unlock : null

  if (unlock) {
    return (
      <span
        className={cn(
          'relative grid size-12 place-items-center rounded-xl',
          when === 'coming' ? 'bg-popover ring-1 ring-foreground/[0.1]' : 'bg-black/25',
        )}
      >
        <span
          className={cn('grid place-items-center', when === 'coming' && !owned && 'opacity-60')}
        >
          <RewardArt unlock={unlock} box={38} />
        </span>
        {owned && when !== 'coming' && (
          <span className="absolute -top-1 -right-1 grid size-4.5 place-items-center rounded-full bg-streak text-background ring-2 ring-popover">
            <Check className="size-2.5" strokeWidth={4} aria-hidden />
          </span>
        )}
      </span>
    )
  }

  if (when === 'today') {
    return (
      <span
        className={cn(
          'grid size-11 place-items-center rounded-full shadow-md shadow-black/30',
          claimed ? 'text-background' : 'border-2 border-streak bg-popover text-streak',
        )}
        style={
          claimed
            ? {
                background:
                  'radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--color-streak) 70%, white), var(--color-streak))',
              }
            : undefined
        }
      >
        {claimed ? (
          <Check className="size-5" strokeWidth={3.5} aria-hidden />
        ) : (
          <Flame className="size-5 fill-streak/30" aria-hidden />
        )}
      </span>
    )
  }

  if (when === 'had') {
    return (
      <span
        className="grid size-8 place-items-center rounded-full text-background shadow-sm shadow-black/30"
        style={{
          background:
            'radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--color-streak) 70%, white), var(--color-streak))',
        }}
      >
        {row.kind === 'run' ? (
          <span className="text-2xs font-bold tabular-nums">×{row.to - row.from + 1}</span>
        ) : (
          <Flame className="size-3.5 fill-background/25" strokeWidth={2.5} aria-hidden />
        )}
      </span>
    )
  }

  return (
    <span className="grid size-8 place-items-center rounded-full bg-popover text-xs font-medium text-muted-foreground tabular-nums ring-2 ring-foreground/[0.1]">
      {row.kind === 'run' ? '…' : row.reward.streakDay}
    </span>
  )
}
