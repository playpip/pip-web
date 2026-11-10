'use client'

// The daily reward, under the Roll (Will, 2026-10-25): come back each day,
// claim chips, and the chips grow with the streak. The rules are in
// lib/dailyReward; this is the card and the claim.
//
// **A card, not a pop-up.** It waits under the streak flame until it is
// tapped, and once today's is claimed it goes, leaving the flame. One
// flame: claiming counts the day for the streak, so the two never disagree.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { Check, Flame } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CountUp } from '@/components/CountUp'
import { membershipFor } from '@/config/membership'
import { Burst, Coin, DoubleBadge, RewardArt, Sheen } from './RewardArt'
import {
  MILESTONES,
  claimDay,
  claimable,
  rewardFor,
  yourTable,
  type Reward,
  type StreakUnlock,
} from '@/lib/dailyReward'
import { dailyDateKey } from '@/lib/daily'
import { emptyStreak } from '@/lib/streak'
import { useHydrated } from '@/lib/useHydrated'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useEntitlement } from '@/store/entitlement'
import { useProfile } from '@/store/profile'

const SPRING = { type: 'spring', stiffness: 380, damping: 26 } as const

/** 1,250 → "1.3k", for the ladder's narrow tiles. */
function compact(n: number): string {
  if (n < 1_000) return String(n)
  if (n < 1_000_000) return `${+(n / 1_000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${+(n / 1_000_000).toFixed(1)}m`
}

/**
 * Under the Roll and the streak flame (components/StreakBadge): the reward card
 * while today's is unclaimed.
 */
export function DailyRewardSlot() {
  const hydrated = useHydrated()
  const created = useProfile((s) => s.created)
  const record = useProfile((s) => s.dailyReward)
  const [open, setOpen] = useState(false)
  if (!hydrated || !created) return null
  // Kept up while the dialog is open, so the claim plays out in front of it.
  const showCard = open || claimable(record, dailyDateKey())
  return (
    <>
      {showCard && <RewardCard onOpen={() => setOpen(true)} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
          {open && <Claim onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Today's reward as it stands: the streak day a claim lands on, and what it pays. */
function useToday(): Reward {
  const streak = useProfile((s) => s.streak)
  const venueRecords = useProfile((s) => s.venueRecords)
  const member = useEntitlement()
  const today = dailyDateKey()
  return rewardFor(claimDay(streak ?? emptyStreak(), today), yourTable(venueRecords).buyIn, member)
}

// --- the card -------------------------------------------------------------------

function RewardCard({ onOpen }: { onOpen: () => void }) {
  const money = useMoney()
  const member = useEntitlement()
  const reward = useToday()
  return (
    <MotionConfig reducedMotion="user">
      {/* A container, so the card can make room once it is under 20rem wide
          (a phone at 125% text and up): the art goes and Claim drops to its
          own row, rather than sliding over the reward. */}
      <div className="@container mt-3 w-full max-w-md">
        <motion.button
          type="button"
          onClick={() => {
            sound.play('tap')
            onOpen()
          }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          transition={SPRING}
          className="relative flex w-full flex-wrap items-center gap-3.5 overflow-hidden @[20rem]:flex-nowrap rounded-3xl border border-streak/25 py-3 pr-3.5 pl-3 text-left shadow-lg shadow-black/20"
          style={{
            background:
              'linear-gradient(115deg, color-mix(in oklab, var(--color-streak) 20%, var(--color-card)), color-mix(in oklab, var(--color-streak) 5%, var(--color-card)) 65%)',
          }}
        >
          <Sheen />
          <span className="relative hidden size-14 shrink-0 place-items-center rounded-2xl bg-black/15 @[20rem]:grid">
            {reward.unlock ? (
              <motion.span
                animate={{ rotate: [0, -6, 6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.4 }}
                className="grid place-items-center"
              >
                <RewardArt unlock={reward.unlock} box={44} />
              </motion.span>
            ) : (
              <CoinStack count={Math.min(5, 2 + Math.floor(reward.ladderDay / 2))} />
            )}
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="flex items-center gap-1 text-xs font-semibold text-streak">
              <Flame className="size-3.5 fill-streak/30" aria-hidden />
              Day {reward.streakDay} reward
            </span>
            <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-xl font-semibold tracking-tight tabular-nums">
                  {money(reward.chips)}
                </span>
                <span className="text-sm text-muted-foreground">chips</span>
              </span>
              {member && <DoubleBadge />}
            </span>
            {reward.unlock ? (
              <span className="block truncate text-xs text-muted-foreground">
                + {reward.unlock.name}
              </span>
            ) : (
              <WeekDots day={reward.ladderDay} />
            )}
          </span>
          <span className="relative shrink-0 basis-full rounded-full bg-primary px-4 py-2 text-center text-sm @[20rem]:basis-auto font-semibold text-primary-foreground shadow-md shadow-black/25">
            Claim
          </span>
        </motion.button>
      </div>
    </MotionConfig>
  )
}

/** The week so far as seven pips: done, today, still to come. */
function WeekDots({ day }: { day: number }) {
  return (
    <span className="mt-1.5 flex gap-1" role="img" aria-label={`Day ${day} of 7`}>
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-4 rounded-full',
            i + 1 < day
              ? 'bg-streak/70'
              : i + 1 === day
                ? 'animate-pulse bg-streak'
                : 'bg-foreground/12',
          )}
        />
      ))}
    </span>
  )
}

// --- chips --------------------------------------------------------------------

/** A short stack of chips seen side-on, bobbing. */
function CoinStack({ count }: { count: number }) {
  return (
    <motion.span
      className="relative block h-9 w-9"
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="table-chip"
          style={
            {
              left: 7,
              bottom: 4 + i * 4,
              ['--chip' as string]: i % 2 ? 'var(--color-chip-coral)' : 'var(--color-streak)',
            } as React.CSSProperties
          }
        />
      ))}
    </motion.span>
  )
}

// --- the claim ------------------------------------------------------------------

function Claim({ onDone }: { onDone: () => void }) {
  const money = useMoney()
  const member = useEntitlement()
  const buyIn = yourTable(useProfile((s) => s.venueRecords)).buyIn
  const claimDailyReward = useProfile((s) => s.claimDailyReward)
  const today = useToday()
  const [claimed, setClaimed] = useState<Reward | null>(null)
  const reward = claimed ?? today
  const n = reward.streakDay

  // The week on the ladder this claim sits in.
  const weekStart = n - reward.ladderDay + 1
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => rewardFor(weekStart + i, buyIn, member)),
    [weekStart, buyIn, member],
  )
  const milestone = MILESTONES.find((m) => m.day >= n) ?? null
  const previous = [...MILESTONES].reverse().find((m) => m.day < (milestone?.day ?? 0))?.day ?? 0

  // On a phone the week scrolls sideways; start it with today in the middle.
  const todayTile = useRef<HTMLDivElement>(null)
  useEffect(() => {
    todayTile.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [])

  const claim = () => {
    const result = claimDailyReward(dailyDateKey(), member)
    if (!result) return onDone()
    sound.play('win')
    for (let i = 0; i < 5; i++) setTimeout(() => sound.play('bet'), 220 + i * 70)
    setClaimed(result)
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex flex-col items-center px-5 pt-7 pb-5 text-center">
        {/* the warm light the whole thing sits in */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-56"
          style={{
            background:
              'radial-gradient(60% 80% at 50% 0%, color-mix(in oklab, var(--color-streak) 28%, transparent), transparent 75%)',
          }}
        />

        <motion.span
          className="relative"
          animate={claimed ? { scale: [1, 1.35, 1], rotate: [0, -8, 0] } : { scale: [1, 1.06, 1] }}
          transition={
            claimed
              ? { duration: 0.6, ease: 'easeOut' }
              : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <Flame className="size-14 fill-streak/35 text-streak drop-shadow-[0_6px_18px_rgba(255,138,61,0.45)]" />
        </motion.span>
        <DialogTitle className="relative mt-2 text-3xl font-semibold tracking-tight tabular-nums">
          {claimed ? (n === 1 ? '1-day streak' : `${n}-day streak`) : `Day ${n}`}
        </DialogTitle>
        <DialogDescription className="relative mt-1 text-sm">
          {claimed
            ? 'Come back tomorrow to keep it going.'
            : n === 1
              ? 'Claim each day and the rewards grow.'
              : `Claim today to keep your ${n - 1}-day streak.`}
        </DialogDescription>

        {/* --- the week ------------------------------------------------- */}
        <div className="relative -mx-5 mt-4 flex w-[calc(100%+2.5rem)] snap-x snap-mandatory gap-2 overflow-x-auto px-5 pt-2.5 pb-2.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:-mx-2 sm:w-[calc(100%+1rem)] sm:px-2 [&::-webkit-scrollbar]:hidden">
          {week.map((day, i) => {
            const past = day.streakDay < n || (claimed !== null && day.streakDay === n)
            const now = day.streakDay === n
            return (
              <motion.div
                key={day.streakDay}
                ref={now ? todayTile : undefined}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, scale: now && !claimed ? 1.06 : 1 }}
                transition={{ ...SPRING, delay: i * 0.04 }}
                className={cn(
                  'relative flex w-[4.75rem] shrink-0 snap-center flex-col items-center justify-between gap-1.5 rounded-2xl px-1 pt-2.5 pb-2 sm:w-auto sm:flex-1',
                  now
                    ? 'bg-streak/15 ring-2 ring-streak'
                    : past
                      ? 'bg-foreground/[0.05]'
                      : 'bg-foreground/[0.03]',
                )}
              >
                <span
                  className={cn(
                    'text-2xs font-medium',
                    now ? 'text-streak' : 'text-muted-foreground',
                  )}
                >
                  Day {day.streakDay}
                </span>
                <span
                  className={cn(
                    'grid h-11 w-full place-items-center',
                    past && !now && 'opacity-40',
                  )}
                >
                  {day.unlock ? (
                    <RewardArt unlock={day.unlock} box={40} />
                  ) : (
                    <Coin size={18 + day.rate * 3} />
                  )}
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums',
                    past && !now ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {compact(day.chips)}
                </span>
                {past && (
                  <motion.span
                    initial={now ? { scale: 0 } : false}
                    animate={{ scale: 1 }}
                    transition={{ ...SPRING, delay: now ? 0.25 : 0 }}
                    className="absolute -top-1.5 -right-1 grid size-4 place-items-center rounded-full bg-streak text-background"
                  >
                    <Check className="size-2.5" strokeWidth={4} />
                  </motion.span>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* --- the payout ---------------------------------------------- */}
        <AnimatePresence mode="wait" initial={false}>
          {claimed ? (
            <motion.div
              key="paid"
              className="relative mt-5 flex w-full flex-col items-center"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING}
            >
              <Burst />
              <p className="flex items-baseline gap-1.5 text-4xl font-semibold tracking-tight tabular-nums">
                <CountUp value={claimed.chips} format={(v) => `+${money(v)}`} duration={0.9} />
                <span className="text-base font-medium text-muted-foreground">chips</span>
              </p>
              {member && <p className="mt-1 text-xs text-pip">Doubled for members</p>}
              {claimed.unlock && <Unwrapped unlock={claimed.unlock} />}
            </motion.div>
          ) : (
            <motion.div
              key="due"
              className="relative mt-5 w-full"
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12 }}
            >
              {milestone && <MilestoneRow unlock={milestone} from={previous} at={n} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- the button ----------------------------------------------- */}
        <div className="relative mt-5 w-full">
          {claimed ? (
            <button
              type="button"
              onClick={() => {
                sound.play('tap')
                onDone()
              }}
              className="h-12 w-full rounded-2xl bg-foreground/[0.08] font-semibold transition hover:bg-foreground/[0.13] active:scale-[0.98]"
            >
              Done
            </button>
          ) : (
            <motion.button
              type="button"
              onClick={claim}
              whileTap={{ scale: 0.97 }}
              className="relative h-14 w-full overflow-hidden rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-lg shadow-black/30"
            >
              <Sheen />
              <span className="relative">Claim {money(reward.chips)} chips</span>
            </motion.button>
          )}
          {!member && !claimed && (
            <p className="mt-3 text-xs text-muted-foreground">
              Members get {money(reward.baseChips * 2)}.{' '}
              <Link
                href={membershipFor('daily-reward')}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Membership
              </Link>
            </p>
          )}
        </div>
      </div>
    </MotionConfig>
  )
}

/** The next thing the streak hands over, and how far there is to go. */
function MilestoneRow({ unlock, from, at }: { unlock: StreakUnlock; from: number; at: number }) {
  const day = unlock.day
  const left = day - at
  const progress = Math.min(1, Math.max(0, (at - from) / (day - from)))
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-foreground/[0.04] p-3 text-left">
      <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-black/20">
        <RewardArt unlock={unlock} box={44} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{unlock.name}</span>
        <span className="block text-xs text-muted-foreground">
          {left === 0
            ? 'Yours when you claim today'
            : `Day ${day} · ${left} more ${left === 1 ? 'day' : 'days'}`}
        </span>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <motion.span
            className="block h-full rounded-full bg-streak"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(6, progress * 100)}%` }}
            transition={{ ...SPRING, delay: 0.2 }}
          />
        </span>
      </span>
    </div>
  )
}

/** What the streak just handed over, turned over like a card. */
function Unwrapped({ unlock }: { unlock: StreakUnlock }) {
  const profile = useProfile()
  const router = useRouter()
  const [worn, setWorn] = useState(false)
  const item = unlock.item
  const wearable = item !== null && item.kind !== 'souvenir'
  const wear = () => {
    if (!item) return
    sound.play('call')
    if (item.kind === 'ring') profile.setAvatarRing(item.id)
    if (item.kind === 'back') profile.setCardBack(item.id)
    if (item.kind === 'button') profile.setDealerButton(item.id)
    if (item.kind === 'finish') profile.setTableFinish(item.id)
    if (item.kind === 'sound') profile.setSoundPack(item.id)
    setWorn(true)
  }
  return (
    <motion.div
      className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-streak/30 bg-streak/[0.08] p-3 text-left"
      style={{ perspective: 600 }}
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ ...SPRING, delay: 0.45 }}
    >
      <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-black/20">
        <RewardArt unlock={unlock} box={52} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-streak">New</span>
        <span className="block truncate font-semibold">{unlock.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{unlock.blurb}</span>
      </span>
      {unlock.venue && (
        <button
          type="button"
          onClick={() => {
            sound.play('call')
            router.push(`/play/${unlock.venue?.id}`)
          }}
          className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition active:scale-95"
        >
          Sit down
        </button>
      )}
      {wearable && (
        <button
          type="button"
          onClick={wear}
          disabled={worn}
          className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition active:scale-95 disabled:bg-foreground/10 disabled:text-muted-foreground"
        >
          {worn ? 'In use' : 'Use'}
        </button>
      )}
    </motion.div>
  )
}
