'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { VenueArt } from '@/components/menu/VenueArt'
import { CategoryArt } from '@/components/menu/CategoryArt'
import { Lock, XIcon } from 'lucide-react'
import { HANDS_PER_LEVEL } from '@/config/blinds'
import { FORMAT_LABELS, VENUES, type Venue } from '@/config/venues'
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
  playable,
  onOpenChange,
  onPlay,
}: {
  venue: Venue | null
  playable: boolean
  onOpenChange: (open: boolean) => void
  onPlay: (venue: Venue) => void
}) {
  const money = useMoney()
  if (!venue) return <Dialog open={false} onOpenChange={onOpenChange} />

  const difficulty = venueDifficulty(venue)
  const rung = VENUES.findIndex((v) => v.id === venue.id) + 1
  const note = formatNote(venue)
  const escalates = venue.escalation !== false
  const pace = venue.handsPerLevel ?? HANDS_PER_LEVEL

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm" showCloseButton={false}>
        {/* cover photo — the venue art bleeds to the edges and fades into the
            dialog, with the name and format riding the gradient at the bottom. */}
        <header className="relative overflow-hidden">
          {/* Softly blurred + scaled so the flat art reads as a cover photo and
              melts into the dialog; scale hides the blur's transparent edges. */}
          {venue.cash || venue.daily ? (
            <CategoryArt
              id={venue.id}
              accent={venue.accent}
              className="h-40 w-full scale-110 blur-[3px]"
            />
          ) : (
            <VenueArt
              id={venue.id}
              accent={venue.accent}
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
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
            <DialogTitle className="flex items-center gap-2 text-lg text-white">
              {venue.name}
              {venue.format && (
                <span
                  className="rounded bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold"
                  style={{ color: venue.accent }}
                >
                  {FORMAT_LABELS[venue.format]}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="leading-snug text-white/75">
              {venue.tagline}
            </DialogDescription>
          </div>
        </header>

        <div className="flex flex-col gap-5 p-4">
          {/* difficulty */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                The players
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{difficulty.label}</span>
                <span className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        'size-1.5 rounded-full',
                        i <= difficulty.level ? 'bg-foreground/80' : 'bg-foreground/15',
                      )}
                    />
                  ))}
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{difficulty.blurb}</p>
          </section>

          {/* format */}
          {note && (
            <section>
              <p className="mb-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                How it plays
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{note}</p>
            </section>
          )}

          {/* structure */}
          <section>
            <p className="mb-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              The table
            </p>
            <div className="flex flex-col">
              <InfoRow label="Buy-in" value={venue.freeroll ? 'Free' : money(venue.buyIn)} />
              <InfoRow label="Starting stack" value={money(venue.startingStack ?? venue.buyIn)} />
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
              {rung > 0 && <InfoRow label="Ladder" value={`Rung ${rung} of ${VENUES.length}`} />}
            </div>
          </section>

          {/* confirm — the play button lives here now, so tapping a venue opens
              this dialog and playing is a deliberate second tap. */}
          {playable ? (
            <button
              onClick={() => onPlay(venue)}
              className="w-full rounded-2xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
            >
              {venue.freeroll
                ? 'Play — free'
                : venue.cash
                  ? `Sit down — ${money(venue.buyIn)}`
                  : `Play — ${money(venue.buyIn)}`}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-foreground/10 py-3 text-sm text-muted-foreground">
              <Lock className="size-4" /> Need {money(venue.buyIn)} to buy in
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
