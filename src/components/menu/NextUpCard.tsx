'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChallengerFace } from './ChallengerFace'
import { VenueArt } from './VenueArt'
import { VenueInfoDialog } from './VenueInfoDialog'
import { WideTableCard } from './wideTableCard'
import { VENUES } from '@/config/venues'
import type { NextUp } from '@/lib/nextUp'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'

/**
 * **Next up** — the lobby's answer to "what do I play?", as one wide card.
 *
 * The home screen's whole hierarchy turns on this being *one* table rather than
 * a row of them. The app already knows the answer: it knows the Roll, which
 * rungs have been won, whether a challenger is waiting. Until this card existed
 * none of that reached the layout, so the player did the sorting every session.
 *
 * It is the **ladder**, all but always — see `lib/nextUp.ts` for what else can
 * take the slot and why the Daily never does.
 *
 * It is wide rather than a fifth tile on purpose: a recommendation that looks
 * like the things it is recommending between is not a recommendation.
 *
 * `QuickPlayCard` sits beside it and is the one thing allowed to, because it
 * answers a different question — how long you have, not how far you have got.
 * Nothing else may join that row: a third card and the row is a tile grid again.
 *
 * Tapping opens the same info dialog every other table opens. Including the
 * freeroll, which used to be a one-tap button under the Roll — one path in
 * beats a special case, and the buy-in being confirmed in the dialog is the
 * rule everywhere else.
 */
export function NextUpCard({ pick, delay = 0 }: { pick: NextUp; delay?: number }) {
  const router = useRouter()
  const money = useMoney()
  const [infoOpen, setInfoOpen] = useState(false)
  const { venue, challenge } = pick

  const line =
    pick.kind === 'freeroll'
      ? `You're out of chips — win ${money(venue.prize)} and you're back in.`
      : challenge
        ? `Heads-up · buy-in ${money(venue.buyIn)} · ${money(venue.prize)} to win`
        : `Rung ${pick.rung} of ${VENUES.length} · buy-in ${money(venue.buyIn)} · ${money(venue.prize)} to win`

  return (
    <>
      <WideTableCard
        eyebrow="Next up"
        title={challenge ? challenge.character.name : venue.name}
        badge={challenge?.rematch ? 'Rematch' : pick.repeat ? 'Won before' : undefined}
        line={line}
        cover={<Cover pick={pick} />}
        cta="Sit down"
        onOpen={() => {
          sound.play('tap')
          setInfoOpen(true)
        }}
        delay={delay}
      />

      {/* Always playable: `nextUp` only ever picks a table the Roll can already
          sit at, so there is no locked state to render here. */}
      <VenueInfoDialog
        venue={infoOpen ? venue : null}
        challenger={challenge?.character}
        playable
        onOpenChange={(o) => !o && setInfoOpen(false)}
        onPlay={(v) => {
          sound.play('call')
          router.push(`/play/${v.id}`)
        }}
      />
    </>
  )
}

/** The cover: a face when a challenger is waiting, the room itself otherwise. */
function Cover({ pick }: { pick: NextUp }) {
  const { venue, challenge } = pick
  if (challenge) {
    return (
      <ChallengerFace
        character={challenge.character}
        accent={venue.accent}
        className="absolute inset-0 size-full"
      />
    )
  }
  return <VenueArt id={venue.id} accent={venue.accent} className="absolute inset-0 size-full" />
}
