'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Lock, Wrench } from 'lucide-react'
import { VenueBrowser } from './VenueBrowser'
import { CategoryArt } from './CategoryArt'
import { SIDE_SHELF } from '@/config/venues'
import { useEntitlement } from '@/store/entitlement'
import { sound } from '@/lib/sound'

/**
 * The side tables: the same game under different pressure, free and paid on one
 * shelf.
 *
 * **Everything the membership adds to the tables lives here**, and that is the
 * whole reason this component exists rather than the page just rendering
 * `SIDE_TABLES`. The membership briefly had its own lobby tile and its own
 * browser page, which made the home screen six tiles wide and every table on it
 * smaller (Will, 2026-09-19). A deep-stack table and an Omaha table are format
 * twists off the ladder, which is what this page already is — so they are cards
 * on it, locked for everybody who has not paid, exactly like a venue you cannot
 * yet afford is a card you can still read.
 *
 * **One Deep Stack card, five stakes behind it.** The card shows the default and
 * its info dialog picks the rest (see config/venues.ts and VenueInfoDialog).
 */
export function SideTables() {
  const member = useEntitlement()

  return (
    <VenueBrowser
      title="Side Tables"
      subtitle="The same game with the screws turned — turbos, deep stacks, heads-up, a price on every head, and four cards instead of two."
      venues={SIDE_SHELF}
      extraTile={<BuildTile member={member} />}
    />
  )
}

/**
 * The builder, as the last tile on the shelf.
 *
 * Not a venue, so it cannot be a `VenueTile` — but it is the same size and shape
 * as one, because it is the same kind of thing to a player: a way to get to a
 * table. Locked, it is a plain line and one text link, with nothing clickable on
 * the artwork (the rule every gated surface follows — docs/membership.md).
 */
function BuildTile({ member }: { member: boolean }) {
  const router = useRouter()
  const Frame = member ? 'button' : 'div'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24 }}
      className="w-full"
    >
      <Frame
        {...(member
          ? {
              onClick: () => {
                sound.play('tap')
                router.push('/game/custom')
              },
              'aria-label': 'Build your own table',
            }
          : {})}
        className={
          member
            ? 'group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-left transition hover:border-foreground/25 hover:bg-foreground/[0.05] active:scale-[0.99]'
            : 'flex h-full w-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.02] text-left'
        }
      >
        <div className="relative aspect-[16/10] w-full">
          <CategoryArt id="custom" accent="#8A8F98" className="absolute inset-0 size-full" />
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
            {member ? (
              'Seats, stakes, depth, speed, company'
            ) : (
              <>
                Comes with the membership.{' '}
                <Link
                  href="/membership"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  What that is
                </Link>
              </>
            )}
          </p>
        </div>
      </Frame>
    </motion.div>
  )
}
