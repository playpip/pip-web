'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { PlayingCard } from '@/components/PlayingCard'
import { COMPARED_HANDS, COMPARED_SEATS, type Seat, opensHand } from '@/config/positions'
import { BAND_LABEL, HAND_BANDS, handCards } from '@/config/startingHands'
import type { Card } from '@/lib/poker/cards'
import { cn } from '@/lib/utils'

/**
 * A hand is not good or bad, it is good or bad from somewhere. So the same two
 * cards are drawn three times, once per seat, and the chart's verdict under
 * each: fold under the gun, fold in the middle, open on the button, for hands
 * that look identical in all three panels because they are identical.
 *
 * The verdicts are not a list. They come from opensHand(), which compares the
 * hand's band on /learn/starting-hands against the band the seat opens, so this
 * widget cannot disagree with that page: move a hand a band there and it moves
 * here. Fixed hands, no score, nothing remembered between visits.
 */
export function SameHandThreeSeats() {
  const [hand, setHand] = useState(COMPARED_HANDS[0])

  const band = HAND_BANDS[hand]
  const cards = handCards(hand)

  return (
    <section
      // Interactive, so gen-llms.mjs keeps it out of the Markdown mirrors: the
      // three panels would arrive as the word "Fold" twice with no cards in
      // front of them, and the table above the widget carries the bands.
      data-mirror="skip"
      className="mt-9 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight">The same hand, three seats</h3>
        <span className="text-xs text-muted-foreground">It folds round to you</span>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        The cards do not change between the panels. Only the seat does.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Starting hands">
        {COMPARED_HANDS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={option === hand}
            onClick={() => setHand(option)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
              option === hand
                ? 'bg-foreground text-background'
                : 'bg-foreground/[0.06] text-muted-foreground hover:bg-foreground/[0.12] hover:text-foreground',
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {COMPARED_SEATS.map((seat) => (
          <SeatVerdict key={seat.id} seat={seat} hand={hand} cards={cards} />
        ))}
      </div>

      <div className="mt-5 border-t border-foreground/10 pt-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          On the chart, <span className="font-medium text-foreground">{hand}</span> is{' '}
          <span className="font-medium text-foreground">
            {band ? BAND_LABEL[band] : 'not banded at all, which is a fold from every seat'}
          </span>
          . Every seat earlier than that folds it, and nothing about the two cards is different when
          it does.
        </p>
      </div>
    </section>
  )
}

function SeatVerdict({ seat, hand, cards }: { seat: Seat; hand: string; cards: readonly Card[] }) {
  const opens = opensHand(seat, hand)
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
      <p className="text-xs text-muted-foreground">{seat.name}</p>
      <div className="mt-2 flex gap-1.5">
        {cards.map((card) => (
          <PlayingCard key={`${card.rank}${card.suit}`} card={card} size="sm" />
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-md font-medium">
        <span
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-full',
            opens ? 'bg-emerald-500/15 text-emerald-500' : 'bg-suit-red/15 text-suit-red',
          )}
        >
          {opens ? <Check className="size-3.5" /> : <X className="size-3.5" />}
        </span>
        {opens ? 'Raise' : 'Fold'}
      </p>
    </div>
  )
}
