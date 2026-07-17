'use client'

// The reviewable timeline of a completed hand — shared by the last-hand dialog
// and the /hand permalink replay. Pass `limit` to show only the first N events
// (the replay steps through); reveals + summary appear once the timeline is done.

import { PlayingCard } from '@/components/PlayingCard'
import { nicknameFor } from '@/config/handNames'
import type { HandEvent, HandRecord } from '@/store/game'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

export function HandTimeline({ record, limit }: { record: HandRecord; limit?: number }) {
  const events = limit === undefined ? record.events : record.events.slice(0, limit)
  const done = limit === undefined || limit >= record.events.length

  return (
    <>
      {events.map((event, i) => (
        <EventRow key={i} event={event} />
      ))}

      {done && record.reveals.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {record.reveals.map((r) => {
            const nickname = nicknameFor(r.cards)
            return (
              <div key={r.playerId} className="flex items-center gap-2.5">
                <div className="flex gap-1">
                  {r.cards.map((card, i) => (
                    <PlayingCard key={i} card={card} size="xs" />
                  ))}
                </div>
                <span className="text-sm font-medium">{r.playerName}</span>
                {r.handName && <span className="text-sm text-muted-foreground">{r.handName}</span>}
                {nickname && (
                  <span className="truncate text-xs text-muted-foreground/60">{nickname}</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {done && record.summary && (
        <p className="mt-3 border-t border-foreground/10 pt-3 text-sm font-semibold">
          {record.summary}
        </p>
      )}
    </>
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
      <span
        className={cn(
          'shrink-0 tabular-nums',
          event.type === 'fold' ? 'text-muted-foreground/60' : 'text-muted-foreground',
        )}
      >
        {verb}
      </span>
    </div>
  )
}
