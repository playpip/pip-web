'use client'

// The streak sheet (Will, 2026-11-04: "I need to be able to tap the streak
// button and see my rewards"). Opened from the flame under the Roll
// (components/StreakBadge). It shows the rules in lib/dailyReward and
// lib/streak and changes none of them:
//
// - today: claimed or not, and what today (or tomorrow) pays, with the claim
//   itself if it is still to do, through the same `claimDailyReward` as the card;
// - the last seven days, lit where they were played;
// - every streak unlock in order, ticked once owned, the next one marked with
//   how many days are left;
// - how it works, in a few plain lines, and what members get.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { Check, Flame } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { CountUp } from '@/components/CountUp'
import { membershipFor } from '@/config/membership'
import { trackOnce } from '@/lib/analytics'
import {
  LADDER,
  MILESTONES,
  claimDay,
  claimable,
  rewardFor,
  yourTable,
  type Reward,
  type StreakUnlock,
} from '@/lib/dailyReward'
import { dailyDateKey } from '@/lib/daily'
import { daysBetween, emptyStreak, liveStreak, streakAtRisk } from '@/lib/streak'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'
import { Burst, Coin, DoubleBadge, RewardArt, Sheen } from './RewardArt'

const SPRING = { type: 'spring', stiffness: 380, damping: 26 } as const

/** When the current UTC day ends, in the player's own clock. */
function endOfDayLocal(): string {
  const now = new Date()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** The UTC day key `n` days after `key` (negative for before). */
function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function StreakSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const streak = useProfile((s) => s.streak)
  const run = streak ? liveStreak(streak, dailyDateKey()) : 0
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        onClose={() => onOpenChange(false)}
        title={
          <>
            <Flame
              className={cn('size-5', run > 0 ? 'fill-streak/30 text-streak' : 'text-streak/70')}
              aria-hidden
            />
            <span className="tabular-nums">{run > 0 ? `${run}-day streak` : 'No streak yet'}</span>
          </>
        }
      >
        <Body onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

/** Mounted with the sheet, so a claim made in it plays out once and resets next time. */
function Body({ onClose }: { onClose: () => void }) {
  const money = useMoney()
  const member = useEntitlement()
  const streak = useProfile((s) => s.streak) ?? emptyStreak()
  const record = useProfile((s) => s.dailyReward)
  const owned = useProfile((s) => s.owned)
  const buyIn = yourTable(useProfile((s) => s.venueRecords)).buyIn
  const claimDailyReward = useProfile((s) => s.claimDailyReward)
  const [claimed, setClaimed] = useState<Reward | null>(null)

  useEffect(() => trackOnce('streak-sheet-opened'), [])

  const today = dailyDateKey()
  const run = liveStreak(streak, today)
  const playedToday = streak.lastDate === today
  const atRisk = streakAtRisk(streak, today)
  const best = Math.max(streak.best, run)
  const due = claimable(record, today)
  const todayReward = rewardFor(claimDay(streak, today), buyIn, member)
  const tomorrow = rewardFor(run + 1, buyIn, member)

  const line = !playedToday
    ? atRisk
      ? `Claim today's reward or play a hand before ${endOfDayLocal()} to keep it.`
      : 'Claim the reward or play a hand to start one.'
    : due
      ? "Today counts. Today's reward is still to claim."
      : `Today counts. Come back tomorrow to make it ${run + 1}.`

  // The next thing still to earn: owned ones from an earlier run do not count.
  const next = MILESTONES.find((m) => m.day > run && !owned.includes(m.id)) ?? null

  const claim = () => {
    const result = claimDailyReward(today, member)
    if (!result) return
    sound.play('win')
    for (let i = 0; i < 5; i++) setTimeout(() => sound.play('bet'), 220 + i * 70)
    setClaimed(result)
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-5 pb-1">
        {/* --- the flame and where it stands -------------------------------- */}
        <div className="relative flex flex-col items-center pt-1 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-32"
            style={{
              background:
                'radial-gradient(45% 60% at 50% 30%, color-mix(in oklab, var(--color-streak) 24%, transparent), transparent 75%)',
            }}
          />
          <motion.span
            className="relative"
            animate={claimed ? { scale: [1, 1.3, 1], rotate: [0, -8, 0] } : { scale: [1, 1.05, 1] }}
            transition={
              claimed
                ? { duration: 0.6, ease: 'easeOut' }
                : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            }
          >
            <Flame
              className={cn(
                'size-14',
                run > 0
                  ? 'fill-streak/35 text-streak drop-shadow-[0_6px_18px_rgba(255,138,61,0.45)]'
                  : 'text-streak/60',
              )}
              aria-hidden
            />
          </motion.span>
          <p className="relative mt-2 max-w-xs text-sm text-muted-foreground">{line}</p>
          {best > 0 && (
            <span className="relative mt-2 rounded-full bg-foreground/[0.06] px-2.5 py-0.5 text-xs text-muted-foreground tabular-nums">
              Best {best} {best === 1 ? 'day' : 'days'}
            </span>
          )}
        </div>

        <Week streak={streak} today={today} />

        {/* --- today ------------------------------------------------------- */}
        <AnimatePresence mode="wait" initial={false}>
          {claimed ? (
            <motion.div
              key="paid"
              className="relative flex flex-col items-center rounded-3xl border border-streak/25 bg-streak/[0.07] px-4 py-5 text-center"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING}
            >
              <Burst />
              <span className="flex items-center gap-1.5 text-xs font-semibold text-streak">
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
                Day {claimed.streakDay} claimed
              </span>
              <p className="mt-1 flex items-baseline gap-1.5 text-4xl font-semibold tracking-tight tabular-nums">
                <CountUp value={claimed.chips} format={(v) => `+${money(v)}`} duration={0.9} />
                <span className="text-base font-medium text-muted-foreground">chips</span>
              </p>
              {member && <p className="mt-1 text-xs text-pip">Doubled for members</p>}
              {claimed.unlock && (
                <p className="mt-2 text-sm">
                  <span className="font-semibold">{claimed.unlock.name}</span> is yours
                </p>
              )}
            </motion.div>
          ) : due ? (
            <motion.div
              key="due"
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="relative overflow-hidden rounded-3xl border border-streak/25 p-3.5 shadow-lg shadow-black/20"
              style={{
                background:
                  'linear-gradient(115deg, color-mix(in oklab, var(--color-streak) 18%, var(--color-card)), color-mix(in oklab, var(--color-streak) 4%, var(--color-card)) 70%)',
              }}
            >
              <Sheen />
              <RewardLine label="Today" reward={todayReward} member={member} />
              <motion.button
                type="button"
                onClick={claim}
                whileTap={{ scale: 0.97 }}
                className="relative mt-3.5 h-13 w-full overflow-hidden rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-black/30"
              >
                <Sheen />
                <span className="relative">Claim {money(todayReward.chips)} chips</span>
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="done"
              className="rounded-3xl bg-foreground/[0.04] p-3.5 ring-1 ring-foreground/[0.06]"
            >
              <span className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-streak">
                <span className="grid size-4 place-items-center rounded-full bg-streak text-background">
                  <Check className="size-2.5" strokeWidth={4} aria-hidden />
                </span>
                Today's reward claimed
              </span>
              <RewardLine label="Tomorrow" reward={tomorrow} member={member} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- the track --------------------------------------------------- */}
        <section aria-labelledby="streak-track">
          <h3 id="streak-track" className="mb-2 px-1 text-sm font-semibold">
            Streak rewards
          </h3>
          <ol className="relative flex flex-col gap-1.5">
            {/* the rail the rewards hang on */}
            <span
              aria-hidden
              className="absolute top-7 bottom-7 left-[1.9rem] w-0.5 rounded-full bg-foreground/[0.08]"
            />
            {MILESTONES.map((m, i) => (
              <TrackRow
                key={m.id}
                unlock={m}
                run={run}
                owned={owned.includes(m.id)}
                next={next?.id === m.id}
                todayDay={due ? todayReward.streakDay : null}
                previous={MILESTONES[i - 1]?.day ?? 0}
              />
            ))}
          </ol>
        </section>

        {/* --- how it works ------------------------------------------------- */}
        <section className="rounded-3xl bg-foreground/[0.03] p-4 text-sm ring-1 ring-foreground/[0.06]">
          <h3 className="font-semibold">How it works</h3>
          <p className="mt-1.5 text-muted-foreground">
            Claim the daily reward or finish a hand at any table, and the day counts. Each day ends
            at {endOfDayLocal()}.
          </p>
          <p className="mt-1.5 text-muted-foreground">
            Miss a day and the streak goes back to day 1. Rewards you have earned stay yours.
          </p>
          <p className="mt-1.5 text-muted-foreground">
            Chips rise from {money(rewardFor(1, buyIn, member).chips)} on day 1 to{' '}
            {money(rewardFor(LADDER.length, buyIn, member).chips)} on day {LADDER.length}, then stay
            at {money(rewardFor(LADDER.length, buyIn, member).chips)}.
          </p>
          <div className="mt-3 border-t border-foreground/[0.06] pt-3">
            {member ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <DoubleBadge />
                Your chips are doubled as a member.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Members get double chips.{' '}
                <Link
                  href={membershipFor('daily-reward')}
                  onClick={onClose}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Membership
                </Link>
              </p>
            )}
          </div>
        </section>
      </div>
    </MotionConfig>
  )
}

/** The last seven days, today on the right, lit where a hand or a claim counted. */
function Week({ streak, today }: { streak: ReturnType<typeof emptyStreak>; today: string }) {
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const key = addDays(today, i - 6)
        const back = streak.lastDate ? daysBetween(key, streak.lastDate) : -1
        return {
          key,
          played: back >= 0 && back < streak.current,
          today: key === today,
          label: new Date(`${key}T00:00:00Z`).toLocaleDateString([], {
            weekday: 'short',
            timeZone: 'UTC',
          }),
          date: Number(key.slice(8, 10)),
        }
      }),
    [streak.lastDate, streak.current, today],
  )
  return (
    <section
      aria-label="The last seven days"
      className="grid grid-cols-7 gap-1 rounded-3xl bg-foreground/[0.04] px-2 py-3 ring-1 ring-foreground/[0.06]"
    >
      {days.map((d, i) => (
        <div key={d.key} className="flex flex-col items-center gap-1.5">
          <span
            className={cn(
              'text-2xs font-medium',
              d.today ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {d.today ? 'Today' : d.label}
          </span>
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING, delay: i * 0.035 }}
            aria-label={`${d.label} ${d.date}: ${d.played ? 'played' : 'not played'}`}
            className={cn(
              'grid size-9 place-items-center rounded-full',
              d.played
                ? 'text-background shadow-md shadow-black/30'
                : d.today
                  ? 'border-2 border-dashed border-streak/50 text-streak/70'
                  : 'bg-foreground/[0.06] text-muted-foreground/60',
            )}
            style={
              d.played
                ? {
                    background:
                      'radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--color-streak) 70%, white), var(--color-streak))',
                  }
                : undefined
            }
          >
            {d.played ? (
              <Flame className="size-4 fill-background/25" strokeWidth={2.5} aria-hidden />
            ) : (
              <span className="text-xs tabular-nums">{d.date}</span>
            )}
          </motion.span>
        </div>
      ))}
    </section>
  )
}

/** One day's reward: the chips (or the item), with its day and the members' badge. */
function RewardLine({ label, reward, member }: { label: string; reward: Reward; member: boolean }) {
  const money = useMoney()
  return (
    <div className="relative flex items-center gap-3">
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-black/20">
        {reward.unlock ? (
          <RewardArt unlock={reward.unlock} box={44} />
        ) : (
          <Coin size={22 + reward.rate * 3} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-streak">
          {label} · Day {reward.streakDay}
        </span>
        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-xl font-semibold tracking-tight tabular-nums">
            {money(reward.chips)}
          </span>
          <span className="text-sm text-muted-foreground">chips</span>
          {member && <DoubleBadge />}
        </span>
        {reward.unlock && (
          <span className="block truncate text-xs text-muted-foreground">
            + {reward.unlock.name}
          </span>
        )}
      </span>
    </div>
  )
}

/** One unlock on the track: owned and ticked, next and counting down, or still to come. */
function TrackRow({
  unlock,
  run,
  owned,
  next,
  todayDay,
  previous,
}: {
  unlock: StreakUnlock
  run: number
  owned: boolean
  next: boolean
  /** The streak day a claim today lands on, while it is still to claim. */
  todayDay: number | null
  previous: number
}) {
  const left = unlock.day - run
  const progress = Math.min(1, Math.max(0, (run - previous) / (unlock.day - previous)))
  return (
    <li
      className={cn(
        'relative flex items-center gap-3 rounded-2xl p-2 pr-3',
        next && 'bg-streak/[0.09] ring-1 ring-streak/40',
      )}
    >
      <span
        className={cn(
          'relative grid size-12 shrink-0 place-items-center rounded-xl',
          next ? 'bg-black/25' : 'bg-popover ring-1 ring-foreground/[0.08]',
        )}
      >
        <span className={cn('grid place-items-center', !owned && !next && 'opacity-55')}>
          <RewardArt unlock={unlock} box={38} />
        </span>
        {owned && (
          <span className="absolute -top-1 -right-1 grid size-4.5 place-items-center rounded-full bg-streak text-background ring-2 ring-popover">
            <Check className="size-2.5" strokeWidth={4} aria-hidden />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-sm font-semibold',
            !owned && !next && 'text-foreground/75',
          )}
        >
          {unlock.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          Day {unlock.day}
          {unlock.venue && ' · A new table, with Maud'}
        </span>
        {next && (
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <motion.span
              className="block h-full rounded-full bg-streak"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(5, progress * 100)}%` }}
              transition={{ ...SPRING, delay: 0.2 }}
            />
          </span>
        )}
      </span>
      <span
        className={cn(
          'shrink-0 text-right text-xs font-semibold whitespace-nowrap tabular-nums',
          owned ? 'text-streak' : next ? 'text-streak' : 'text-muted-foreground',
        )}
      >
        {owned
          ? 'Yours'
          : next
            ? todayDay === unlock.day
              ? 'Claim today'
              : `${left} ${left === 1 ? 'day' : 'days'} to go`
            : null}
      </span>
    </li>
  )
}
