'use client'

/**
 * The streak, under the Roll on the home screen: a flame and the days in a row
 * with a hand played. Lit once today has a hand in it; waiting (and pulsing)
 * while the run still needs today; muted at 0, so it is findable before it
 * means anything. Tapping it opens the streak sheet (menu/StreakSheet): today,
 * the week, and every reward the streak hands over.
 */

import { motion } from 'framer-motion'
import { ChevronRight, Flame } from 'lucide-react'
import { dailyDateKey } from '@/lib/daily'
import { liveStreak, streakAtRisk } from '@/lib/streak'
import { useHydrated } from '@/lib/useHydrated'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import { useProfile } from '@/store/profile'

export function StreakBadge({ onOpen }: { onOpen: () => void }) {
  const hydrated = useHydrated()
  const streak = useProfile((s) => s.streak)
  const created = useProfile((s) => s.created)
  if (!hydrated || !created) return null

  const today = dailyDateKey()
  const run = streak ? liveStreak(streak, today) : 0
  const playedToday = streak?.lastDate === today
  const atRisk = streak ? streakAtRisk(streak, today) : false
  const best = Math.max(streak?.best ?? 0, run)
  const lit = playedToday || atRisk

  return (
    <motion.button
      type="button"
      aria-haspopup="dialog"
      aria-label={
        run > 0 ? `${run}-day streak. See your streak rewards` : 'No streak yet. See streak rewards'
      }
      onClick={() => {
        sound.play('tap')
        onOpen()
      }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      className={cn(
        'mt-4 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-full border py-1.5 pr-2.5 pl-3 text-sm shadow-sm shadow-black/20 transition-colors select-none',
        lit
          ? 'border-streak/30 bg-streak/[0.08] hover:bg-streak/[0.14] active:bg-streak/[0.2]'
          : 'border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.06] active:bg-foreground/[0.1]',
      )}
    >
      <Flame
        className={cn(
          'size-4',
          lit ? 'text-streak' : 'text-muted-foreground',
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
      <ChevronRight className="size-4 text-muted-foreground/70" aria-hidden />
    </motion.button>
  )
}
