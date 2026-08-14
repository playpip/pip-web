'use client'

import { useState } from 'react'
import { type BetSizeId, PRICE_TAP_SIZES, betSizes, pct, requiredEquity } from '@/config/potOdds'
import { cn } from '@/lib/utils'

/** The pot every size is measured against, so the six prices compare. */
const POT = 100

const SIZES = betSizes(PRICE_TAP_SIZES)

/** Opens on the half-pot bet, which is the size the guide calls the default. */
const OPENS_ON: BetSizeId = 'half'

/**
 * Pot odds are not worked out at the table, they are remembered, and there are
 * six of them. So this is the table above it with one row lit at a time: tap a
 * size and it draws the pot you are calling into, with your call as a slice of
 * it, and that slice is the price.
 *
 * The bar is the arithmetic rather than a picture of it. The lit segment is
 * your call over the final pot, which is what requiredEquity() computes, so the
 * number in large type is the width of the thing above it and cannot be a
 * different figure from it.
 *
 * Fixed sizes, no calculator, no free entry, no score, nothing remembered.
 */
export function WhatItCosts() {
  const [id, setId] = useState<BetSizeId>(OPENS_ON)

  const size = SIZES.find((s) => s.id === id)!
  const bet = POT * size.fraction
  const finalPot = POT + 2 * bet
  const price = requiredEquity(size.fraction)

  return (
    <section
      // Interactive, so gen-llms.mjs keeps it out of the Markdown mirrors: the
      // table above it is the same six prices in a form that reads as text.
      data-mirror="skip"
      className="mt-9 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">What it costs to call</h3>
        <span className="text-xs text-muted-foreground tabular-nums">Pot {POT}</span>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        Six prices, and they never change. Tap one.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SIZES.map((option) => (
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
            {option.label}
          </button>
        ))}
      </div>

      <p className="mt-5 text-5xl font-semibold tabular-nums leading-none">{pct(price)}%</p>
      <p className="mt-2 text-sm text-muted-foreground">
        is how often you have to win for this call to make money.
      </p>

      <div className="mt-5">
        {/*
          No gaps between the segments: they are shares of one pot and they have
          to add to it, and a flex gap would take its space out of the widths,
          which is the one thing on this widget that has to stay exact.
        */}
        <div className="flex h-3 overflow-hidden rounded-full bg-foreground/[0.07]">
          <Segment share={POT / finalPot} className="bg-foreground/[0.12]" />
          <Segment share={bet / finalPot} className="bg-foreground/30" />
          <Segment share={bet / finalPot} className="bg-primary" />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-3">
          <Figure term="In the pot" value={POT} />
          <Figure term="They bet" value={bet} />
          <Figure term="You call" value={bet} lit />
        </dl>
      </div>

      <div className="mt-5 border-t border-foreground/10 pt-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          You are paying <span className="font-medium text-foreground tabular-nums">{bet}</span>{' '}
          into a pot that will be{' '}
          <span className="font-medium text-foreground tabular-nums">{finalPot}</span> once you have
          called. The lit slice is your call as a share of that pot, which is the {pct(price)}%
          above it. Divide by the pot as it stands instead and you get a friendlier number that is
          not the price of anything.
        </p>
      </div>
    </section>
  )
}

function Segment({ share, className }: { share: number; className: string }) {
  return <div className={className} style={{ width: `${share * 100}%` }} />
}

function Figure({ term, value, lit }: { term: string; value: number; lit?: boolean }) {
  return (
    <div>
      <dt className={cn('text-xs', lit ? 'text-foreground' : 'text-muted-foreground')}>{term}</dt>
      <dd className="mt-0.5 text-md font-medium tabular-nums">{value}</dd>
    </div>
  )
}
