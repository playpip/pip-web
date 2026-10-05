'use client'

// One real spot from Calling the river, under the answer to a tap on its
// padlock (playpip/cmo#178). The blurb above says what the pack is; this is
// the pack, one hand of it, dealt by the same generator and set on the same
// felt. Read-only: no answer buttons, because it is a look at the thing and
// not a free sample of it.
//
// Loaded on its own (`next/dynamic` in TappedFor), so the drill generator and
// its range model reach the browser only for somebody who tapped this padlock.

import { useState } from 'react'
import { Board, Felt, Holding, Pot, TalkLine } from '@/components/drills/felt'
import { Opponent, opponentFor } from '@/components/drills/riverSeat'
import { cardBackById } from '@/config/cardBacks'
import { riverSample } from '@/lib/drills/sample'
import { formatChips } from '@/lib/useMoney'
import { useProfile } from '@/store/profile'

export function TappedSpot() {
  const [drill] = useState(riverSample)
  const cardBack = cardBackById(useProfile((s) => s.cardBack))
  const opponent = opponentFor(drill)
  const hero = drill.hands?.[0]
  const stakes = drill.stakes

  return (
    <figure className="mt-5 rounded-xl border border-foreground/10 bg-background/60 py-4">
      <figcaption className="px-4 text-sm text-muted-foreground">
        One of the spots, as the pack deals it.
      </figcaption>
      <div className="mt-3 flex flex-col">
        <Felt
          across={
            <Opponent
              character={opponent}
              line={drill.line ?? []}
              cardBack={cardBack}
              dim={false}
            />
          }
          board={
            <>
              <Board cards={drill.board} slots={5} />
              {stakes && <Pot stakes={stakes} />}
              <TalkLine>{`${opponent.name} bets ${formatChips(stakes?.toCall ?? 0)}. Call or fold?`}</TalkLine>
            </>
          }
          hero={
            hero && (
              <Holding
                label="You"
                detail={hero.detail}
                cards={hero.cards}
                size="hero"
                layout="below"
              />
            )
          }
        />
      </div>
      <p className="mt-3 px-4 text-sm text-muted-foreground">
        Answer it in the pack and you see what they were betting with.
      </p>
    </figure>
  )
}
