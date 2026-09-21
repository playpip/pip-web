'use client'

/**
 * "Says who?" — the hands behind a finding, played back.
 *
 * A report that asserts is a report you either believe or you do not. This is
 * the other kind: the worst hands the claim actually happened in, each one
 * replayable, with the verdict it was given at the time.
 *
 * **Compact on purpose, unlike the session review.** These hands come back out
 * of a `/hand` token (lib/review/stats), which carries the action, the board
 * and what was shown — and not the stacks, the pot or the hands that mucked.
 * Drawing the full table for them would be drawing mostly empty seats, so this
 * shows what the token actually holds: the board, your cards, the play-by-play.
 */

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DealtCard, PlayingCard } from '@/components/PlayingCard'
import { HandTimeline } from '@/components/HandTimeline'
import { StepButton, Transport } from '@/components/replay/Transport'
import { narrate, useReplay } from '@/components/replay/useReplay'
import { decodeHand } from '@/lib/handLink'
import type { EvidenceHand } from '@/lib/review/stats'
import { formatChips, useMoney } from '@/lib/useMoney'
import type { HandRecord } from '@/store/game'

export function EvidenceDialog({
  open,
  onOpenChange,
  title,
  hands,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The finding these hands are evidence for. */
  title: string
  hands: readonly EvidenceHand[]
}) {
  const [at, setAt] = useState(0)
  // A token that no longer decodes is dropped rather than shown as an error:
  // it would mean a wire-format change, and a broken row of a proof is not
  // worth explaining to somebody who asked to see a hand.
  const decoded = useMemo(
    () =>
      hands
        .map((h) => ({ line: h.line, record: decodeHand(h.token) }))
        .filter((h): h is { line: string; record: HandRecord } => h.record !== null),
    [hands],
  )
  const current = decoded[Math.min(at, decoded.length - 1)]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {decoded.length > 0
              ? `The ${decoded.length === 1 ? 'hand' : `${decoded.length} hands`} this cost you the most in.`
              : 'No hand has been kept for this one yet.'}
          </DialogDescription>
        </DialogHeader>

        {current && (
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            <EvidenceHandView key={at} record={current.record} line={current.line} />
            {decoded.length > 1 && (
              <div className="flex items-center justify-center gap-3">
                <StepButton
                  onClick={() => setAt((i) => Math.max(0, i - 1))}
                  disabled={at === 0}
                  aria-label="Previous hand"
                >
                  <ChevronLeft className="size-4" />
                </StepButton>
                <span className="text-2xs tabular-nums text-muted-foreground">
                  {at + 1} of {decoded.length}
                </span>
                <StepButton
                  onClick={() => setAt((i) => Math.min(decoded.length - 1, i + 1))}
                  disabled={at >= decoded.length - 1}
                  aria-label="Next hand"
                >
                  <ChevronRight className="size-4" />
                </StepButton>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EvidenceHandView({ record, line }: { record: HandRecord; line: string }) {
  const money = useMoney()
  const replay = useReplay(record, { opens: 'end' })
  const { step, community, current, reduce } = replay
  const hero = record.reveals.find((r) => r.playerId === 'hero')
  const CardTag = reduce ? PlayingCard : DealtCard

  return (
    <div className="flex flex-col gap-3">
      <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground/70 tabular-nums">
        Hand #{record.handNo} · Blinds {money(record.smallBlind)}/{money(record.bigBlind)}
      </p>

      <div className="flex min-h-[4.75rem] items-center justify-center gap-1.5">
        {community.length > 0 ? (
          community.map((card, i) => <CardTag key={i} index={i} card={card} size="sm" />)
        ) : (
          <span className="text-2xs uppercase tracking-[0.3em] text-muted-foreground/40">
            Pre-flop
          </span>
        )}
      </div>

      {hero && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-1.5">
            {hero.cards.map((card, i) => (
              <PlayingCard key={i} card={card} size="sm" />
            ))}
          </div>
          <span className="text-2xs text-muted-foreground/70">{hero.handName ?? 'Your hand'}</span>
        </div>
      )}

      <p className="min-h-5 text-center text-sm font-medium tabular-nums">
        {narrate(current, formatChips)}
      </p>

      <Transport replay={replay} />

      <p className="rounded-2xl bg-foreground/[0.03] px-4 py-3 text-center text-sm">{line}</p>

      <details className="group">
        <summary className="cursor-pointer list-none text-2xs uppercase tracking-[0.2em] text-muted-foreground/70 transition hover:text-foreground">
          Play-by-play
        </summary>
        <div className="mt-3 flex flex-col gap-1 rounded-2xl bg-foreground/[0.03] p-4">
          <HandTimeline record={record} />
        </div>
      </details>
      <span className="sr-only">{step}</span>
    </div>
  )
}
