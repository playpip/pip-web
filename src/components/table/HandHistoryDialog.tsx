'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlayingCard } from '@/components/PlayingCard'
import { useGame, type HandEvent } from '@/store/game'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

/** Reviewable timeline of the last completed hand. */
export function HandHistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const record = useGame((s) => s.lastHand)
  const money = useMoney()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Last hand</DialogTitle>
          <DialogDescription>
            {record
              ? `Hand #${record.handNo} · Blinds ${money(record.smallBlind)}/${money(record.bigBlind)}`
              : 'Finish a hand to review it here.'}
          </DialogDescription>
        </DialogHeader>

        {record && (
          <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto pt-1">
            {record.events.map((event, i) => (
              <EventRow key={i} event={event} />
            ))}

            {record.reveals.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {record.reveals.map((r) => (
                  <div key={r.playerId} className="flex items-center gap-2.5">
                    <div className="flex gap-1">
                      {r.cards.map((card, i) => (
                        <PlayingCard key={i} card={card} size="xs" />
                      ))}
                    </div>
                    <span className="text-sm font-medium">{r.playerName}</span>
                    {r.handName && (
                      <span className="text-sm text-muted-foreground">{r.handName}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="mt-3 border-t border-foreground/10 pt-3 text-sm font-semibold">
              {record.summary}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EventRow({ event }: { event: HandEvent }) {
  const money = useMoney()

  if (event.kind === 'board') {
    return (
      <div className="mt-2 flex items-center gap-2.5 first:mt-0">
        <span className="w-14 shrink-0 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          {event.label}
        </span>
        <div className="flex gap-1">
          {event.cards.map((card, i) => (
            <PlayingCard key={i} card={card} size="xs" />
          ))}
        </div>
      </div>
    )
  }

  const verb =
    event.type === 'fold'
      ? 'folds'
      : event.type === 'check'
        ? 'checks'
        : event.type === 'call'
          ? `calls ${money(event.amount ?? 0)}`
          : event.type === 'bet'
            ? `bets ${money(event.amount ?? 0)}`
            : `raises to ${money(event.amount ?? 0)}`

  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={cn('truncate', event.playerId === 'hero' && 'font-medium')}>
        {event.playerName}
      </span>
      <span className={cn('shrink-0 tabular-nums', event.type === 'fold' ? 'text-muted-foreground/60' : 'text-muted-foreground')}>
        {verb}
      </span>
    </div>
  )
}
