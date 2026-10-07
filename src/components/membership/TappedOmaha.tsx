'use client'

// One Omaha showdown, under the answer to a tap on The Big Pot's padlock
// (playpip/cmo#180). The blurb above says "exactly two"; this is a hand where
// that rule decides the pot, with the five cards that play ringed on each
// side. Read-only, like the drills' spots: a look at the game, not a hand of it.
//
// Loaded on its own (`next/dynamic` in TappedFor), so the evaluator and the
// cast reach the browser only for somebody who tapped this padlock.

import { Board, Felt, Holding, TalkLine, cardKey } from '@/components/drills/felt'
import { rosterFor } from '@/config/cast'
import { BIG_POT } from '@/config/venues'
import { omahaSample } from '@/lib/membership/omahaSample'
import type { Card } from '@/lib/poker/cards'

// Fixed, so the page is the same hand for everybody and a reviewer can check
// it. First of the room's regulars, in cast order.
const showdown = omahaSample()
const opponent = rosterFor(BIG_POT)[0]

const ringed = (plays: readonly Card[]) => {
  const keys = new Set(plays.map(cardKey))
  return (card: Card) => keys.has(cardKey(card))
}

export function TappedOmaha() {
  const { board, hero, them, winner, holdemPhrase } = showdown
  const winning = winner === 'hero' ? hero : them
  const outcome =
    winner === 'split'
      ? 'You split it.'
      : winner === 'hero'
        ? `You take it with ${hero.phrase}.`
        : `${opponent.name} takes it with ${them.phrase}.`

  return (
    <figure className="mt-5 rounded-xl border border-foreground/10 bg-background/60 py-4">
      <figcaption className="px-4 text-sm text-muted-foreground">
        One showdown at The Big Pot.
      </figcaption>
      <div className="mt-3 flex flex-col">
        <Felt
          across={
            <Holding
              label={opponent.name}
              avatar={opponent.avatar}
              detail={them.phrase}
              cards={them.cards}
              glow={ringed(them.plays)}
            />
          }
          board={
            <>
              <Board cards={board} glow={ringed(winning.plays)} />
              <TalkLine>
                {`In Hold’em your cards make ${holdemPhrase}. Here two of your four must play, so it is ${hero.phrase}. ${outcome}`}
              </TalkLine>
            </>
          }
          hero={
            <Holding
              label="You"
              detail={hero.phrase}
              cards={hero.cards}
              layout="below"
              glow={ringed(hero.plays)}
            />
          }
        />
      </div>
      <p className="mt-3 px-4 text-sm text-muted-foreground">
        Ringed: the two from each hand that play, and the three from the board that win it.
      </p>
    </figure>
  )
}
