'use client'

/**
 * Which hand you are looking at.
 *
 * A button that opens the list, rather than a list that is always open down the
 * side (Will, 2026-09-21). The rail cost a third of the width on a desktop and
 * did not fit a phone at all, and it was permanently visible for a job you do
 * once every few minutes. As a sheet it is one tap away and the table gets the
 * whole screen.
 *
 * The rows are the same ones the rail had: your cards, what the hand did to
 * your stack, and a dot for the worst thing the price found in it.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlayingCard } from '@/components/PlayingCard'
import { GRADE_DOTS } from './GradeChip'
import { isMistake } from '@/lib/review/grade'
import { handGrade, tallySession, type ReviewHand, type ReviewSession } from '@/lib/review/session'
import { highlightsOf } from '@/lib/review/highlights'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

export type HandFilter = 'all' | 'mistakes' | 'showdowns'

const FILTERS: { id: HandFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mistakes', label: 'Mistakes' },
  { id: 'showdowns', label: 'Showdowns' },
]

export function matchesFilter(hand: ReviewHand, filter: HandFilter): boolean {
  if (filter === 'mistakes') return hand.decisions.some((d) => isMistake(d.grade))
  if (filter === 'showdowns') {
    return hand.record.reveals.some((r) => r.playerId !== 'hero' && r.handName)
  }
  return true
}

export function HandPicker({
  open,
  onOpenChange,
  session,
  selected,
  filter,
  onFilter,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: ReviewSession
  selected: number
  filter: HandFilter
  onFilter: (filter: HandFilter) => void
  onPick: (index: number) => void
}) {
  const money = useMoney()
  const hands = session.hands
  const tally = tallySession(session)
  const highlights = highlightsOf(session, 4)
  const rows = hands
    .map((hand, index) => ({ hand, index }))
    .filter(({ hand }) => matchesFilter(hand, filter))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{session.venueName}</DialogTitle>
          <DialogDescription>
            {outcomeLine(session, money)} · {hands.length} hands
          </DialogDescription>
        </DialogHeader>

        {/* The session's numbers live here rather than on the felt: the felt is
            the hand, and a scoreboard over it is a second screen fighting the
            first. */}
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Chips" value={`${tally.chips > 0 ? '+' : ''}${money(tally.chips)}`} />
          <Tile
            label="Calls right"
            value={tally.priced > 0 ? `${tally.right} of ${tally.right + tally.wrong}` : '—'}
          />
          <Tile
            label="Given up"
            value={tally.bbGivenUp > 0 ? tally.bbGivenUp.toFixed(1) : '—'}
            sub={tally.bbGivenUp > 0 ? 'big blinds' : undefined}
          />
        </div>

        {highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {highlights.map((h) => (
              <button
                key={`${h.index}-${h.kind}`}
                type="button"
                onClick={() => {
                  onPick(h.index)
                  onOpenChange(false)
                }}
                className="rounded-full bg-foreground/[0.05] px-3 py-1.5 text-2xs font-medium transition hover:bg-foreground/[0.1]"
              >
                {h.label}
                <span className="ml-1.5 text-muted-foreground tabular-nums">#{h.index + 1}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition',
                filter === f.id
                  ? 'bg-foreground/[0.08] text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex max-h-[55vh] min-h-0 flex-col gap-1 overflow-y-auto pt-1">
          {rows.map(({ hand, index }) => {
            const hero = hand.record.reveals.find((r) => r.playerId === 'hero')
            const delta = hand.record.heroDelta ?? 0
            const grade = handGrade(hand)
            return (
              <button
                key={index}
                type="button"
                aria-current={index === selected}
                onClick={() => {
                  onPick(index)
                  onOpenChange(false)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition',
                  index === selected ? 'bg-foreground/[0.08]' : 'hover:bg-foreground/[0.04]',
                )}
              >
                <span className="w-6 shrink-0 text-2xs tabular-nums text-muted-foreground/70">
                  {index + 1}
                </span>
                <span className="flex shrink-0 gap-0.5">
                  {hero?.cards.map((card, i) => (
                    <PlayingCard key={i} card={card} size="xs" />
                  ))}
                </span>
                <span
                  className={cn(
                    'flex-1 text-right text-sm font-medium tabular-nums',
                    delta > 0
                      ? 'text-emerald-500'
                      : delta < 0
                        ? 'text-suit-red'
                        : 'text-muted-foreground',
                  )}
                >
                  {delta > 0 ? '+' : ''}
                  {money(delta)}
                </span>
                <span className="flex w-2 shrink-0 justify-center">
                  {grade && (
                    <span className={cn('size-1.5 rounded-full', GRADE_DOTS[grade.grade])} />
                  )}
                </span>
              </button>
            )
          })}
          {rows.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {filter === 'mistakes'
                ? 'Nothing in this session went the wrong side of the price.'
                : 'No hand here reached a showdown you saw.'}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-foreground/[0.04] px-3 py-2">
      <p className="text-3xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
      {/* The unit in words. "5.3bb" is a sentence in a language the reader may
          not speak (Will, 2026-09-21). */}
      {sub && <p className="text-3xs text-muted-foreground/70">{sub}</p>}
    </div>
  )
}

/** "Knocked out 4th of 6", "Stood up +1,240", "Still at the table". */
function outcomeLine(session: ReviewSession, money: (n: number) => string): string {
  const outcome = session.outcome
  if (!outcome) return 'Still at the table'
  if (outcome.kind === 'won') return 'You took it down'
  if (outcome.kind === 'busted') {
    return outcome.place
      ? `Knocked out ${ordinal(outcome.place)} of ${outcome.seats}`
      : 'Out of chips'
  }
  return `Stood up ${outcome.rollDelta >= 0 ? '+' : ''}${money(outcome.rollDelta)}`
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
