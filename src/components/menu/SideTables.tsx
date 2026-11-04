'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronRight, Star } from 'lucide-react'
import { SectionScreen } from './SectionScreen'
import { CategoryArt } from './CategoryArt'
import { VenueArt } from './VenueArt'
import { VenueInfoDialog } from './VenueInfoDialog'
import { ShelfCard, type ShelfCardVM } from './ShelfCard'
import { BlackjackCard } from './BlackjackCard'
import { MEMBERS_ONLY_NOTE, memberLocked } from './VenueBrowser'
import { useRequireProfile } from './useRequireProfile'
import { Splash } from '@/components/Splash'
import {
  SIDE_SHELF,
  familiesIn,
  houseName,
  membershipForFamily,
  type TableFamily,
  type Venue,
} from '@/config/venues'
import { useEntitlement, useMembership } from '@/store/entitlement'
import { useMoney } from '@/lib/useMoney'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import { sound } from '@/lib/sound'
import { membershipFor } from '@/config/membership'
import { TASTE_COPY } from '@/lib/membership/taste'
import { useTaste } from '@/lib/useTaste'
import { LimitCard } from '@/components/membership/LimitCard'
import { QUICK_GAMES, type QuickGame } from '@/config/quickGames'
import { formatScore } from '@/components/quick/QuickScreen'
import { useQuickRound } from '@/lib/useQuickRound'

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
 * **Each card leads with the game's real name** (Will, 2026-11-04: "the side
 * tables need to be clearer and better designed"). In four weeks the page had
 * 83 views and single-digit sits: "The Parlour" does not say Draw, and a tile
 * reading "Need 5,000" says neither what the game is nor that one is free
 * today. A card now says the game, one line on what is different, the price,
 * and one pill that is both its state and what a tap does (ShelfCard.tsx). A
 * non-member with today's free table unspent gets one card at the top that
 * says so, with a button straight to a game they can afford.
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
  const taste = useTaste()
  // Known not to be a member: the store has answered, so a member never sees
  // the card flash past on load.
  const freePlayer = useMembership((s) => s.checked && !s.member)
  const [openFamily, setOpenFamily] = useState<TableFamily | null>(null)

  // **One member game a day is free** (docs/membership.md). While today's is
  // unspent a locked family opens like a member's would, says "Free today",
  // and the route spends it at sit-down (PlayClient). Once spent the card is
  // the plain lock again, saying so.
  const tasting = (family: TableFamily) => memberLocked(family, member) && taste.left
  const shut = (family: TableFamily) => memberLocked(family, member) && !taste.left
  const shutNote = taste.ready && taste.record ? TASTE_COPY.used : MEMBERS_ONLY_NOTE

  const card = (family: TableFamily, index: number): ShelfCardVM => {
    const locked = shut(family)
    const free = tasting(family)
    const cheapest = family.rooms[0]
    const affordable = spendable >= cheapest.buyIn
    return {
      art: <VenueArt id={family.art} accent={family.accent} className="size-full" />,
      accent: family.accent,
      title: family.game,
      house: houseName(family),
      short: family.short,
      // The cheapest way in. Over several rooms it says "From", and the
      // dialog's second screen has every price.
      price:
        family.rooms.length > 1
          ? `From ${money(cheapest.buyIn)}`
          : `Buy-in ${money(cheapest.buyIn)}`,
      // The membership lock comes before the Roll: telling a non-member with
      // 400 chips that a member room needs 3,000 sends them off to win chips
      // that will not open it.
      state: locked
        ? { kind: 'members' }
        : !affordable
          ? { kind: 'need', amount: money(cheapest.buyIn) }
          : free
            ? { kind: 'free' }
            : { kind: 'play' },
      index,
      onOpen: () => {
        sound.play('tap')
        // **Locked goes to the page, not to the dialog** (Will, 2026-09-20).
        // The dialog describes a table and then says you cannot play it, which
        // was a reasonable shape while the shelf was mostly free and is a dead
        // end now that none of it is. Answering a deliberate tap with the page
        // that explains the thing is not the nagging the landing page rules
        // out: nothing here appears uninvited, over what you were doing, or
        // twice. See docs/membership.md.
        if (locked) {
          router.push(membershipForFamily(family))
          return
        }
        setOpenFamily(family)
      },
    }
  }

  if (!ready) return <Splash />

  const games = familiesIn('games')
  const twists = familiesIn('twists')
  // The free table's featured card leads with the first game the Roll can
  // cover, games before twists, so its one button always works.
  const featured = SIDE_SHELF.find((f) => spendable >= f.rooms[0].buyIn) ?? null
  const cheapestSeat = Math.min(...SIDE_SHELF.map((f) => f.rooms[0].buyIn))

  return (
    <SectionScreen title="Side Tables" subtitle="Other games, and Hold’em with a twist.">
      {/* Quick games first: a round of a minute or two, and the quickest way
          to play anything here (config/quickGames). */}
      {QUICK_GAMES.length > 0 && (
        <Shelf title="Quick games">
          {QUICK_GAMES.map((game, i) => (
            <QuickCard key={game.id} game={game} index={i} />
          ))}
        </Shelf>
      )}
      {/* Today's free table: one card that says so, with one way to sit. */}
      {freePlayer && taste.left && (
        <div className="mb-8">
          <FreeTodayCard
            featured={featured}
            cheapest={money(cheapestSeat)}
            onPlay={(family) => {
              sound.play('tap')
              setOpenFamily(family)
            }}
          />
        </div>
      )}
      {/* Today's free table spent: one card says so, above the shelf. */}
      {freePlayer && taste.ready && taste.record && !taste.left && (
        <div className="mb-8">
          <LimitCard kind="table" />
        </div>
      )}
      {/* Blackjack is not a family: a family is rooms in one price list, and
          blackjack is two lists (what you sit down with, and which house). It
          rides on the games shelf as its own card, the way the builder rides on
          the twists shelf. */}
      <Shelf title="Other games">
        {games.map((family, i) => (
          <ShelfCard key={family.id} model={card(family, i)} />
        ))}
        <BlackjackCard member={member} index={games.length} />
      </Shelf>
      <Shelf title="Hold’em with a twist">
        {twists.map((family, i) => (
          <ShelfCard key={family.id} model={card(family, games.length + 1 + i)} />
        ))}
        <BuildCard member={member} index={games.length + twists.length + 1} />
      </Shelf>

      <VenueInfoDialog
        key={openFamily?.id}
        family={openFamily}
        venue={openFamily?.rooms[0] ?? null}
        canAfford={(v) => spendable >= v.buyIn}
        playable={openFamily ? !shut(openFamily) : false}
        lockedNote={openFamily && shut(openFamily) ? shutNote : undefined}
        freeNote={openFamily && tasting(openFamily) ? TASTE_COPY.note : undefined}
        onOpenChange={(o) => !o && setOpenFamily(null)}
        onPlay={(venue: Venue) => {
          sound.play('call')
          router.push(`/play/${venue.id}`)
        }}
      />
    </SectionScreen>
  )
}

/**
 * One labelled half of the shelf.
 *
 * One column of rows on a phone, then two, then three across: a card added to
 * either half (a new game, a new quick mode) lands in the next slot without
 * the layout having to know.
 */
function Shelf({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 last:mb-0">
      <h2 className="mb-3 px-1 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
        {children}
      </div>
    </section>
  )
}

/**
 * Today's free member table, said once at the top with one button.
 *
 * The cards below each say "Play free" too, but a shelf of nine pills does not
 * say *one* of them; this does, and it hands over the first game the Roll can
 * cover so the shortest path to a seat is one tap and a buy-in. When the Roll
 * covers nothing on the shelf it says what the cheapest seat costs instead of
 * offering a button that would end in "Need".
 */
function FreeTodayCard({
  featured,
  cheapest,
  onPlay,
}: {
  featured: TableFamily | null
  cheapest: string
  onPlay: (family: TableFamily) => void
}) {
  const accent = featured?.accent ?? FREE_ACCENT
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        backgroundImage: `radial-gradient(90% 120% at 100% 0%, ${accent}26, transparent 65%)`,
      }}
      className="relative isolate flex w-full flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03] shadow-xl shadow-black/30 sm:flex-row"
    >
      {featured && (
        <div className="relative aspect-[2/1] w-full shrink-0 sm:aspect-auto sm:w-[44%]">
          <VenueArt
            id={featured.art}
            accent={featured.accent}
            className="absolute inset-0 size-full"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-black/30" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4 p-5 md:p-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-foreground">
            <Star className="size-3 fill-pip text-pip" />
            {TASTE_COPY.tile}
          </span>
          <h2 className="mt-3 text-xl font-semibold md:text-2xl leading-tight tracking-tight">
            One table is free today
          </h2>
          <p className="mt-1 text-muted-foreground">
            {featured
              ? 'Pick any game or twist below, or start here.'
              : `The cheapest seat is ${cheapest} chips. Win some on the ladder first.`}
          </p>
        </div>
        {featured && (
          <button
            type="button"
            onClick={() => onPlay(featured)}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-black/20 transition hover:bg-primary/90 active:scale-[0.98] sm:mt-auto sm:w-auto sm:self-start sm:px-6"
          >
            Play {featured.game} free
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

/**
 * One quick game on the shelf. Every tap goes to the game's page, locked or
 * not: the page shows the best and, once today's free round is used, the
 * limit card that says when it is back.
 */
function QuickCard({ game, index }: { game: QuickGame; index: number }) {
  const router = useRouter()
  const view = useQuickRound(game.id)
  return (
    <ShelfCard
      model={{
        art: <CategoryArt id={game.id} accent={game.accent} className="size-full" />,
        accent: game.accent,
        title: game.title,
        short: game.short,
        price: view.best !== null ? `Best ${formatScore(game, view.best)}` : '',
        state: view.member
          ? { kind: 'play' }
          : view.freeLeft || !view.ready
            ? { kind: 'free' }
            : { kind: 'members' },
        index,
        onOpen: () => {
          sound.play('tap')
          router.push(game.href)
        },
      }}
    />
  )
}

/** The free card's wash when there is no featured game to borrow one from. */
const FREE_ACCENT = '#7C8CF0'

/** The builder's tile art has no venue behind it, so its accent lives here. */
const BUILD_ACCENT = '#8A8F98'

/**
 * The builder, as the last card on the twists shelf.
 *
 * Not a family, so it has no rooms or price list, but it is the same kind of
 * thing to a player: a way to get to a table. Locked, a tap goes to the page,
 * the same as every card beside it.
 */
function BuildCard({ member, index }: { member: boolean; index: number }) {
  const router = useRouter()
  return (
    <ShelfCard
      model={{
        art: <CategoryArt id="custom" accent={BUILD_ACCENT} className="size-full" />,
        accent: BUILD_ACCENT,
        title: 'Build your own',
        short: 'Pick the seats, stakes, stack depth and speed.',
        price: 'Any buy-in',
        state: member ? { kind: 'play' } : { kind: 'members' },
        index,
        onOpen: () => {
          sound.play('tap')
          router.push(member ? '/game/custom' : membershipFor('custom-tables'))
        },
      }}
    />
  )
}
