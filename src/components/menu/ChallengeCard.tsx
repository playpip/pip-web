'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CategoryCard } from './CategoryCard'
import { ChallengerFace } from './ChallengerFace'
import { VenueInfoDialog } from './VenueInfoDialog'
import type { Challenge } from '@/lib/challenge'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'

/**
 * The standing challenge: a cast member waiting on the home screen with a
 * heads-up game. Their face, the stakes, one way in.
 *
 * **There is no dismiss control and there never will be.** Nothing here
 * expires, counts down or keeps score, so there is nothing to nag you with and
 * nothing to close — which is the whole reason this is the version of a
 * retention loop that survives the house philosophy (technology#22).
 *
 * It is a **venue tile** rather than the full-width band it used to be
 * (technology#48). A challenge is a table you sit at, so it belongs in the menu
 * grid next to the other tables, and reading it as a place rather than a banner
 * costs a fifth of the room the band did. Tapping opens the same info dialog
 * every other venue opens — their line gets space there that a half-width tile
 * could never give it, and a 2.5x heads-up buy-in is worth a deliberate second
 * tap in the same way the Daily's is.
 *
 * The challenge itself is derived in `Home`, not here: the tile grid has to
 * know whether there is a fifth tile before it can pick its column count.
 */
export function ChallengeCard({ challenge, delay = 0 }: { challenge: Challenge; delay?: number }) {
  const router = useRouter()
  const money = useMoney()
  const [infoOpen, setInfoOpen] = useState(false)
  const { character, venue, rematch } = challenge

  return (
    <>
      <CategoryCard
        artNode={
          <ChallengerFace character={character} accent={venue.accent} className="size-full" />
        }
        title={character.name}
        // Cleared the band, so this one is a rematch — said plainly, because a
        // face you have already beaten reappearing without a word reads as the
        // game losing track.
        badge={rematch ? 'Rematch' : undefined}
        subtitle={`Heads-up · ${money(venue.prize)} to win`}
        onClick={() => {
          sound.play('tap')
          setInfoOpen(true)
        }}
        delay={delay}
      />
      {/* Always playable: a challenge is only offered at a band the Roll can
          already cover, so there is no locked state to render (lib/challenge). */}
      <VenueInfoDialog
        venue={infoOpen ? venue : null}
        challenger={character}
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
