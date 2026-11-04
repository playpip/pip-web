'use client'

// The Pip Rating under the Roll on Home (docs/rating.md): "1,412 ▲18 today",
// tappable to the rating sheet. Only in a build with the rating switched on.
// Placed above the streak flame and leaves it alone.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { dailyDateKey } from '@/lib/daily'
import { isProvisional, ratingOf } from '@/lib/rating'
import { ratingEnabled, ratingToday } from '@/lib/rating/local'
import { sendRating } from '@/lib/rating/rate'
import { useHydrated } from '@/lib/useHydrated'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'
import { RatingSheet } from './RatingSheet'

/** Read the account's row once a tab, so a second device shows the board's number. */
let readOnce = false

export function RatingLine() {
  const hydrated = useHydrated()
  const created = useProfile((s) => s.created)
  const rating = useProfile((s) => s.rating)
  const signedIn = useSync((s) => s.status === 'signed-in')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!ratingEnabled() || !signedIn || readOnce) return
    readOnce = true
    void sendRating()
  }, [signedIn])

  if (!ratingEnabled() || !hydrated || !created || !rating) return null
  const value = ratingOf(rating.core)
  const today = ratingToday(rating, dailyDateKey())
  const provisional = isProvisional(rating.core.decisions)

  return (
    <>
      <motion.button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          sound.play('tap')
          setOpen(true)
        }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        className="-ml-1 mt-2 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-full px-1 text-sm select-none"
      >
        <span className="text-muted-foreground">Pip Rating</span>
        <span className="font-semibold tabular-nums">{value.toLocaleString('en-GB')}</span>
        {provisional ? (
          <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-2xs text-muted-foreground">
            Provisional
          </span>
        ) : (
          today !== 0 && (
            <span
              className={cn(
                'text-sm font-medium tabular-nums',
                today > 0 ? 'text-emerald-500' : 'text-suit-red',
              )}
            >
              {today > 0 ? '▲' : '▼'}
              {Math.abs(today)} today
            </span>
          )
        )}
        <ChevronRight className="size-4 text-muted-foreground/70" aria-hidden />
      </motion.button>
      <RatingSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
