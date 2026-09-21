'use client'

/**
 * Right against wrong, as one bar you can read in a second.
 *
 * The shape chess.com uses for wins and losses, and it is the right one here
 * for the same reason: two counts that add up to a whole, where the only
 * question anybody has is *which way is it leaning*. A number and a percentage
 * make you do the arithmetic; this one is the arithmetic.
 *
 * **Both counts are written on it.** The bar is the feel, the numbers are the
 * fact, and a proportion with no sample under it is the thing this whole
 * report refuses to print.
 */

import { motion } from 'framer-motion'

export function SplitBar({
  right,
  wrong,
  /** Spots the estimate could not call either way. Shown, never hidden. */
  unknown = 0,
}: {
  right: number
  wrong: number
  unknown?: number
}) {
  const total = right + wrong
  if (total === 0) return null
  const pct = (n: number) => (n / total) * 100

  return (
    <div>
      {/* 2px of surface between the two, which is what separates them — no
          border, no stroke. */}
      <motion.div
        className="flex h-9 gap-0.5 overflow-hidden rounded-xl"
        initial={{ scaleX: 0.96, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div
          className="flex items-center justify-start bg-emerald-500/20 px-3"
          style={{ width: `${pct(right)}%` }}
        >
          <span className="truncate text-xs font-semibold tabular-nums text-emerald-500">
            {right.toLocaleString()}
          </span>
        </div>
        <div
          className="flex items-center justify-end bg-suit-red/20 px-3"
          style={{ width: `${pct(wrong)}%` }}
        >
          <span className="truncate text-xs font-semibold tabular-nums text-suit-red">
            {wrong.toLocaleString()}
          </span>
        </div>
      </motion.div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" /> Right
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-suit-red" /> Wrong
        </span>
        {unknown > 0 && (
          <span className="tabular-nums">
            {unknown.toLocaleString()} too close to call, counted as neither
          </span>
        )}
      </div>
    </div>
  )
}
