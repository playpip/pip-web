'use client'

/**
 * The streak, under the Roll on the home screen: a flame and the days in a row
 * with a hand played. Lit once today has a hand in it; waiting (and pulsing)
 * while the run still needs today; muted at 0, so it is findable before it
 * means anything. Always on Home, beside the Pip Rating and in the same quiet
 * weight (no pill: Will, 2026-11-05). Tapping it opens the streak sheet
 * (menu/StreakSheet): the streak, its best, the rewards had and to come.
 */

import { motion } from 'framer-motion'
import { useState } from 'react'
import { Flame } from 'lucide-react'
import { StreakSheet } from '@/components/menu/StreakSheet'
import { dailyDateKey } from '@/lib/daily'
import { liveStreak, streakAtRisk } from '@/lib/streak'
import { useHydrated } from '@/lib/useHydrated'
import { cn } from '@/lib/utils'
import { sound } from '@/lib/sound'
import { useProfile } from '@/store/profile'

export function StreakBadge() {
  const [open, setOpen] = useState(false)
  const hydrated = useHydrated()
  const streak = useProfile((s) => s.streak)
  const created = useProfile((s) => s.created)
  if (!hydrated || !created) return null

  const today = dailyDateKey()
  const run = streak ? liveStreak(streak, today) : 0
  const playedToday = streak?.lastDate === today
  const atRisk = streak ? streakAtRisk(streak, today) : false
  const lit = playedToday || atRisk

  return (
    <>
      <motion.button
        type="button"
        aria-haspopup="dialog"
        aria-label={
          run > 0
            ? `${run}-day streak. See your streak rewards`
            : 'No streak yet. See streak rewards'
        }
        onClick={() => {
          sound.play('tap')
          setOpen(true)
        }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        className={cn(
          '-ml-1 inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-full px-1 text-sm select-none',
          !lit && 'text-muted-foreground',
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
            <span className="font-semibold">{run}-day streak</span>
          ) : atRisk ? (
            <>
              <span className="font-semibold">{run}-day streak</span>
              <span className="text-muted-foreground"> · play today to keep it</span>
            </>
          ) : (
            'Play a hand each day to build a streak'
          )}
        </span>
      </motion.button>
      <StreakSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
