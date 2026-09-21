'use client'

/**
 * Where the money leaves by — one bar per street, in big blinds per hundred
 * hands.
 *
 * **One measure, so one colour and no legend.** These four bars are four
 * readings of the same thing, not four series; painting them four hues would
 * invent an identity the data does not have, and a legend would restate the
 * axis labels. The heading says what is plotted, the bars say how much, and
 * every bar carries its number at the tip, because four labels is not a flood.
 *
 * **Sorted worst first, and the sample rides along.** A street with thirty
 * priced decisions behind it and one with three hundred are not equally worth
 * believing, and the row says which is which rather than leaving the length of
 * the bar to imply it.
 *
 * The bars grow from the baseline when the card is scrolled to — the same
 * moment the Roll graph draws itself, for the same reason.
 */

import { motion } from 'framer-motion'
import type { StreetCost } from '@/lib/deepCoach'

export function StreetCosts({ streets }: { streets: StreetCost[] }) {
  const worst = Math.max(...streets.map((s) => s.bbPer100), 0.1)

  return (
    <div className="mt-4 flex flex-col gap-3">
      {streets.map((street, i) => (
        <div key={street.street} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-xs capitalize text-muted-foreground">
            {street.street}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {/* Grows from a single baseline, capped thin, rounded at the data
                end and square at the baseline. */}
            <motion.div
              className="h-2.5 origin-left rounded-r-sm bg-suit-red"
              style={{ width: `${Math.max(2, (street.bbPer100 / worst) * 100)}%` }}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.06 * i }}
            />
            <motion.span
              className="shrink-0 text-xs font-medium tabular-nums"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.3, delay: 0.06 * i + 0.35 }}
            >
              {street.bbPer100.toFixed(1)}
            </motion.span>
          </div>
          <span className="w-20 shrink-0 text-right text-2xs tabular-nums text-muted-foreground/70">
            {street.right} of {street.settled}
          </span>
        </div>
      ))}
    </div>
  )
}
