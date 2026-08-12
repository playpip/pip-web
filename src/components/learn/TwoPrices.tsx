'use client'

import { useState } from 'react'
import { BET_SIZES, TWO_PRICE_SIZES, breakevenFolds, pct, requiredEquity } from '@/config/potOdds'
import { cn } from '@/lib/utils'

/** The pot every figure here is measured against. Fixed, so the sizes compare. */
const POT = 100

/**
 * A bet sets two prices at once, and the table above this widget prints them in
 * separate columns, which is where the point gets lost. Here they sit side by
 * side and both move as you change the size: bigger charges them more and puts
 * more of the work on your bluff.
 *
 * Both figures are computed from the size, never typed, so a size cannot be
 * added with a wrong number under it, and the widget cannot disagree with the
 * table it sits under. Fixed sizes, no score, nothing remembered.
 */
export function TwoPrices() {
  const [id, setId] = useState(TWO_PRICE_SIZES[1].id)

  const chosen = TWO_PRICE_SIZES.find((size) => size.id === id)!
  const size = BET_SIZES.find((s) => s.id === id)!
  const bet = POT * size.fraction

  return (
    <section
      // Interactive, so gen-llms.mjs keeps it out of the Markdown mirrors: the
      // table above it is the same arithmetic in a form that reads as text.
      data-mirror="skip"
      className="mt-9 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">The two prices</h3>
        <span className="text-xs text-muted-foreground tabular-nums">Pot {POT}</span>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        Pick a size. Both figures are what that size costs, one to them and one to you.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TWO_PRICE_SIZES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setId(option.id)}
            aria-pressed={option.id === id}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm font-medium transition',
              option.id === id
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-foreground/10 text-muted-foreground hover:border-foreground/25 hover:text-foreground active:scale-[0.99]',
            )}
          >
            {BET_SIZES.find((s) => s.id === option.id)!.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        You bet <span className="font-medium text-foreground tabular-nums">{bet}</span> into{' '}
        <span className="font-medium text-foreground tabular-nums">{POT}</span>.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Price
          heading="They need to win"
          value={pct(requiredEquity(size.fraction))}
          caption="to call and break even"
        />
        <Price
          heading="They must fold"
          value={pct(breakevenFolds(size.fraction))}
          caption="for a bluff to break even"
        />
      </div>

      <div className="mt-5 border-t border-foreground/10 pt-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{chosen.note}</p>
      </div>
    </section>
  )
}

function Price({ heading, value, caption }: { heading: string; value: string; caption: string }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
      <p className="text-xs text-muted-foreground">{heading}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums leading-none">{value}%</p>
      <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
    </div>
  )
}
