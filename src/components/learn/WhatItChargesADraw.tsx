'use client'

import { useState } from 'react'
import { PlayingCard } from '@/components/PlayingCard'
import {
  CHARGED_DRAWS,
  type ChargedDraw,
  chargingBet,
  multiple,
  oneCardChance,
  pct,
} from '@/config/potOdds'
import { cardFromString } from '@/lib/poker/cards'
import { cn } from '@/lib/utils'

/** The pot the bet is drawn against, so the four bars compare. */
const POT = 100

/**
 * Charging a draw takes less than people think, right up until it takes more
 * than you have. A third of the pot already makes a bare flush draw a losing
 * call; against fifteen outs the bet that does it is nearly the whole pot,
 * which is the row this widget exists for and the one a table hides in a
 * column of decimals.
 *
 * The bar is the point: the threshold is drawn as a proportion of the pot
 * rather than only printed as a number, so the fifteen-out row is visibly the
 * odd one out rather than one more decimal on a list.
 *
 * Every figure comes off the out count via chargingBet() and oneCardChance(),
 * the same functions the table above prints, and the boards are the ones
 * tests/guideWidgets.test.ts counts card by card through the evaluator. Fixed
 * draws, no score, nothing remembered between visits.
 */
export function WhatItChargesADraw() {
  // Opens on the flush draw, which is the one the section's headline claim is
  // about: a third of the pot already makes it a losing call.
  const [id, setId] = useState('flush')

  const draw = CHARGED_DRAWS.find((d) => d.id === id)!
  const threshold = chargingBet(draw.outs)
  const bet = Math.round(POT * threshold)

  return (
    <section
      // Interactive, so gen-llms.mjs keeps it out of the Markdown mirrors: the
      // table above it is the same four thresholds as text.
      data-mirror="skip"
      className="mt-9 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">What it takes to charge them</h3>
        <span className="text-xs text-muted-foreground tabular-nums">Pot {POT}</span>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        Pick the draw they have. The bar is the smallest bet that makes calling it wrong.
      </p>

      <div className="mt-4 space-y-2">
        {CHARGED_DRAWS.map((option) => (
          <Row
            key={option.id}
            draw={option}
            selected={option.id === id}
            onPick={() => setId(option.id)}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4">
        <Hand label="They have" codes={draw.hero} />
        <Hand label="The flop" codes={draw.board} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4">
        <Fact term="They get there on the next card" value={`${pct(oneCardChance(draw.outs))}%`} />
        <Fact term="The bet that makes calling wrong" value={`${multiple(threshold)}x the pot`} />
      </dl>

      <div className="mt-4">
        <div className="h-3 overflow-hidden rounded-full bg-foreground/[0.07]">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(threshold, 1) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The bar is the pot. The fill is the bet.
        </p>
      </div>

      <div className="mt-5 border-t border-foreground/10 pt-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Bet <span className="font-medium text-foreground tabular-nums">{bet}</span> into{' '}
          <span className="font-medium text-foreground tabular-nums">{POT}</span> and calling with{' '}
          {draw.outs} outs stops paying for one card. Anything smaller and they are right to call,
          which is not the same as saying you should bet bigger: what you charge them after the call
          still counts, and so do the streets after they hit.
        </p>
      </div>
    </section>
  )
}

function Row({
  draw,
  selected,
  onPick,
}: {
  draw: ChargedDraw
  selected: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-baseline justify-between gap-3 rounded-xl border px-4 py-2.5 text-left transition',
        selected
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'border-foreground/10 text-muted-foreground hover:border-foreground/25 hover:text-foreground active:scale-[0.99]',
      )}
    >
      <span className="text-sm font-medium">{draw.label}</span>
      <span className="shrink-0 text-xs tabular-nums">{draw.outs} outs</span>
    </button>
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

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="mt-0.5 text-md font-medium tabular-nums">{value}</dd>
    </div>
  )
}
