'use client'

/**
 * The streak, under the Roll on the home screen: a flame and the days in a row
 * with a hand played. Lit once today has a hand in it; waiting (and pulsing)
 * while the run still needs today; muted at 0, so it is findable before it
 * means anything. Tapping it says what keeps it going.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { firstSeatHref } from '@/components/onboarding/firstSeat'
import { dailyDateKey } from '@/lib/daily'
import { liveStreak, streakAtRisk } from '@/lib/streak'
import { useHydrated } from '@/lib/useHydrated'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import { useProfile } from '@/store/profile'

/** When the current UTC day ends, in the player's own clock. */
function endOfDayLocal(): string {
  const now = new Date()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function StreakBadge() {
  const router = useRouter()
  const hydrated = useHydrated()
  const streak = useProfile((s) => s.streak)
  const created = useProfile((s) => s.created)
  const [open, setOpen] = useState(false)
  if (!hydrated || !created) return null

  const today = dailyDateKey()
  const run = streak ? liveStreak(streak, today) : 0
  const playedToday = streak?.lastDate === today
  const atRisk = streak ? streakAtRisk(streak, today) : false
  const best = Math.max(streak?.best ?? 0, run)

  const line = playedToday
    ? `Played today. Play a hand tomorrow to make it ${run + 1}.`
    : atRisk
      ? `Play a hand before ${endOfDayLocal()} to keep it.`
      : 'Play a hand at any table to start one. Each day in a row adds one.'

  return (
    <>
      <button
        type="button"
        onClick={() => {
          sound.play('tap')
          setOpen(true)
        }}
        className={cn(
          'mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border py-1.5 pr-4 pl-3 text-sm transition active:scale-[0.98]',
          playedToday || atRisk
            ? 'border-streak/30 bg-streak/[0.08] hover:bg-streak/[0.14]'
            : 'border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.06]',
        )}
      >
        <Flame
          className={cn(
            'size-4',
            playedToday || atRisk ? 'text-streak' : 'text-muted-foreground',
            playedToday && 'fill-streak/30',
            atRisk && 'animate-pulse',
          )}
          aria-hidden
        />
        <span className="tabular-nums">
          {playedToday ? (
            <>
              <span className="font-semibold">{run}-day streak</span>
              {best > run && <span className="text-muted-foreground"> · best {best}</span>}
            </>
          ) : atRisk ? (
            <>
              Play a hand today to keep your <span className="font-semibold">{run}-day streak</span>
            </>
          ) : (
            'Play a hand each day to build a streak'
          )}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs" showCloseButton={false}>
          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <Flame
              className={cn(
                'size-12',
                playedToday ? 'fill-streak/30 text-streak' : 'text-muted-foreground',
              )}
              aria-hidden
            />
            <DialogTitle className="text-2xl font-semibold tabular-nums">
              {run === 1 ? '1-day streak' : `${run}-day streak`}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">{line}</DialogDescription>
            {best > 0 && (
              <p className="text-xs text-muted-foreground">
                Best: {best} {best === 1 ? 'day' : 'days'}
              </p>
            )}
            {!playedToday && (
              <button
                type="button"
                onClick={() => {
                  sound.play('call')
                  setOpen(false)
                  router.push(firstSeatHref())
                }}
                className="mt-2 w-full rounded-2xl bg-primary py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
              >
                Play a hand
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
