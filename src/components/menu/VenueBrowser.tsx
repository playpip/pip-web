'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Splash } from '@/components/Splash'
import { sound } from '@/lib/sound'
import { useMoney } from '@/lib/useMoney'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import { tablePagePath, venueTag, type Venue } from '@/config/venues'
import { useEntitlement } from '@/store/entitlement'
import { SectionScreen } from './SectionScreen'
import { VenueTile, type TileVM } from './venueCard'
import { useRequireProfile } from './useRequireProfile'

/** The one sentence a member-only table is refused in, on the tile and on its page. */
export const MEMBERS_ONLY_NOTE = 'Comes with the membership'

/** Shut for the membership rather than for money. */
export const memberLocked = (thing: { membersOnly?: boolean }, member: boolean) =>
  Boolean(thing.membersOnly) && !member

/**
 * A full page of venues — the ladder (tiered) or the Rail. Desktop shows a
 * responsive grid, mobile a vertical list; tapping any card opens the table's
 * own page (TableScreen), which is where the buy-in is confirmed and play begins.
 *
 * The side tables do not come through here any more: that shelf is families of
 * rooms rather than venues, and it renders itself (see SideTables.tsx).
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
  /** One more tile after the venues, for a thing that is not a venue. */
  extraTile?: React.ReactNode
}) {
  const ready = useRequireProfile()
  const router = useRouter()
  const money = useMoney()
  const spendable = useSpendableRoll()
  // False until the row proves otherwise, including for the frame before it
  // comes back, so a member room appears locked and then unlocks rather than
  // the other way round. A tile that unlocks is a pleasant surprise; a tile
  // that locks itself as you reach for it is a bug report.
  const member = useEntitlement()

  const models: TileVM[] = useMemo(
    () =>
      venues.map((venue, index) => {
        const locked = memberLocked(venue, member)
        const affordable = spendable >= venue.buyIn
        return {
          artId: venue.id,
          accent: venue.accent,
          name: venue.name,
          tag: venueTag(venue),
          index,
          tier: tiered ? index + 1 : undefined,
          line: `Buy-in ${money(venue.buyIn)}${venue.prize > 0 ? ` · win ${money(venue.prize)}` : ''}`,
          // Two locks, and the membership one comes first: telling a player
          // with 400 chips that a 3,000 member room needs 3,000 sends them off
          // to win chips that will not open it.
          playable: !locked && affordable,
          lockedReason: locked
            ? MEMBERS_ONLY_NOTE
            : affordable
              ? undefined
              : `Need ${money(venue.buyIn)}`,
          // Marks the kind, not the lock — so it stays on once you have joined.
          premium: Boolean(venue.membersOnly),
          onOpen: () => {
            sound.play('tap')
            router.push(tablePagePath(venue))
          },
        }
      }),
    [venues, tiered, spendable, member, money, router],
  )

  if (!ready) return <Splash />

  return (
    <SectionScreen title={title} subtitle={subtitle}>
      {/* Columns by the room in rem, so a bigger text size drops to one card
          a row rather than squeezing the names (see Home's tile row). */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-3 @[19rem]:grid-cols-2 @[37rem]:grid-cols-3 @[59rem]:grid-cols-4 md:gap-4">
          {models.map((m, i) => (
            <VenueTile key={venues[i].id} model={m} />
          ))}
          {extraTile}
        </div>
      </div>
    </SectionScreen>
  )
}
