'use client'

import { useState } from 'react'
import { PlayingCard } from '@/components/PlayingCard'
import { WORKED_SPOTS, oneCardChance, pct, requiredEquity } from '@/config/potOdds'
import { cardFromString } from '@/lib/poker/cards'
import { cn } from '@/lib/utils'

/**
 * The one number people compare against a bet is the wrong one. Three bars on
 * one scale: the price the bet demands, the chance of getting there on the next
 * card, and the chance by the river. The verdict is judged against the one-card
 * bar, and in four of the five spots the by-river bar sits clear of the price
 * with the verdict still reading fold.
 *
 * That contradiction is the entire point of the section above, so it is drawn
 * and left alone rather than explained away in the layout.
 *
 * Every figure is computed: the price from requiredEquity(), one card from the
 * out count, and the by-river number is the spot's own equity, which is
 * exhaustive over all 990 runouts and re-checked by tests/guideClaims.test.ts.
 * Fixed spots, no score, nothing remembered between visits.
 */
export function ThePrice() {
  const [index, setIndex] = useState(0)
  const spot = WORKED_SPOTS[index]

  const pot = 100
  const bet = pot * spot.betFraction
  const price = requiredEquity(spot.betFraction) * 100
  const oneCard = oneCardChance(spot.outs) * 100
  const byRiver = spot.equity
  const call = oneCard > price

  return (
    <section
      // Interactive, so gen-llms.mjs keeps it out of the Markdown mirrors. The
      // bars would arrive as three loose percentages and the table above the
      // widget already carries the numbers.
      data-mirror="skip"
      className="mt-9 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">One card, or two?</h3>
        <span className="text-xs text-muted-foreground">
          {index + 1} of {WORKED_SPOTS.length}
        </span>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        The same spot priced both ways. Only one of them is the one you are being offered.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4">
        <Hand label="You have" codes={spot.hero} />
        <Hand label="The flop" codes={spot.flop} />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        There is <span className="font-medium text-foreground tabular-nums">{pot}</span> in the pot
        and they bet <span className="font-medium text-foreground tabular-nums">{bet}</span>.
      </p>

      <div className="mt-5 space-y-3.5">
        <Bar label="The price this bet sets" value={price} tone="price" />
        <Bar label="You get there on one card" value={oneCard} tone={call ? 'good' : 'bad'} />
        <Bar label="You get there by the river" value={byRiver} tone="muted" />
      </div>

      <div className="mt-5 border-t border-foreground/10 pt-4">
        <p className="text-md font-medium">
          {call ? 'A call.' : 'A fold.'}{' '}
          <span className="font-normal text-muted-foreground">
            Measured against the one-card bar, because that is the card this bet buys you.
          </span>
        </p>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{spot.note}</p>
        <button
          type="button"
          onClick={() => setIndex((i) => (i + 1) % WORKED_SPOTS.length)}
          className="mt-4 rounded-xl bg-foreground/[0.06] px-4 py-2 text-sm font-medium transition hover:bg-foreground/[0.12] active:scale-[0.98]"
        >
          Next spot
        </button>
      </div>
    </section>
  )
}

function Hand({ label, codes }: { label: string; codes: readonly string[] }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex gap-1.5">
        {codes.map((code) => (
          <PlayingCard key={code} card={cardFromString(code)} size="sm" />
        ))}
      </div>
    </div>
  )
}

/**
 * One bar on a fixed 0 to 100 scale. Fixed, not fitted to the largest value:
 * the three bars only mean anything next to each other, and a scale that
 * stretches to the biggest number would flatter every small one.
 */
function Bar({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'price' | 'good' | 'bad' | 'muted'
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium tabular-nums">{pct(value / 100)}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/[0.07]">
        <div
          className={cn(
            'h-full rounded-full',
            tone === 'price' && 'bg-foreground/45',
            tone === 'good' && 'bg-emerald-500',
            tone === 'bad' && 'bg-suit-red',
            tone === 'muted' && 'bg-foreground/20',
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}
