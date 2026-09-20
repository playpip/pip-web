'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExpandableNote } from '@/components/menu/ExpandableNote'
import { VenueArt } from '@/components/menu/VenueArt'
import { CategoryArt } from '@/components/menu/CategoryArt'
import { ChallengerFace } from '@/components/menu/ChallengerFace'
import { ChevronLeft, Lock, XIcon } from 'lucide-react'
import { HANDS_PER_LEVEL } from '@/config/blinds'
import type { Character } from '@/config/cast'
import { VENUES, venueTag, type TableFamily, type Venue } from '@/config/venues'
import { useState } from 'react'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

/** Difficulty read derived from the venue's actual AI profile. */
function venueDifficulty(venue: Venue): { level: 1 | 2 | 3 | 4 | 5; label: string; blurb: string } {
  const skill = venue.ai.skill ?? 1
  const style = [
    venue.ai.tightness >= 0.45 ? 'tight' : 'loose',
    venue.ai.aggression >= 0.5 ? 'aggressive' : 'passive',
  ].join(' and ')

  if (skill <= 0.35)
    return {
      level: 1,
      label: 'Gentle',
      blurb: `They just learned the game — ${style}, they misread their hands and give up under pressure.`,
    }
  if (skill <= 0.5)
    return {
      level: 2,
      label: 'Casual',
      blurb: `Casual players with real leaks — ${style}, and full of mistakes you can profit from.`,
    }
  if (skill <= 0.7)
    return {
      level: 3,
      label: 'Regulars',
      blurb: `Regulars who know the game but still bleed chips — ${style}, with plenty of misreads left in them.`,
    }
  if (skill <= 0.9)
    return {
      level: 4,
      label: 'Sharp',
      blurb: `Sharp, disciplined players — ${style}; mistakes are rare, and they punish yours.`,
    }
  return {
    level: 5,
    label: 'Expert',
    blurb: `They play close to perfect poker — ${style}, merciless with an edge.`,
  }
}

function formatNote(venue: Venue): string | null {
  if (venue.cash)
    return `Cash game — no prize and no clock. Sit down with a stack, play as many hands as you fancy, and stand up whenever with whatever's in front of you. Bust and you can rebuy or walk; the table doesn't mind either way.`
  if (venue.daily)
    return `The Daily — one seeded deal a day, and everyone who plays gets the identical shuffle. Same cards, same opponents; your play makes the difference. You get one shot: sitting down spends today's, and leaving early still counts as played.`
  // Before the format switch, because the game being dealt outranks the speed
  // it is dealt at. The Big Pot is registered as a `deep` table, so without
  // this the one venue in the app that does not deal Hold'em described its
  // blind structure and never mentioned Omaha at all (Will, 2026-09-20).
  if (venue.variant === 'omaha')
    return `Pot-Limit Omaha — four cards in your hand instead of two, and at showdown you must use exactly two of them with exactly three from the board. No more, no less: four to a flush on the board plus one in your hand is nothing here. Four cards make far more big hands, so one pair rarely wins and straights and flushes are ordinary. Pot-limit means the largest bet allowed is the size of the pot, so nobody shoves all-in before the flop. Stacks start deep because Omaha is a drawing game and short ones turn it into a coin flip.`
  switch (venue.format) {
    case 'turbo':
      return `Turbo — blinds rise every ${venue.handsPerLevel} hands instead of ${HANDS_PER_LEVEL}. Short stacks arrive fast; patience is a liability.`
    case 'hyper':
      return `Hyper — shallow stacks and blinds rising every ${venue.handsPerLevel} hands. Every decision arrives at speed; shove-or-fold poker.`
    case 'deep':
      return `Deep stack — everyone starts with double the usual chips and blinds climb slowly. Post-flop poker, rewarded.`
    case 'duel':
      return `Heads-up — one opponent, every hand contested. Fold too much and the blinds eat you.`
    case 'bounty':
      return `Bounty — take every chip in a hand that busts an opponent and their bounty pays into your Roll on the spot.`
    default:
      return null
  }
}

/** The little "about this table" dialog — structure, format, difficulty. */
export function VenueInfoDialog({
  venue,
  challenger,
  playable,
  canAfford,
  lockedNote,
  family,
  onOpenChange,
  onPlay,
}: {
  venue: Venue | null
  /**
   * Who is sitting opposite, at a challenge table. Their face becomes the cover
   * and their invitation the strapline: the challenge tables share one name and
   * one tagline across three bands, so without this the dialog would open on
   * "The Challenge" and say nothing about the person who asked for the game.
   */
  challenger?: Character
  playable: boolean
  /**
   * Can the Roll cover this stake?
   *
   * Needed only where the dialog can change which venue it is showing: a player
   * who opens Deep Stack at 2,000 and taps 40,000 has not changed their Roll,
   * and `playable` was decided about the card they tapped. Without this the Play
   * button stays lit on a stake they cannot buy into, and the route refuses them
   * — the dead click `lib/sitDown` exists to prevent, reintroduced one dialog
   * over. Omitted where nothing can change (the Daily).
   */
  canAfford?: (venue: Venue) => boolean
  /**
   * Why this table is shut, when the reason is not the Roll.
   *
   * Without it the dialog can only refuse in one currency, and told a
   * non-member with 1,800 chips that a 750 Deep Stack needed 750 — a lie told
   * to somebody whose Roll is fine, and the worst kind, because they can act on
   * it. `venueCard.tsx` learned this on the tiles; the dialog had not
   * (Will, 2026-09-20).
   *
   * It takes precedence over everything below, including the stake picker: a
   * table you cannot sit at should not offer you five prices for it.
   */
  lockedNote?: string
  /**
   * The side-tables card this dialog was opened from, when it was one.
   *
   * A family is one idea (Fast, Bounty, Deep, a different game) with its rooms
   * priced behind it, so the header describes the family and the second screen
   * lists the rooms. It generalises what Deep Stack had hard-coded here: the
   * dialog used to ask `isDeepStack(venue)`, which worked for exactly one card
   * and would have needed a second special case per family after that.
   */
  family?: TableFamily | null
  onOpenChange: (open: boolean) => void
  onPlay: (venue: Venue) => void
}) {
  const money = useMoney()
  // Which view is showing, on a table that has more than one stake.
  //
  // Deep Stack is five registered venues wearing one card (config/venues.ts).
  // The five used to be a row of pills inside this dialog, which pushed the
  // Play button below the fold — you had to scroll a popup to find the one
  // control it exists for (Will, 2026-09-20). So picking a stake is now a
  // second screen rather than a section: this view describes the table, and
  // the button opens the one that prices it.
  //
  // Reset on close rather than by an effect. `open` is `venue !== null`, so
  // this component stays mounted between openings and would otherwise reopen
  // straight into the picker.
  const [picking, setPicking] = useState(false)
  if (!venue) return <Dialog open={false} onOpenChange={onOpenChange} />

  // A family with one room is not a choice, so it renders as the plain table it
  // is — no second screen, no "choose your stake" over a list of one.
  const stakes = family && family.rooms.length > 1 ? family.rooms : null
  // What the header describes, and where the cover art comes from.
  const head = {
    name: family?.name ?? venue.name,
    tagline: family?.tagline ?? venue.tagline,
    accent: family?.accent ?? venue.accent,
    tag: family?.tag ?? venueTag(venue),
    art: family?.art ?? venue.id,
  }
  const difficulty = venueDifficulty(venue)
  const rung = VENUES.findIndex((v) => v.id === venue.id) + 1
  const note = family?.note ?? formatNote(venue)
  const escalates = venue.escalation !== false
  const pace = venue.handsPerLevel ?? HANDS_PER_LEVEL

  const close = (open: boolean) => {
    if (!open) setPicking(false)
    onOpenChange(open)
  }

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm" showCloseButton={false}>
        {/* cover photo — the venue art bleeds to the edges and fades into the
            dialog, with the name and format riding the gradient at the bottom. */}
        <header className="relative shrink-0 overflow-hidden">
          {/* Softly blurred + scaled so the flat art reads as a cover photo and
              melts into the dialog; scale hides the blur's transparent edges. */}
          {/* A face is not scenery: it gets no blur and no scale, because the
              point of the challenger's cover is that you can see who it is. */}
          {challenger ? (
            <ChallengerFace character={challenger} accent={head.accent} className="h-40 w-full" />
          ) : !family && (venue.cash || venue.daily) ? (
            <CategoryArt
              id={venue.id}
              accent={head.accent}
              className="h-40 w-full scale-110 blur-[3px]"
            />
          ) : (
            <VenueArt
              id={head.art}
              accent={head.accent}
              className="h-40 w-full scale-110 blur-[3px]"
            />
          )}
          {/* Fixed dark scrim (not theme-tinted) so white cover text stays
              legible over the photo in both light and dark mode. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />
          {/* Close sits over the photo, so it carries its own fixed-contrast
              scrim rather than the theme-flipping ghost treatment. */}
          <DialogClose
            aria-label="Close"
            className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full bg-black/35 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/55 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            <XIcon className="size-4" />
          </DialogClose>
          {/* Mirrors the close button, and only on the second screen: a way
              back to the description you were reading a moment ago. */}
          {picking && (
            <button
              type="button"
              aria-label="Back"
              onClick={() => setPicking(false)}
              className="absolute top-2.5 left-2.5 grid size-7 place-items-center rounded-full bg-black/35 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/55 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg text-white">
              {picking ? 'Choose your table' : (challenger?.name ?? head.name)}
              {!picking && head.tag && (
                <span
                  className="rounded bg-white/15 px-1.5 py-0.5 text-2xs font-semibold"
                  style={{ color: head.accent }}
                >
                  {head.tag}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="leading-snug text-white/75">
              {picking
                ? 'The price picks the room, and the room picks the company: you sit against whoever plays for that at the same stake elsewhere.'
                : (challenger?.lines.challenge ?? head.tagline)}
            </DialogDescription>
          </div>
        </header>

        {/* Scrolls on its own: the popup clips (`overflow-hidden` keeps the
            cover art inside the rounded corners) so it cannot be the scroller
            here, and the cover has to stay whole while the text below it grows. */}
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto p-4">
          {stakes && picking ? (
            <StakePicker stakes={stakes} canAfford={canAfford} onPlay={onPlay} />
          ) : (
            <>
              {/* difficulty */}
              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    The players
                  </p>
                  {stakes ? (
                    <DifficultyRange stakes={stakes} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{difficulty.label}</span>
                      <Dots level={difficulty.level} />
                    </div>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {stakes
                    ? 'You sit against whoever plays for that price elsewhere in the game, so the stake is the difficulty. There is no difficulty setting here on purpose.'
                    : difficulty.blurb}
                </p>
              </section>

              {/* format */}
              {note && (
                <section>
                  <p className="mb-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                    How it plays
                  </p>
                  <ExpandableNote text={note} />
                </section>
              )}

              {/* structure — stated in ratios where the stake is still to be
                  chosen, because a single column of numbers would be one of the
                  five stakes pretending to be the table. */}
              <section>
                <p className="mb-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  The table
                </p>
                <div className="flex flex-col">
                  {stakes ? (
                    <StakeFamilyRows stakes={stakes} />
                  ) : (
                    <>
                      <InfoRow
                        label="Buy-in"
                        value={venue.freeroll ? 'Free' : money(venue.buyIn)}
                      />
                      <InfoRow
                        label="Starting stack"
                        value={money(venue.startingStack ?? venue.buyIn)}
                      />
                      <InfoRow label="Seats" value={`${venue.seats} players`} />
                      <InfoRow
                        label="Blinds"
                        value={
                          escalates
                            ? `${money(venue.smallBlind)}/${money(venue.bigBlind)}, rising every ${pace} hands`
                            : `${money(venue.smallBlind)}/${money(venue.bigBlind)}, fixed`
                        }
                      />
                      {!venue.cash && <InfoRow label="Winner takes" value={money(venue.prize)} />}
                      {venue.bounty !== undefined && (
                        <InfoRow label="Knockout bounty" value={`+${money(venue.bounty)} each`} />
                      )}
                      {rung > 0 && (
                        <InfoRow label="Ladder" value={`Rung ${rung} of ${VENUES.length}`} />
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* confirm — the play button lives here, so tapping a venue opens
                  this dialog and playing is a deliberate second tap. On a table
                  with five prices it opens the screen that picks one instead;
                  the buy-in is still confirmed before any chips move. */}
              {lockedNote ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-foreground/10 py-3 text-sm text-muted-foreground">
                  <Lock className="size-4" /> {lockedNote}
                </div>
              ) : stakes ? (
                <button
                  onClick={() => setPicking(true)}
                  className="w-full rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
                >
                  Choose your table
                </button>
              ) : playable && (canAfford?.(venue) ?? true) ? (
                <button
                  onClick={() => onPlay(venue)}
                  className="w-full rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
                >
                  {venue.freeroll
                    ? 'Play — free'
                    : venue.cash || challenger
                      ? `Sit down — ${money(venue.buyIn)}`
                      : `Play — ${money(venue.buyIn)}`}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-foreground/10 py-3 text-sm text-muted-foreground">
                  <Lock className="size-4" /> Need {money(venue.buyIn)} to buy in
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The five-dot difficulty read. */
function Dots({ level, from = 1 }: { level: number; from?: number }) {
  return (
    <span className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            'size-1.5 rounded-full',
            i <= level ? (i < from ? 'bg-foreground/30' : 'bg-foreground/80') : 'bg-foreground/15',
          )}
        />
      ))}
    </span>
  )
}

/**
 * Difficulty as a span rather than a point, for a table sold at five prices.
 *
 * Both ends are read off the real AI profiles, so a stake retuned in
 * `config/venues.ts` moves this label without anybody remembering to.
 */
function DifficultyRange({ stakes }: { stakes: readonly Venue[] }) {
  const easiest = venueDifficulty(stakes[0])
  const hardest = venueDifficulty(stakes[stakes.length - 1])
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium">
        {easiest.label === hardest.label ? easiest.label : `${easiest.label} – ${hardest.label}`}
      </span>
      <Dots level={hardest.level} from={easiest.level} />
    </div>
  )
}

/**
 * The structure of a table whose price is still to be picked.
 *
 * Everything that holds across the family is stated flat; everything that
 * scales with the buy-in is stated as the multiple it actually is, checked
 * against every stake rather than read off one. A stake added later with a
 * different ratio makes this fall back to a range instead of quietly printing
 * a number that is true of four tables out of five.
 */
function StakeFamilyRows({ stakes }: { stakes: readonly Venue[] }) {
  const money = useMoney()
  const cheapest = stakes[0]
  const dearest = stakes[stakes.length - 1]

  /** The value every stake shares, or `null` if they disagree. */
  const shared = <T,>(read: (v: Venue) => T): T | null => {
    const first = read(stakes[0])
    return stakes.every((s) => read(s) === first) ? first : null
  }
  /** The multiple of the buy-in every stake shares, or `null`. */
  const multiple = (read: (v: Venue) => number): number | null => shared((v) => read(v) / v.buyIn)

  const stack = multiple((v) => v.startingStack ?? v.buyIn)
  const prize = multiple((v) => v.prize)
  const seats = shared((v) => v.seats)
  const pace = shared((v) => v.handsPerLevel ?? HANDS_PER_LEVEL)
  const range = (read: (v: Venue) => number) => `${money(read(cheapest))} – ${money(read(dearest))}`

  return (
    <>
      <InfoRow label="Buy-in" value={`${range((v) => v.buyIn)} · ${stakes.length} stakes`} />
      <InfoRow
        label="Starting stack"
        value={stack ? `${stack}× the buy-in` : range((v) => v.startingStack ?? v.buyIn)}
      />
      {seats !== null && <InfoRow label="Seats" value={`${seats} players`} />}
      {pace !== null && <InfoRow label="Blinds" value={`Rising every ${pace} hands`} />}
      <InfoRow
        label="Winner takes"
        value={prize ? `${prize}× the buy-in` : range((v) => v.prize)}
      />
    </>
  )
}

/**
 * The second screen: five prices, each one a table you can sit at now.
 *
 * A row per stake rather than a row of pills, because a pill can only carry the
 * price and the price is the least of what changes — the stack, the prize and
 * who is sitting there all move with it. Tapping a row sits you down: you have
 * already opened the venue and chosen to come here, so a further confirm would
 * be a third gate on one decision.
 *
 * **Each row is priced on its own.** It briefly also required the caller's
 * `playable`, which is decided about the card you tapped — and the card is the
 * 2,000 stake, so a Roll of 1,800 locked all five rooms including the 750 one.
 * Whether this screen may be reached at all is settled before it renders
 * (`lockedNote`), so the only question left here is the price of each row.
 */
function StakePicker({
  stakes,
  canAfford,
  onPlay,
}: {
  stakes: readonly Venue[]
  canAfford?: (venue: Venue) => boolean
  onPlay: (venue: Venue) => void
}) {
  const money = useMoney()
  return (
    <div className="flex flex-col gap-2">
      {stakes.map((option) => {
        const affordable = canAfford?.(option) ?? true
        const difficulty = venueDifficulty(option)
        return affordable ? (
          <button
            key={option.id}
            onClick={() => onPlay(option)}
            className="flex items-center justify-between gap-3 rounded-2xl border border-foreground/10 px-4 py-3 text-left transition hover:border-foreground/25 hover:bg-foreground/[0.04] active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="truncate font-semibold">{option.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {money(option.buyIn)}
                </span>
              </span>
              <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                Start with {money(option.startingStack ?? option.buyIn)}
                {option.prize > 0 && ` · win ${money(option.prize)}`}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{difficulty.label}</span>
          </button>
        ) : (
          <div
            key={option.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-foreground/10 px-4 py-3 opacity-60"
          >
            <span className="min-w-0">
              <span className="truncate font-semibold">{option.name}</span>
              <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                Need {money(option.buyIn)} to buy in
              </span>
            </span>
            <Lock className="size-4 shrink-0 text-muted-foreground" />
          </div>
        )
      })}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-foreground/[0.06] py-1.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  )
}
