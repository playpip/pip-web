'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { PlayingCard } from '@/components/PlayingCard'
import { BEST_FIVE, toCards } from '@/config/learnExamples'
import { cardName } from '@/lib/poker/cards'
import { cn } from '@/lib/utils'

/**
 * Which five of the seven cards play. The reader taps five, and on the fifth
 * the widget shows the five the evaluator would have used and names the hand.
 *
 * The same tap-and-reveal shape as WhoWins, and the same line: fixed spots,
 * nothing generated, no score counted and nothing remembered between visits.
 * It illustrates what the section above it already says in prose.
 */
export function BestFive() {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const spot = BEST_FIVE[index]
  const revealed = picked.length === 5
  // Order does not matter, only which five. Both lists are five long here.
  const correct = revealed && spot.best.every((card) => picked.includes(card))

  const toggle = (card: string) => {
    if (revealed) return
    setPicked((current) =>
      current.includes(card) ? current.filter((c) => c !== card) : [...current, card],
    )
  }

  const next = () => {
    setPicked([])
    setIndex((i) => (i + 1) % BEST_FIVE.length)
  }

  return (
    <section
      // Interactive, so gen-llms.mjs keeps it out of the Markdown mirrors: the
      // cards would arrive as a column of loose glyphs and the prose above
      // already makes the point.
      data-mirror="skip"
      className="mt-9 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">Which five cards play?</h3>
        <span className="text-xs text-muted-foreground">
          {index + 1} of {BEST_FIVE.length}
        </span>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        Seven cards are available to you. Tap the five that make your hand.
      </p>

      <div className="mt-5 space-y-4">
        <CardRow
          label="Your cards"
          codes={spot.hole}
          picked={picked}
          best={spot.best}
          revealed={revealed}
          onPick={toggle}
        />
        <CardRow
          label="The board"
          codes={spot.board}
          picked={picked}
          best={spot.best}
          revealed={revealed}
          onPick={toggle}
        />
      </div>

      {!revealed && (
        <p className="mt-4 text-xs text-muted-foreground tabular-nums">
          {picked.length} of 5 picked
          {picked.length > 0 ? ' · tap one again to change your mind' : ''}
        </p>
      )}

      {revealed && (
        <div className="mt-5 border-t border-foreground/10 pt-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5 shrink-0 text-emerald-500" />
            The ringed cards are the five that play.
          </p>
          <p className="mt-3 text-sm font-medium">
            {correct ? 'That’s it.' : 'Not those five.'}{' '}
            <span className="font-normal text-muted-foreground">{spot.hand}.</span>
          </p>
          <p className="mt-2 text-md leading-relaxed text-muted-foreground">{spot.why}</p>
          <button
            type="button"
            onClick={next}
            className="mt-4 rounded-xl bg-foreground/[0.06] px-4 py-2 text-sm font-medium transition hover:bg-foreground/[0.12] active:scale-[0.98]"
          >
            Try another
          </button>
        </div>
      )}
    </section>
  )
}

function CardRow({
  label,
  codes,
  picked,
  best,
  revealed,
  onPick,
}: {
  label: string
  codes: string[]
  picked: string[]
  best: string[]
  revealed: boolean
  onPick: (card: string) => void
}) {
  return (
    <div>
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {codes.map((code) => {
          const card = toCards([code])[0]
          const chosen = picked.includes(code)
          const plays = best.includes(code)
          return (
            <button
              key={code}
              type="button"
              onClick={() => onPick(code)}
              disabled={revealed}
              aria-pressed={chosen}
              aria-label={cardName(card)}
              className={cn(
                'rounded-lg ring-offset-2 ring-offset-background transition',
                !revealed && 'hover:-translate-y-0.5 active:scale-[0.97]',
                chosen && !revealed && 'ring-2 ring-foreground',
                revealed && plays && 'ring-2 ring-emerald-500',
                revealed && !plays && 'opacity-40',
              )}
            >
              <PlayingCard card={card} size="sm" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
