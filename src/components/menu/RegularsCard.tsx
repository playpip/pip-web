'use client'

// The Regulars' Table, in the lobby once a 21-day streak has opened it
// (lib/dailyReward). Nothing at all before then: a padlocked tile for a table
// you get by coming back would be a nag, and the reward dialog already says
// what is coming and when.

import { useRouter } from 'next/navigation'
import { CategoryCard } from './CategoryCard'
import { VenueArt } from './VenueArt'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { characterById } from '@/config/cast'
import { REGULARS_TABLE, tablePagePath } from '@/config/venues'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { useProfile } from '@/store/profile'

export function RegularsCard({ delay = 0 }: { delay?: number }) {
  const router = useRouter()
  const money = useMoney()
  const owned = useProfile((s) => s.owned)
  const maud = characterById('maud')
  if (!REGULARS_TABLE.streakUnlock || !owned.includes(REGULARS_TABLE.streakUnlock)) return null

  return (
    <CategoryCard
      artNode={
        <>
          <VenueArt
            id={REGULARS_TABLE.id}
            accent={REGULARS_TABLE.accent}
            className="absolute inset-0 size-full"
          />
          {maud && (
            <PlayerAvatar
              spec={maud.avatar}
              size={64}
              className="absolute right-2 bottom-2 size-9 ring-2 ring-black/40 md:size-10"
            />
          )}
        </>
      }
      title={REGULARS_TABLE.name}
      badge="Streak"
      subtitle={`With Maud · ${money(REGULARS_TABLE.buyIn)}`}
      onClick={() => {
        sound.play('tap')
        router.push(tablePagePath(REGULARS_TABLE, 'home'))
      }}
      delay={delay}
    />
  )
}
