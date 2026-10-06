'use client'

// One real spot from the paid drill somebody tapped, under the answer to that
// tap: the same felt the drill is played on, dealt by the drill's own
// generator at a fixed seed. Read-only, like the river's (`TappedSpot`): no
// answer buttons, because it is a look at the thing and not a free sample of
// it.
//
// Loaded on its own (`next/dynamic` in TappedFor), so the drill generators
// reach the browser only for somebody who tapped a locked drill.

import { useState } from 'react'
import { Board, Felt, Holding, Pot, TalkLine } from '@/components/drills/felt'
import type { DrillKind } from '@/config/drills'
import { drillSample } from '@/lib/drills/sample'

export function TappedDrillSpot({ kind }: { kind: DrillKind }) {
  const [drill] = useState(() => drillSample(kind.id))
  // Hands that are the answer ("Who gets there?") sit across the table the
  // way the drill draws them; otherwise the first holding is yours and any
  // other is theirs.
  const choiceHands = drill.choices.filter((c) => c.cards.length > 1)
  const [hero, ...rest] = drill.hands ?? []
  const across = choiceHands.length > 0 ? choiceHands : rest

  return (
    <figure className="mt-5 rounded-xl border border-foreground/10 bg-background/60 py-4">
      <figcaption className="px-4 text-sm text-muted-foreground">
        One of the spots, as the drill deals it.
      </figcaption>
      <div className="mt-3 flex flex-col">
        <Felt
          across={
            across.length > 0
              ? across.map((hand) => (
                  <Holding key={hand.label} label={hand.label} cards={hand.cards} />
                ))
              : undefined
          }
          board={
            <>
              <Board cards={drill.board} slots={kind.boardCards} />
              {drill.stakes && <Pot stakes={drill.stakes} />}
              <TalkLine>{kind.question}</TalkLine>
            </>
          }
          hero={
            hero && (
              <Holding
                label={hero.label}
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
        Answer it in the drill and it shows you why.
      </p>
    </figure>
  )
}
