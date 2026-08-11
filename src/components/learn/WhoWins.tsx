'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { PlayingCard } from '@/components/PlayingCard'
import { WHO_WINS, toCards, type Outcome } from '@/config/learnExamples'
import { cn } from '@/lib/utils'

/**
 * A worked example from the guide, made tappable. Pick who you think takes it
 * and the answer explains itself.
 *
 * Deliberately not a drill: the spots are fixed and written, nothing is
 * generated, no score is counted and nothing is remembered between visits. It
 * illustrates what the prose above it already says, which is the line that
 * keeps the free guides free (see ../../marketing/strategy/monetisation.md).
 */
export function WhoWins() {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<Outcome | null>(null)
  const example = WHO_WINS[index]
  const revealed = picked !== null
  const correct = picked === example.answer

  const next = () => {
    setPicked(null)
    setIndex((i) => (i + 1) % WHO_WINS.length)
  }

  return (
    <section
      // Interactive, so it carries no meaning in the Markdown mirrors: the
      // cards would arrive as a column of loose glyphs. scripts/gen-llms.mjs
      // drops anything marked this way.
      data-mirror="skip"
      className="mt-9 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">Who wins?</h3>
        <span className="text-xs text-muted-foreground">
          {index + 1} of {WHO_WINS.length}
        </span>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        Same five cards on the table, two different hands. Have a guess.
      </p>

      <div className="mt-5">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          The board
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {toCards(example.board).map((card) => (
            <PlayingCard key={`${card.rank}${card.suit}`} card={card} size="sm" />
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <HandChoice
          label="Hand A"
          codes={example.a}
          onPick={() => !revealed && setPicked('a')}
          revealed={revealed}
          won={example.answer === 'a' || example.answer === 'split'}
          chosen={picked === 'a'}
        />
        <HandChoice
          label="Hand B"
          codes={example.b}
          onPick={() => !revealed && setPicked('b')}
          revealed={revealed}
          won={example.answer === 'b' || example.answer === 'split'}
          chosen={picked === 'b'}
        />
      </div>

      <button
        type="button"
        onClick={() => !revealed && setPicked('split')}
        disabled={revealed}
        className={cn(
          'mt-3 w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition',
          revealed && example.answer === 'split'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
            : 'border-foreground/10 text-muted-foreground',
          !revealed && 'hover:border-foreground/25 hover:text-foreground active:scale-[0.99]',
          revealed && example.answer !== 'split' && picked === 'split' && 'opacity-60',
        )}
      >
        They split it
      </button>

      {revealed && (
        <div className="mt-5 border-t border-foreground/10 pt-4">
          <p className="text-sm font-medium">
            {correct ? 'That’s it.' : 'Not this time.'}{' '}
            <span className="font-normal text-muted-foreground">
              {example.answer === 'split'
                ? 'The pot is split.'
                : `Hand ${example.answer.toUpperCase()} takes it.`}
            </span>
          </p>
          <p className="mt-2 text-md leading-relaxed text-muted-foreground">{example.why}</p>
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

function HandChoice({
  label,
  codes,
  onPick,
  revealed,
  won,
  chosen,
}: {
  label: string
  codes: string[]
  onPick: () => void
  revealed: boolean
  won: boolean
  chosen: boolean
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={revealed}
      aria-pressed={chosen}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 text-left transition',
        revealed && won
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : 'border-foreground/10 bg-background',
        revealed && !won && 'opacity-60',
        !revealed && 'hover:border-foreground/25 active:scale-[0.99]',
      )}
    >
      <span className="flex gap-1.5">
        {toCards(codes).map((card) => (
          <PlayingCard key={`${card.rank}${card.suit}`} card={card} size="sm" />
        ))}
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {revealed && won && <Check className="size-4 shrink-0 text-emerald-500" />}
      </span>
    </button>
  )
}
