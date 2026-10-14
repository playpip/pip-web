'use client'

import { useId } from 'react'
import { motion } from 'framer-motion'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/**
 * The iOS segmented control: one track, one thumb that slides to what you
 * picked. The thumb is a single shared element (`layoutId`), so the movement is
 * the control answering rather than two buttons changing colour.
 */
export function Segmented<T extends number>({
  options,
  value,
  onPick,
}: {
  options: { value: T; label: string; sub?: string }[]
  value: T
  onPick: (value: T) => void
}) {
  const track = useId()
  return (
    <div className="flex gap-1 rounded-2xl bg-foreground/[0.06] p-1">
      {options.map((option) => {
        const picked = option.value === value
        return (
          <button
            key={option.value}
            onClick={() => {
              sound.play('tap')
              onPick(option.value)
            }}
            aria-pressed={picked}
            className="relative flex-1 rounded-xl px-2 py-1.5 transition active:scale-[0.97]"
          >
            {picked && (
              <motion.span
                layoutId={track}
                // The thumb has to read as *raised off* the track in both
                // themes, and `foreground/<alpha>` alone cannot do that: the
                // track is already a foreground tint, so a second one lands
                // under it in the dark. White in light, a lighter grey in
                // dark — which is what the control it is imitating does.
                className="absolute inset-0 rounded-xl bg-background shadow-sm ring-1 ring-foreground/10 dark:bg-foreground/15 dark:ring-foreground/5"
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative block">
              <span
                className={cn(
                  'block truncate text-sm tabular-nums',
                  picked ? 'font-semibold' : 'text-muted-foreground',
                )}
              >
                {option.label}
              </span>
              {option.sub && (
                <span className="mt-0.5 block truncate text-2xs tabular-nums text-muted-foreground">
                  {option.sub}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
