'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { PlayingCard } from '@/components/PlayingCard'
import { ACE_RUNS, toCards } from '@/config/learnExamples'
import { cn } from '@/lib/utils'

/**
 * The ace rule, laid out to be compared rather than guessed at. Three runs,
 * one tap each, and the one that is not a straight sits in the same row as the
 * two that are — which is the whole point, since read as prose they all look
 * equally plausible.
 *
 * Something to poke, not practice: fixed content, no score, nothing stored.
 */
export function AceRuns() {
  const [index, setIndex] = useState(0)
  const run = ACE_RUNS[index]

  return (
    <div
      // Interactive, so gen-llms.mjs keeps it out of the Markdown mirrors.
      data-mirror="skip"
      className="mt-5 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5"
    >
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ace sequences">
        {ACE_RUNS.map((option, i) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium tabular-nums transition',
              i === index
                ? 'bg-foreground text-background'
                : 'bg-foreground/[0.06] text-muted-foreground hover:bg-foreground/[0.12] hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {toCards(run.cards).map((card) => (
          <PlayingCard key={`${card.rank}${card.suit}`} card={card} size="sm" />
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
            run.isStraight ? 'bg-emerald-500/15 text-emerald-500' : 'bg-suit-red/15 text-suit-red',
          )}
        >
          {run.isStraight ? <Check className="size-3.5" /> : <X className="size-3.5" />}
        </span>
        <p className="text-md leading-relaxed text-muted-foreground">{run.verdict}</p>
      </div>
    </div>
  )
}
