'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Splash } from '@/components/Splash'
import { sound } from '@/lib/sound'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import type { Venue } from '@/config/venues'
import { useEntitlement } from '@/store/entitlement'
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
  extraTile,
}: {
  title: string
  subtitle?: string
  venues: readonly Venue[]
  tiered?: boolean
  /**
   * One more tile after the venues, for a thing that is not a venue.
   *
   * The table builder is the only user: it belongs with the format twists
   * rather than on the lobby, and the lobby does not grow a tile per feature
   * (see menu/Home.tsx). Rendered inside this grid so it is the same size and
   * shape as everything beside it.
   */
  extraTile?: React.ReactNode
}) {
  const ready = useRequireProfile()
  const router = useRouter()
  const spendable = useSpendableRoll()
  // False until the row proves otherwise, including for the frame before it
  // comes back, so a member room appears locked and then unlocks rather than
  // the other way round. A tile that unlocks is a pleasant surprise; a tile
  // that locks itself as you reach for it is a bug report.
  const member = useEntitlement()
  const [infoVenue, setInfoVenue] = useState<Venue | null>(null)

  const models: VenueVM[] = useMemo(
    () =>
      venues.map((venue, index) => {
        const locked = Boolean(venue.membersOnly) && !member
        return {
          venue,
          index,
          tier: tiered ? index + 1 : undefined,
          // Two locks, and the membership one comes first: telling a player
          // with 400 chips that a 3,000 member room needs 3,000 sends them off
          // to win chips that will not open it.
          playable: !locked && spendable >= venue.buyIn,
          lockedReason: locked ? 'Comes with the membership' : undefined,
          onOpen: () => {
            sound.play('tap')
            setInfoVenue(venue)
          },
        }
      }),
    [venues, tiered, spendable, member],
  )

  if (!ready) return <Splash />

  return (
    <SectionScreen title={title} subtitle={subtitle}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {models.map((m) => (
          <VenueTile key={m.venue.id} model={m} />
        ))}
        {extraTile}
      </div>

      <VenueInfoDialog
        // Remount per venue so the dialog's stake choice resets rather than
        // leaking from the last table you looked at.
        key={infoVenue?.id}
        venue={infoVenue}
        canAfford={(v) => spendable >= v.buyIn}
        playable={
          infoVenue ? (!infoVenue.membersOnly || member) && spendable >= infoVenue.buyIn : false
        }
        onOpenChange={(o) => !o && setInfoVenue(null)}
        onPlay={(venue) => {
          sound.play('call')
          router.push(`/play/${venue.id}`)
        }}
      />
    </SectionScreen>
  )
}
