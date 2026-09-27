'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Lock, Wrench } from 'lucide-react'
import { SectionScreen } from './SectionScreen'
import { CategoryArt } from './CategoryArt'
import { VenueInfoDialog } from './VenueInfoDialog'
import { VenueTile, PremiumStar, type TileVM } from './venueCard'
import { BlackjackCard } from './BlackjackCard'
import { MEMBERS_ONLY_NOTE, memberLocked } from './VenueBrowser'
import { useRequireProfile } from './useRequireProfile'
import { Splash } from '@/components/Splash'
import { familiesIn, type TableFamily, type Venue } from '@/config/venues'
import { useEntitlement } from '@/store/entitlement'
import { useMoney } from '@/lib/useMoney'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import { sound } from '@/lib/sound'

/**
 * The side tables: one card per thing that is different, with the prices behind
 * it.
 *
 * **This shelf used to be ten venue cards in a flat grid and told you neither of
 * the two things you needed** (Will, 2026-09-20). "The Docks" does not say
 * *bounty*, and buy-ins running 500 to 25,000 in no order do not say whether any
 * of it is above or below where you play. Now the card is the idea and the
 * second screen of its dialog is the price — the shape Deep Stack already had,
 * generalised (see config/venues.ts → TABLE_FAMILIES).
 *
 * **Two sections, because there are two kinds of different.** A game that is not
 * Hold'em is a different thing to learn; a twist is the game you know with one
 * screw turned. Putting them in one grid was most of what made the old shelf
 * feel arbitrary — the heading does work no card title can.
 *
 * Everything here is the membership's, without exception. See docs/membership.md
 * for rule 1 as it now stands and the account of why it was narrowed.
 */
export function SideTables() {
  const ready = useRequireProfile()
  const router = useRouter()
  const member = useEntitlement()
  const money = useMoney()
  const spendable = useSpendableRoll()
  const [openFamily, setOpenFamily] = useState<TableFamily | null>(null)

  const tile = (family: TableFamily, index: number): TileVM => {
    const locked = memberLocked(family, member)
    const cheapest = family.rooms[0]
    const dearest = family.rooms[family.rooms.length - 1]
    const affordable = spendable >= cheapest.buyIn
    return {
      artId: family.art,
      accent: family.accent,
      name: family.name,
      tag: family.tag,
      index,
      // The price of the cheapest way in, and the spread when there is one.
      // A range is the honest summary of a card that hides five prices; a
      // single number would be one of them pretending to be the card.
      line:
        family.rooms.length > 1
          ? `${family.rooms.length} tables · ${money(cheapest.buyIn)} – ${money(dearest.buyIn)}`
          : `Buy-in ${money(cheapest.buyIn)}${cheapest.prize > 0 ? ` · win ${money(cheapest.prize)}` : ''}`,
      playable: !locked && affordable,
      lockedReason: locked
        ? MEMBERS_ONLY_NOTE
        : affordable
          ? undefined
          : `Need ${money(cheapest.buyIn)}`,
      premium: Boolean(family.membersOnly),
      onOpen: () => {
        sound.play('tap')
        // **Locked goes to the page, not to the dialog** (Will, 2026-09-20).
        // The dialog describes a table and then says you cannot play it, which
        // was a reasonable shape while the shelf was mostly free and is a dead
        // end now that none of it is. Answering a deliberate tap with the page
        // that explains the thing is not the nagging the landing page rules
        // out — nothing here appears uninvited, over what you were doing, or
        // twice. See docs/membership.md.
        if (locked) {
          router.push('/membership')
          return
        }
        setOpenFamily(family)
      },
    }
  }

  if (!ready) return <Splash />

  const games = familiesIn('games')
  const twists = familiesIn('twists')

  return (
    <SectionScreen
      title="Side Tables"
      subtitle="The games that aren’t Hold’em, and the game you know with one screw turned. All of it comes with the membership."
    >
      {/* Blackjack is not a family — a family is rooms in one price list, and
          blackjack is two lists (what you sit down with, and which house). It
          rides on the games shelf as its own tile, the way the builder rides on
          the twists shelf. */}
      <Shelf
        title="The games"
        hint="A different game entirely"
        families={games}
        tile={tile}
        extraTile={<BlackjackCard member={member} index={games.length} />}
      />
      <Shelf
        title="The twists"
        hint="Hold’em, changed in exactly one way"
        families={twists}
        tile={tile}
        offset={games.length}
        extraTile={<BuildTile member={member} delay={0.05 * (games.length + twists.length)} />}
      />

      <VenueInfoDialog
        key={openFamily?.id}
        family={openFamily}
        venue={openFamily?.rooms[0] ?? null}
        canAfford={(v) => spendable >= v.buyIn}
        playable={openFamily ? !memberLocked(openFamily, member) : false}
        lockedNote={openFamily && memberLocked(openFamily, member) ? MEMBERS_ONLY_NOTE : undefined}
        onOpenChange={(o) => !o && setOpenFamily(null)}
        onPlay={(venue: Venue) => {
          sound.play('call')
          router.push(`/play/${venue.id}`)
        }}
      />
    </SectionScreen>
  )
}

/** One labelled half of the shelf. */
function Shelf({
  title,
  hint,
  families,
  tile,
  offset = 0,
  extraTile,
}: {
  title: string
  hint: string
  families: readonly TableFamily[]
  tile: (family: TableFamily, index: number) => TileVM
  offset?: number
  extraTile?: React.ReactNode
}) {
  if (families.length === 0 && !extraTile) return null
  return (
    <section className="mb-8 last:mb-0">
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="truncate text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {families.map((family, i) => (
          <VenueTile key={family.id} model={tile(family, offset + i)} />
        ))}
        {extraTile}
      </div>
    </section>
  )
}

/** The builder's tile art has no venue behind it, so its accent lives here. */
const BUILD_ACCENT = '#8A8F98'

/**
 * The builder, as the last tile on the shelf.
 *
 * Not a family, so it cannot be a `VenueTile` — but it is the same size and
 * shape as one, because it is the same kind of thing to a player: a way to get
 * to a table. Locked, it is a plain line and one text link, with nothing
 * clickable on the artwork (the rule every gated surface follows —
 * docs/membership.md).
 */
function BuildTile({ member, delay = 0 }: { member: boolean; delay?: number }) {
  const router = useRouter()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(delay, 0.3) }}
      className="w-full"
    >
      <button
        onClick={() => {
          sound.play('tap')
          // Locked taps go to the page, the same as every card beside it. It
          // used to be a `div` carrying one underlined link, which was the
          // right shape when this tile was the only locked thing on a free
          // shelf and is now the odd one out.
          router.push(member ? '/game/custom' : '/membership')
        }}
        aria-label={
          member ? 'Build your own table' : 'Build your own table — what the membership is'
        }
        className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-left transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]"
      >
        <div className="relative aspect-[16/10] w-full">
          <CategoryArt id="custom" accent={BUILD_ACCENT} className="absolute inset-0 size-full" />
          <span className="absolute left-2 top-2">
            <PremiumStar accent={BUILD_ACCENT} />
          </span>
          <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-black/40 backdrop-blur-sm">
            {member ? (
              <Wrench className="size-3.5 text-white/85" />
            ) : (
              <Lock className="size-3.5 text-white/85" />
            )}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-3">
          <h3 className="truncate font-semibold">Build your own</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {member ? 'Seats, stakes, depth, speed, company' : 'Comes with the membership'}
          </p>
        </div>
      </button>
    </motion.div>
  )
}
