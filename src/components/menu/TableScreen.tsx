'use client'

// A table's own page, before you sit down (Will, 2026-11-04: "I really like
// this screen by the way: /game/quick/solitaire - can we new screens for all
// tables and rails like this? Way better than an alert dialog").
//
// It replaces the info dialog every table used to open. The shape is the quick
// games' start card (components/quick/QuickScreen): back to where you came
// from, the art, the name, one line, your record, the facts, and one way in. A
// side-tables family with several prices lists them as options in place of the
// one button, which is what the dialog's second screen used to be.
//
// Whether you may sit down is asked of `lib/sitDown`, the function the route
// asks, so a page that offers a table is a page whose button seats you.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronRight, Lock, Star } from 'lucide-react'
import { PageShell } from '@/components/PageShell'
import { Splash } from '@/components/Splash'
import { LimitCard } from '@/components/membership/LimitCard'
import { Segmented } from '@/components/ui/segmented'
import { CategoryArt } from './CategoryArt'
import { ChallengerFace } from './ChallengerFace'
import { VenueArt } from './VenueArt'
import { MEMBERS_ONLY_NOTE, memberLocked } from './VenueBrowser'
import { useRequireProfile } from './useRequireProfile'
import { HANDS_PER_LEVEL } from '@/config/blinds'
import {
  SIDE_SHELF,
  VENUES,
  dailyFor,
  houseName,
  membershipForFamily,
  membershipForVenue,
  playPath,
  seatChoices,
  venueById,
  venueTag,
  withSeats,
  type TableFamily,
  type Venue,
} from '@/config/venues'
import { isChallengeTable } from '@/lib/challenge'
import { dailyDateKey, ordinal } from '@/lib/daily'
import { TASTE_COPY } from '@/lib/membership/taste'
import { challengeOnOffer, refuseSitDown, type SitDownRefusal } from '@/lib/sitDown'
import { sound } from '@/lib/sound'
import { deviceId } from '@/lib/sync/client'
import { formatChips } from '@/lib/useMoney'
import { useSpendableRoll } from '@/lib/useSpendableRoll'
import { useTaste } from '@/lib/useTaste'
import { cn } from '@/lib/utils'
import { useEntitlement, useMembership } from '@/store/entitlement'
import { useProfile, type VenueRecord } from '@/store/profile'

const money = formatChips

// --- what the page says about a table ---------------------------------------

/** How good the other players are, read off the venue's own AI profile. */
function difficulty(venue: Venue): { level: 1 | 2 | 3 | 4 | 5; label: string } {
  const skill = venue.ai.skill ?? 1
  if (skill <= 0.35) return { level: 1, label: 'Gentle' }
  if (skill <= 0.5) return { level: 2, label: 'Casual' }
  if (skill <= 0.7) return { level: 3, label: 'Regulars' }
  if (skill <= 0.9) return { level: 4, label: 'Sharp' }
  return { level: 5, label: 'Expert' }
}

/** What is different about how this table plays, where anything is. */
function formatNote(venue: Venue): string | null {
  if (venue.cash)
    return 'Cash game. No prize and no clock. Sit down with a stack, play as many hands as you like, and stand up whenever with what is in front of you. Bust and you can rebuy or walk.'
  if (venue.daily)
    return `One tournament a day, free to enter, with the same cards for everyone. You play at the ${venue.dailyTier ?? 'Amateur'} tier: the higher your rank, the harder the regulars play and the more it pays. You get one go, and leaving early still counts.`
  switch (venue.format) {
    case 'turbo':
      return `Blinds rise every ${venue.handsPerLevel} hands instead of ${HANDS_PER_LEVEL}.`
    case 'hyper':
      return `Short stacks, and blinds rising every ${venue.handsPerLevel} hands.`
    case 'deep':
      return 'Everyone starts with double the usual chips and the blinds climb slowly.'
    case 'duel':
      return 'One opponent, every hand contested. Fold too much and the blinds eat you.'
    case 'bounty':
      return 'Bust an opponent and their bounty pays into your Roll on the spot.'
    default:
      return null
  }
}

/** Your record at these tables, in one line, or null if you have not sat down. */
function recordLine(records: readonly (VenueRecord | undefined)[], cash: boolean): string | null {
  const played = records.filter((r): r is VenueRecord => Boolean(r))
  const entered = played.reduce((n, r) => n + r.entered, 0)
  if (entered === 0) return null
  const times = `${entered} ${entered === 1 ? 'time' : 'times'}`
  if (cash) return `Sat down ${times}`
  const won = played.reduce((n, r) => n + r.won, 0)
  if (won > 0) return `Won ${won} of ${entered}`
  const finishes = played.flatMap((r) => (r.bestFinish ? [r.bestFinish] : []))
  if (finishes.length > 0) return `Best finish ${ordinal(Math.min(...finishes))}, played ${times}`
  return `Played ${times}`
}

/** What the button says when the table will not seat you. */
function refusalLabel(refusal: SitDownRefusal, venue: Venue): string {
  switch (refusal) {
    case 'members-only':
      return MEMBERS_ONLY_NOTE
    case 'cannot-afford':
      return `Need ${money(venue.buyIn)} to buy in`
    case 'freeroll-closed':
      return 'Opens when you run out of chips'
    case 'not-your-challenge':
      return 'No challenge waiting here'
    case 'streak-locked':
      return 'Not unlocked yet'
  }
}

/** The way in, as the button reads it. */
function playLabel(venue: Venue, sitDown: boolean): string {
  if (venue.freeroll || venue.buyIn === 0) return 'Play free'
  return sitDown ? `Sit down for ${money(venue.buyIn)}` : `Play for ${money(venue.buyIn)}`
}

// --- the frame ---------------------------------------------------------------

interface Back {
  href: string
  label: string
}

/** Back to the lobby, when the page was opened from it (`?from=home`). */
function backFor(fallback: Back): Back {
  const from = new URLSearchParams(window.location.search).get('from')
  return from === 'home' ? { href: '/game', label: 'Menu' } : fallback
}

function Screen({
  back,
  title,
  children,
}: {
  back: Back
  title: string
  children: React.ReactNode
}) {
  const router = useRouter()
  return (
    <PageShell
      leading="back"
      backLabel={back.label}
      title={<span className="text-sm font-semibold">{title}</span>}
      onBack={() => router.push(back.href)}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mx-auto flex w-full max-w-md flex-col gap-5 md:max-w-xl"
      >
        {children}
      </motion.div>
    </PageShell>
  )
}

/** The card: the art over the name, the line, your record and what follows. */
function TableCard({
  art,
  accent,
  kicker,
  name,
  line,
  record,
  children,
}: {
  art: React.ReactNode
  accent: string
  kicker?: string | null
  name: string
  line: string
  record: string | null
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        backgroundImage: `radial-gradient(120% 60% at 0% 100%, ${accent}14, transparent 60%)`,
      }}
      className="overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/[0.03] shadow-xl shadow-black/30"
    >
      <div className="relative aspect-[2/1] w-full overflow-hidden">
        {art}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>
      <div className="flex flex-col gap-5 p-5 md:p-6">
        <div>
          {kicker && (
            <span className="mb-0.5 block text-sm font-medium" style={{ color: accent }}>
              {kicker}
            </span>
          )}
          <h1 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
            {name}
          </h1>
          <p className="mt-1 text-muted-foreground">{line}</p>
          {record && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
              <Star className="size-3.5 fill-pip text-pip" />
              {record}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * The facts, as small tiles two to a row. A wrap rather than a grid so a tile
 * left on its own grows to fill its row instead of leaving a hole beside it.
 */
function Facts({ children }: { children: React.ReactNode }) {
  return <dl className="flex flex-wrap gap-2">{children}</dl>
}

const TILE = 'grow basis-[calc(50%-0.25rem)] rounded-2xl bg-foreground/[0.04] px-3.5 py-2.5'

function Fact({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn(TILE, wide && 'basis-full')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

/** The five-dot difficulty read, beside its word. */
function Players({ from, to }: { from: Venue; to?: Venue }) {
  const easiest = difficulty(from)
  const hardest = difficulty(to ?? from)
  return (
    <span className="flex items-center gap-2">
      {easiest.label === hardest.label ? easiest.label : `${easiest.label} to ${hardest.label}`}
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={cn(
              'size-1.5 rounded-full',
              i <= hardest.level
                ? i < easiest.level
                  ? 'bg-foreground/30'
                  : 'bg-foreground/80'
                : 'bg-foreground/15',
            )}
          />
        ))}
      </span>
    </span>
  )
}

function Note({ text }: { text: string | null }) {
  if (!text) return null
  return <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
}

function PlayButton({ label, onPlay }: { label: string; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        sound.play('call')
        onPlay()
      }}
      className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-black/20 transition hover:bg-primary/90 active:scale-[0.98]"
    >
      {label}
      <ChevronRight className="size-4" />
    </button>
  )
}

/** A way in that is shut, in plain words. With `href` it goes where it is opened. */
function Shut({ label, href }: { label: string; href?: string | null }) {
  const body = (
    <>
      <Lock className="size-4" />
      {label}
      {href && <ChevronRight className="size-4 opacity-70" />}
    </>
  )
  const style =
    'flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground/[0.06] py-3.5 text-base font-semibold text-muted-foreground ring-1 ring-foreground/10'
  return href ? (
    <Link
      href={href}
      onClick={() => sound.play('tap')}
      className={cn(style, 'transition hover:bg-foreground/[0.09] hover:text-foreground')}
    >
      {body}
    </Link>
  ) : (
    <div className={style}>{body}</div>
  )
}

function FreeNote() {
  return (
    <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-foreground">
      {TASTE_COPY.note}
    </p>
  )
}

/** The facts of one table as it will be sat down at. */
function VenueFacts({
  venue,
  table,
  onSeats,
}: {
  venue: Venue
  table: Venue
  onSeats: (seats: number) => void
}) {
  const choices = seatChoices(venue)
  const rung = VENUES.findIndex((v) => v.id === venue.id) + 1
  const pace = venue.handsPerLevel ?? HANDS_PER_LEVEL
  const blinds = `${money(venue.smallBlind)}/${money(venue.bigBlind)}`
  return (
    <Facts>
      <Fact
        label="Buy-in"
        value={venue.freeroll || venue.buyIn === 0 ? 'Free' : money(venue.buyIn)}
      />
      <Fact label="Starting stack" value={money(venue.startingStack ?? venue.buyIn)} />
      <Fact
        label="Blinds"
        value={
          venue.escalation !== false ? `${blinds}, up every ${pace} hands` : `${blinds}, fixed`
        }
        wide
      />
      {!venue.cash && <Fact label="Winner takes" value={money(table.prize)} />}
      {venue.runnerUpPrize !== undefined && (
        <Fact label="Second takes" value={money(venue.runnerUpPrize)} />
      )}
      {venue.bounty !== undefined && (
        <Fact label="Each knockout" value={`+${money(venue.bounty)}`} />
      )}
      {!choices && <Fact label="Seats" value={`${venue.seats} players`} />}
      <Fact label="Players" value={<Players from={venue} />} />
      {rung > 0 && <Fact label="Ladder" value={`Rung ${rung} of ${VENUES.length}`} />}
      {choices && (
        <div className={cn(TILE, 'basis-full')}>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Seats</span>
            <span className="text-sm font-semibold tabular-nums">
              {table.seats} players{table.seats === venue.seats ? '' : `, usually ${venue.seats}`}
            </span>
          </div>
          <Segmented
            options={choices.map((n) => ({ value: n, label: String(n) }))}
            value={table.seats}
            onPick={onSeats}
          />
        </div>
      )}
    </Facts>
  )
}

/** The cover: a face for a challenger, the room's own painting otherwise. */
function cover(
  venue: Venue,
  accent: string,
  challenger?: React.ComponentProps<typeof ChallengerFace>['character'],
) {
  const art = 'absolute inset-0 size-full'
  if (challenger) return <ChallengerFace character={challenger} accent={accent} className={art} />
  if (venue.cash || venue.daily)
    return <CategoryArt id={venue.id} accent={accent} className={art} />
  return <VenueArt id={venue.id} accent={accent} className={art} />
}

// --- one table ---------------------------------------------------------------

/** Where a table's page goes back to when nothing says otherwise. */
function homeOf(venue: Venue): Back {
  if (venue.cash) return { href: '/game/rail', label: 'The Rail' }
  if (VENUES.some((v) => v.id === venue.id)) return { href: '/game/ladder', label: 'Venues' }
  return { href: '/game', label: 'Menu' }
}

/** The page for one table: a ladder rung, a Rail room, the Daily, a challenge. */
export function VenueScreen({ id }: { id: string }) {
  const ready = useRequireProfile()
  if (!ready) return <Splash />
  return <VenueScreenBody id={id} />
}

function VenueScreenBody({ id }: { id: string }) {
  const router = useRouter()
  const member = useEntitlement()
  const roll = useProfile((s) => s.roll)
  const escrow = useProfile((s) => s.escrow)
  const peakRoll = useProfile((s) => s.peakRoll)
  const venueRecords = useProfile((s) => s.venueRecords)
  const challengeWins = useProfile((s) => s.challengeWins)
  const challengesPlayed = useProfile((s) => s.challengesPlayed)
  const owned = useProfile((s) => s.owned)
  const daily = useProfile((s) => s.daily)
  const [seats, setSeats] = useState<number | null>(null)

  const base = venueById(id)
  if (!base) return <Splash />
  // The Daily at this player's tier, the one the route will seat them at.
  const venue = base.daily ? dailyFor(peakRoll) : base
  const table = withSeats(venue, seats)

  const input = { roll, escrow, venueRecords, challengeWins, challengesPlayed, owned }
  const device = deviceId()
  const challenge = isChallengeTable(venue) ? challengeOnOffer(input, device) : null
  const challenger = challenge?.venue.id === venue.id ? challenge.character : undefined
  const refusal = refuseSitDown(venue, input, device, member)
  const playedToday = venue.daily === true && daily?.date === dailyDateKey()

  const name = challenger?.name ?? venue.name
  return (
    <Screen back={backFor(homeOf(venue))} title={name}>
      <TableCard
        art={cover(venue, venue.accent, challenger)}
        accent={venue.accent}
        kicker={challenger ? venue.name : venueTag(venue)}
        name={name}
        line={challenger?.lines.challenge ?? venue.tagline}
        record={recordLine([venueRecords[venue.id]], Boolean(venue.cash))}
      >
        <VenueFacts venue={venue} table={table} onSeats={setSeats} />
        <Note text={formatNote(venue)} />
        {playedToday ? (
          <Shut label="Played today" />
        ) : refusal ? (
          <Shut
            label={refusalLabel(refusal, venue)}
            href={refusal === 'members-only' ? membershipForVenue(venue) : null}
          />
        ) : (
          <PlayButton
            label={playLabel(venue, Boolean(venue.cash || challenger))}
            onPlay={() => router.push(playPath(table))}
          />
        )}
      </TableCard>
    </Screen>
  )
}

// --- a side-tables family ----------------------------------------------------

/** The page for one card on the side tables: the game, and its prices. */
export function FamilyScreen({ id }: { id: string }) {
  const ready = useRequireProfile()
  if (!ready) return <Splash />
  return <FamilyScreenBody id={id} />
}

function FamilyScreenBody({ id }: { id: string }) {
  const router = useRouter()
  const member = useEntitlement()
  const checked = useMembership((s) => s.checked)
  const spendable = useSpendableRoll()
  const venueRecords = useProfile((s) => s.venueRecords)
  const taste = useTaste()

  const family = SIDE_SHELF.find((f) => f.id === id)
  if (!family) return <Splash />

  // One member game a day is free (docs/membership.md), the same as the shelf:
  // while today's is unspent a locked family opens as a member's would and
  // says so; once spent it is shut, with the limit card under it.
  const locked = memberLocked(family, member)
  const tasting = locked && taste.left
  const shut = locked && !taste.left
  const stakes = family.rooms.length > 1 ? family.rooms : null
  const room = family.rooms[0]
  const play = (venue: Venue) => router.push(playPath(venue))

  return (
    <Screen back={backFor({ href: '/game/side', label: 'Side Tables' })} title={family.game}>
      <TableCard
        art={
          <VenueArt id={family.art} accent={family.accent} className="absolute inset-0 size-full" />
        }
        accent={family.accent}
        kicker={houseName(family)}
        name={family.game}
        line={family.short}
        record={recordLine(
          family.rooms.map((r) => venueRecords[r.id]),
          false,
        )}
      >
        {stakes ? (
          <FamilyFacts stakes={stakes} />
        ) : (
          <VenueFacts venue={room} table={room} onSeats={() => {}} />
        )}
        <Note text={family.note} />
        {tasting && <FreeNote />}
        {/* Nothing until the membership has answered, so a member never sees
            the lock flash past on the way to their own table. */}
        {locked && !checked ? null : shut ? (
          <Shut label={MEMBERS_ONLY_NOTE} href={membershipForFamily(family)} />
        ) : stakes ? (
          <StakeOptions
            family={family}
            spendable={spendable}
            records={venueRecords}
            onPlay={play}
          />
        ) : spendable >= room.buyIn ? (
          <PlayButton label={playLabel(room, false)} onPlay={() => play(room)} />
        ) : (
          <Shut label={`Need ${money(room.buyIn)} to buy in`} />
        )}
      </TableCard>
      {shut && checked && taste.ready && taste.record && <LimitCard kind="table" narrow />}
    </Screen>
  )
}

/**
 * The structure of a family whose price is still to be picked: what holds
 * across every stake stated flat, and what scales with the buy-in stated as the
 * multiple it is, checked against every stake rather than read off one.
 */
function FamilyFacts({ stakes }: { stakes: readonly Venue[] }) {
  const cheapest = stakes[0]
  const dearest = stakes[stakes.length - 1]
  const shared = <T,>(read: (v: Venue) => T): T | null => {
    const first = read(stakes[0])
    return stakes.every((s) => read(s) === first) ? first : null
  }
  const multiple = (read: (v: Venue) => number) => shared((v) => read(v) / v.buyIn)
  const range = (read: (v: Venue) => number) =>
    `${money(read(cheapest))} to ${money(read(dearest))}`
  const stack = multiple((v) => v.startingStack ?? v.buyIn)
  const prize = multiple((v) => v.prize)
  const seats = shared((v) => v.seats)
  const pace = shared((v) => v.handsPerLevel ?? HANDS_PER_LEVEL)

  return (
    <Facts>
      <Fact label="Buy-in" value={range((v) => v.buyIn)} wide />
      <Fact
        label="Starting stack"
        value={stack ? `${stack}× the buy-in` : range((v) => v.startingStack ?? v.buyIn)}
      />
      <Fact label="Winner takes" value={prize ? `${prize}× the buy-in` : range((v) => v.prize)} />
      {seats !== null && <Fact label="Seats" value={`${seats} players`} />}
      {pace !== null && <Fact label="Blinds" value={`Up every ${pace} hands`} />}
      <Fact label="Players" value={<Players from={cheapest} to={dearest} />} wide />
    </Facts>
  )
}

/** Every price as a big option. A tap sits you down at that one. */
function StakeOptions({
  family,
  spendable,
  records,
  onPlay,
}: {
  family: TableFamily
  spendable: number
  records: Record<string, VenueRecord>
  onPlay: (venue: Venue) => void
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="text-sm font-semibold">Choose your table</h2>
      {family.rooms.map((room) => {
        const open = spendable >= room.buyIn
        const record = recordLine([records[room.id]], false)
        const facts = `Start with ${money(room.startingStack ?? room.buyIn)}${room.prize > 0 ? `, win ${money(room.prize)}` : ''}`
        return (
          <button
            key={room.id}
            type="button"
            disabled={!open}
            onClick={() => {
              sound.play('call')
              onPlay(room)
            }}
            style={
              open
                ? {
                    backgroundImage: `radial-gradient(120% 120% at 0% 100%, ${family.accent}1f, transparent 65%)`,
                  }
                : undefined
            }
            className={cn(
              'group flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition',
              open
                ? 'border-foreground/10 bg-foreground/[0.04] shadow-md shadow-black/20 hover:border-foreground/25 hover:bg-foreground/[0.07] active:scale-[0.985]'
                : 'cursor-not-allowed border-foreground/[0.06] opacity-60',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="text-xl font-semibold tabular-nums tracking-tight">
                  {money(room.buyIn)}
                </span>
                <span className="truncate text-sm text-muted-foreground">{room.name}</span>
              </span>
              <span className="mt-0.5 block text-sm tabular-nums text-muted-foreground">
                {open ? facts : `Need ${money(room.buyIn)} to buy in`}
              </span>
              {record && open && (
                <span className="mt-1 flex items-center gap-1 text-xs font-medium tabular-nums">
                  <Star className="size-3 fill-pip text-pip" />
                  {record}
                </span>
              )}
            </span>
            <span className="hidden shrink-0 text-xs font-medium text-muted-foreground sm:block">
              {difficulty(room).label}
            </span>
            {open ? (
              <ChevronRight className="size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            ) : (
              <Lock className="size-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        )
      })}
    </div>
  )
}
