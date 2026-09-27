'use client'

// The transport under a replayed hand: a seekable track of beats, a step
// either way, and one big play button. Shared by the /hand permalink and the
// session review — the controls are the same job on both, and a hand that
// scrubbed differently depending on which screen it was on would be a small
// lie about what a beat is.

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Replay } from './useReplay'

export function Transport({
  replay,
  className,
  /** Beats worth marking on the track — the hero's priced decisions. */
  marks = [],
}: {
  replay: Replay
  className?: string
  marks?: number[]
}) {
  const { step, total, playing, finished, toggle, seek } = replay
  if (total === 0) return null
  const marked = new Set(marks)

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="flex w-full max-w-xs items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Jump to move ${i + 1}`}
            onClick={() => seek(i + 1)}
            className={cn(
              'group relative h-1.5 flex-1 rounded-full transition-colors',
              i < step ? 'bg-pip' : 'bg-foreground/10 hover:bg-foreground/25',
            )}
          >
            {/* A decision the review has something to say about, marked on the
                track so it can be scrubbed to rather than hunted for. */}
            {marked.has(i) && (
              <span className="absolute -top-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-foreground/70" />
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2.5">
        <StepButton onClick={() => seek(step - 1)} disabled={step === 0} aria-label="Back">
          <ChevronLeft className="size-4" />
        </StepButton>

        <button
          type="button"
          onClick={toggle}
          aria-label={finished ? 'Replay' : playing ? 'Pause' : 'Play'}
          className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/10 transition hover:bg-primary/90 active:scale-95 dark:shadow-black/40"
        >
          {finished ? (
            <RotateCcw className="size-5" />
          ) : playing ? (
            <Pause className="size-5 fill-current" />
          ) : (
            <Play className="size-5 fill-current" />
          )}
        </button>

        <StepButton onClick={() => seek(step + 1)} disabled={finished} aria-label="Next">
          <ChevronRight className="size-4" />
        </StepButton>
      </div>
    </div>
  )
}

export function StepButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'flex size-10 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.03] text-muted-foreground transition hover:bg-foreground/10 active:scale-95 disabled:pointer-events-none disabled:opacity-30',
        className,
      )}
    />
  )
}
