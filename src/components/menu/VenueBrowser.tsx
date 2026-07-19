'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Splash } from '@/components/Splash'
import { useProfile } from '@/store/profile'
import { sound } from '@/lib/sound'
import type { Venue } from '@/config/venues'
import { SectionScreen } from './SectionScreen'
import { VenueInfoDialog } from './VenueInfoDialog'
import { VenueTile, type VenueVM } from './venueCard'
import { useRequireProfile } from './useRequireProfile'

/**
 * A full page of venues — the ladder (tiered) or the side tables. Desktop shows
 * a responsive grid, mobile a vertical list; tapping any card opens the info
 * dialog, which is where the buy-in is confirmed and play begins.
 */
export function VenueBrowser({
  title,
  subtitle,
  venues,
  tiered = false,
}: {
  title: string
  subtitle?: string
  venues: readonly Venue[]
  tiered?: boolean
}) {
  const ready = useRequireProfile()
  const router = useRouter()
  const roll = useProfile((s) => s.roll)
  const [infoVenue, setInfoVenue] = useState<Venue | null>(null)

  const models: VenueVM[] = useMemo(
    () =>
      venues.map((venue, index) => ({
        venue,
        index,
        tier: tiered ? index + 1 : undefined,
        playable: roll >= venue.buyIn,
        onOpen: () => {
          sound.play('tap')
          setInfoVenue(venue)
        },
      })),
    [venues, tiered, roll],
  )

  if (!ready) return <Splash />

  return (
    <SectionScreen title={title} subtitle={subtitle}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {models.map((m) => (
          <VenueTile key={m.venue.id} model={m} />
        ))}
      </div>

      <VenueInfoDialog
        venue={infoVenue}
        playable={infoVenue ? roll >= infoVenue.buyIn : false}
        onOpenChange={(o) => !o && setInfoVenue(null)}
        onPlay={(venue) => {
          sound.play('call')
          router.push(`/play/${venue.id}`)
        }}
      />
    </SectionScreen>
  )
}
