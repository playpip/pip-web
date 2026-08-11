'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { CAN_YOU_CHECK } from '@/config/learnExamples'
import { cn } from '@/lib/utils'

/**
 * Yes or no: can you check here? The most common first-night mistake, and the
 * answer is one rule, so three situations and a two-button choice is the whole
 * widget. No cards in it.
 *
 * Fixed situations, no score, nothing remembered — the same line as the other
 * guide interactions.
 */
export function CanYouCheck() {
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<boolean | null>(null)
  const example = CAN_YOU_CHECK[index]
  const revealed = answer !== null
  const correct = answer === example.canCheck

  const next = () => {
    setAnswer(null)
    setIndex((i) => (i + 1) % CAN_YOU_CHECK.length)
  }

  return (
    <section
      // Interactive, so gen-llms.mjs keeps it out of the Markdown mirrors.
      data-mirror="skip"
      className="mt-9 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">Can you check?</h3>
        <span className="text-xs text-muted-foreground">
          {index + 1} of {CAN_YOU_CHECK.length}
        </span>
      </div>

      <p className="mt-3 text-md leading-relaxed">{example.situation}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Choice
          label="Yes"
          onPick={() => !revealed && setAnswer(true)}
          revealed={revealed}
          right={example.canCheck}
          chosen={answer === true}
        />
        <Choice
          label="No"
          onPick={() => !revealed && setAnswer(false)}
          revealed={revealed}
          right={!example.canCheck}
          chosen={answer === false}
        />
      </div>

      {revealed && (
        <div className="mt-5 border-t border-foreground/10 pt-4">
          <p className="flex items-start gap-2.5 text-md leading-relaxed text-muted-foreground">
            <span
              className={cn(
                'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
                correct ? 'bg-emerald-500/15 text-emerald-500' : 'bg-suit-red/15 text-suit-red',
              )}
            >
              {correct ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            </span>
            {example.verdict}
          </p>
          <button
            type="button"
            onClick={next}
            className="mt-4 rounded-xl bg-foreground/[0.06] px-4 py-2 text-sm font-medium transition hover:bg-foreground/[0.12] active:scale-[0.98]"
          >
            Next situation
          </button>
        </div>
      )}
    </section>
  )
}

function Choice({
  label,
  onPick,
  revealed,
  right,
  chosen,
}: {
  label: string
  onPick: () => void
  revealed: boolean
  /** Whether this button is the correct answer for the situation showing. */
  right: boolean
  chosen: boolean
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={revealed}
      aria-pressed={chosen}
      className={cn(
        'rounded-xl border px-4 py-2.5 text-sm font-medium transition',
        revealed && right
          ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
          : 'border-foreground/10 text-muted-foreground',
        revealed && !right && 'opacity-60',
        !revealed && 'hover:border-foreground/25 hover:text-foreground active:scale-[0.99]',
      )}
    >
      {label}
    </button>
  )
}
