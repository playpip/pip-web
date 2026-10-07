'use client'

// One real spot from the paid drill somebody tapped, under the answer to that
// tap: the same felt or table the drill is played on, dealt by the drill's own
// generator at a fixed seed. Read-only, like the river's (`TappedSpot`): no
// answer buttons, because it is a look at the thing and not a free sample of
// it.
//
// The three packs that play on a table get their own: open-or-fold and
// shove-or-fold the six-seat table with everybody before you folded, and
// bet-or-check the regular across with what happened on each street. Each is
// drawn with the pack's own seats and words, so the spot here is the spot
// there.
//
// Loaded on its own (`next/dynamic` in TappedFor), so the drill generators
// reach the browser only for somebody who tapped a locked drill.

import { useMemo, useState } from 'react'
import { BetOpponent, betOpponentFor } from '@/components/drills/BetPack'
import { Board, Felt, Holding, Pot, TalkLine } from '@/components/drills/felt'
import { OPEN_WHERE, openFaces } from '@/components/drills/OpenPack'
import { shoveFaces } from '@/components/drills/ShovePack'
import { SceneTable } from '@/components/lessons/SceneTable'
import { cardBackById } from '@/config/cardBacks'
import { BET_PACK_ID, type DrillKind, OPEN_PACK_ID, SHOVE_PACK_ID } from '@/config/drills'
import type { SeatId } from '@/config/positions'
import { SHOVE_WHERE, shoveTable } from '@/lib/drills/shoveOrFold'
import type { ShoveSeat } from '@/lib/drills/shoveRange'
import { drillSample } from '@/lib/drills/sample'
import type { Drill } from '@/lib/drills/types'
import { foldsTo, sceneState } from '@/lib/lessons/scene'
import { cardToString } from '@/lib/poker/cards'
import { formatChips } from '@/lib/useMoney'
import { useProfile } from '@/store/profile'

export function TappedDrillSpot({ kind }: { kind: DrillKind }) {
  const [drill] = useState(() => drillSample(kind.id))

  return (
    <figure className="mt-5 rounded-xl border border-foreground/10 bg-background/60 py-4">
      <figcaption className="px-4 text-sm text-muted-foreground">
        One of the spots, as the drill deals it.
      </figcaption>
      <div className="mt-3 flex flex-col">
        {kind.id === OPEN_PACK_ID ? (
          <OpenSpot drill={drill} />
        ) : kind.id === SHOVE_PACK_ID ? (
          <ShoveSpot drill={drill} />
        ) : kind.id === BET_PACK_ID ? (
          <BetSpot drill={drill} />
        ) : (
          <FeltSpot kind={kind} drill={drill} />
        )}
      </div>
      <p className="mt-3 px-4 text-sm text-muted-foreground">
        Answer it in the drill and it shows you why.
      </p>
    </figure>
  )
}

/** A board, some cards and a question: the shared felt draws it whole. */
function FeltSpot({ kind, drill }: { kind: DrillKind; drill: Drill }) {
  // Hands that are the answer ("Who gets there?") sit across the table the
  // way the drill draws them; otherwise the first holding is yours and any
  // other is theirs.
  const choiceHands = drill.choices.filter((c) => c.cards.length > 1)
  const [hero, ...rest] = drill.hands ?? []
  const across = choiceHands.length > 0 ? choiceHands : rest
  return (
    <Felt
      across={
        across.length > 0
          ? across.map((hand) => <Holding key={hand.label} label={hand.label} cards={hand.cards} />)
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
  )
}

/** Open or fold: the table as it is when it folds to you (OpenPack). */
function OpenSpot({ drill }: { drill: Drill }) {
  const seat = (drill.seat ?? 'btn') as SeatId
  const state = useMemo(() => {
    const hero = drill.hands?.[0].cards.map(cardToString) ?? []
    return sceneState(
      { heroSeat: seat, hero: [hero[0], hero[1]] as const, actions: foldsTo(seat) },
      drill.seed,
    )
  }, [drill, seat])
  return (
    <SceneTable
      row
      state={state}
      faces={openFaces(drill)}
      speaking={seat}
      talk={
        <TalkLine>
          {OPEN_WHERE[seat]} <span className="font-medium text-foreground">Raise or fold?</span>
        </TalkLine>
      }
    />
  )
}

/** Shove or fold: the same table, your short stack against covering ones (ShovePack). */
function ShoveSpot({ drill }: { drill: Drill }) {
  const seat = (drill.seat ?? 'btn') as ShoveSeat
  const stack = drill.shove?.stack ?? 10
  const state = useMemo(
    () => shoveTable(drill.hands?.[0].cards ?? [], seat, stack, drill.seed),
    [drill, seat, stack],
  )
  return (
    <SceneTable
      row
      state={state}
      faces={shoveFaces(drill)}
      speaking={seat}
      talk={
        <TalkLine>
          {seat === 'utg' ? 'You are first to act' : 'It folds to you'} {SHOVE_WHERE[seat]} with{' '}
          <span className="font-medium tabular-nums text-foreground">{stack} big blinds</span>.{' '}
          <span className="whitespace-nowrap font-medium text-foreground">All in, or fold?</span>
        </TalkLine>
      }
    />
  )
}

/** Bet or check: the regular across, the hand so far, and their check on the river (BetPack). */
function BetSpot({ drill }: { drill: Drill }) {
  const cardBack = cardBackById(useProfile((s) => s.cardBack))
  const opponent = betOpponentFor(drill)
  const hero = drill.hands?.[0]
  const pot = drill.calling?.pot ?? 0
  return (
    <Felt
      across={
        <BetOpponent character={opponent} line={drill.line ?? []} cardBack={cardBack} dim={false} />
      }
      board={
        <>
          <Board cards={drill.board} slots={5} />
          <div className="flex items-baseline justify-center gap-2 px-2">
            <span className="sr-only">{`Pot ${formatChips(pot)} chips.`}</span>
            <span aria-hidden className="text-2xs uppercase tracking-[0.2em] text-muted-foreground">
              Pot
            </span>
            <span aria-hidden className="text-xl font-semibold tabular-nums">
              {formatChips(pot)}
            </span>
          </div>
          <TalkLine>
            {`${opponent.name} checks to you. Bet ${formatChips(drill.calling?.bet ?? 0)}, or check it back?`}
          </TalkLine>
        </>
      }
      hero={
        hero && (
          <Holding label="You" detail={hero.detail} cards={hero.cards} size="hero" layout="below" />
        )
      }
    />
  )
}
