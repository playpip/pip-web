'use client'

import { useRouter } from 'next/navigation'
import { CategoryArt } from './CategoryArt'
import { WideTableCard } from './wideTableCard'
import type { Venue } from '@/config/venues'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { tablePagePath } from '@/config/venues'

/**
 * **Short on time?** — the second question the lobby answers, beside the first.
 *
 * `NextUpCard` answers "how far have I got"; this answers "how long have I
 * got", and they are different enough to sit side by side without the row
 * becoming a shortlist. Every other table in the game has to be *finished* — a
 * tournament ends when somebody wins it, and standing up early leaves your
 * buy-in on the table. A ring game is the one place you can stand up mid-hand
 * with the chips in front of you, which is the whole promise being made here
 * and the reason this is always the Rail (see `quickPlay` in lib/nextUp.ts).
 *
 * Absent entirely when the Roll cannot reach the cheapest room, and the row
 * collapses to the hero alone rather than showing a padlock: this is a
 * suggestion, and a suggestion you cannot take is not one.
 */
export function QuickPlayCard({ room, delay = 0 }: { room: Venue; delay?: number }) {
  const router = useRouter()
  const money = useMoney()

  return (
    <WideTableCard
      eyebrow="Short on time?"
      title={room.name}
      // The blinds rather than the prize, because there is no prize: what
      // matters about a ring table is the stake and that the chips are yours.
      line={`Cash · sit down for ${money(room.buyIn)} · stand up whenever`}
      cover={
        <CategoryArt id={room.id} accent={room.accent} className="absolute inset-0 size-full" />
      }
      onOpen={() => {
        sound.play('tap')
        router.push(tablePagePath(room, 'home'))
      }}
      delay={delay}
    />
  )
}
