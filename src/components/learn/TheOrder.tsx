'use client'

import { useState } from 'react'
import {
  SEATS,
  SEATS_AT_A_TABLE,
  type Seat,
  playersBehind,
  postflopPlace,
  preflopPlace,
} from '@/config/positions'
import { type Band, cumulativeShare } from '@/config/startingHands'
import { cn } from '@/lib/utils'

/**
 * Position is an order, not a label, and the order is different before and
 * after the flop. Every static diagram of a table hides that. This one
 * renumbers: flip the toggle with the button selected and it walks from fourth
 * of six to last while the blinds go from last to first.
 *
 * Both orders come out of src/config/positions.ts, which computes them from the
 * rule the engine follows and is checked against a real six-handed hand in
 * tests/positions.test.ts. If the engine's order ever moves, this widget fails
 * the gate rather than quietly teaching the wrong thing.
 *
 * Fixed seats, no score, nothing remembered between visits.
 */
export function TheOrder() {
  const [selected, setSelected] = useState('btn')
  const [postflop, setPostflop] = useState(false)

  const seat = SEATS.find((s) => s.id === selected)!
  const place = postflop ? postflopPlace(seat) : preflopPlace(seat)

  return (
    <section
      // Interactive, so gen-llms.mjs keeps it out of the Markdown mirrors: the
      // ring would arrive as six loose seat names, and the table above the
      // widget is the same data in a form that reads as text.
      data-mirror="skip"
      className="mt-9 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">Who acts when</h3>
        <span className="text-xs text-muted-foreground">Six-handed</span>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        Tap a seat, then flip the toggle. The numbers are the betting order.
      </p>

      <div className="mt-4 flex rounded-xl border border-foreground/10 p-1">
        <Toggle label="Before the flop" on={!postflop} onPick={() => setPostflop(false)} />
        <Toggle label="After the flop" on={postflop} onPick={() => setPostflop(true)} />
      </div>

      <div className="relative mx-auto mt-5 aspect-[7/5] w-full max-w-sm">
        <div className="absolute inset-x-[18%] inset-y-[22%] rounded-[50%] border border-foreground/10 bg-foreground/[0.04]" />
        {SEATS.map((s) => (
          <SeatChip
            key={s.id}
            seat={s}
            place={postflop ? postflopPlace(s) : preflopPlace(s)}
            selected={s.id === selected}
            onPick={() => setSelected(s.id)}
          />
        ))}
      </div>

      <div className="mt-5 border-t border-foreground/10 pt-4">
        <p className="text-md font-medium">
          {seat.name} acts {ordinal(place)} of {SEATS_AT_A_TABLE}{' '}
          {postflop ? 'from the flop onwards' : 'before the flop'}.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-4">
          <Fact term="Still to act after it, preflop" value={String(playersBehind(seat))} />
          <Fact term="Hands it opens" value={opensLabel(seat.opens)} />
        </dl>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{noteFor(seat)}</p>
      </div>
    </section>
  )
}

/**
 * Where each seat sits in the box, keyed by its offset from the button, so the
 * ring is drawn from the same field the two orders are computed from. The
 * button is at the bottom and the seats run anticlockwise on screen, which is
 * the direction the action moves round a real table.
 */
const RING: Record<number, { left: string; top: string }> = {
  0: { left: '50%', top: '89%' },
  1: { left: '13%', top: '69%' },
  2: { left: '13%', top: '25%' },
  3: { left: '50%', top: '6%' },
  4: { left: '87%', top: '25%' },
  5: { left: '87%', top: '69%' },
}

function SeatChip({
  seat,
  place,
  selected,
  onPick,
}: {
  seat: Seat
  place: number
  selected: boolean
  onPick: () => void
}) {
  const spot = RING[seat.offset]
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label={`${seat.name}, ${ordinal(place)} to act`}
      style={{ left: spot.left, top: spot.top }}
      className={cn(
        'absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border px-3 py-1.5 transition',
        selected
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'border-foreground/10 bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground active:scale-[0.98]',
      )}
    >
      <span className="text-lg font-semibold tabular-nums leading-none">{place}</span>
      <span className="mt-1 text-xs font-medium leading-none">{seat.short}</span>
    </button>
  )
}

function Toggle({ label, on, onPick }: { label: string; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      className={cn(
        'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition',
        on ? 'bg-foreground/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
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

const ordinal = (place: number): string =>
  ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][place - 1]

/**
 * The blinds get a dash rather than a number. The chart is an opening chart and
 * a blind is not opening, it is defending, so a percentage there would be an
 * answer to a question nobody asked.
 */
const opensLabel = (band: Band | null): string =>
  band === null ? '–' : `${Math.round(cumulativeShare(band))}%`

/**
 * The line under the seat. Three cases and no per-seat copy: the button, the
 * two blinds, and everyone else, who all move the same two places later once
 * the flop is out.
 */
function noteFor(seat: Seat): string {
  if (seat.id === 'btn') {
    return 'The button is fourth of six before the flop and last on every street after it. Three streets out of four, and they are the ones where the pot is big.'
  }
  if (seat.opens === null) {
    return 'The blinds act last before the flop and first after it. They pay for one and hand back the other, which is why they are the seats where money is lost.'
  }
  return 'Every seat but the blinds slides two places later once the flop is out, because the two seats that were behind it are now in front.'
}
