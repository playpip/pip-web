'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
      blurb: `Casual players with real leaks — ${style}, and prone to mistakes you can profit from.`,
    }
  if (skill <= 0.7)
    return {
      level: 3,
      label: 'Solid',
      blurb: `Solid players with habits — ${style}, and only the occasional slip.`,
    }
  if (skill <= 0.9)
    return {
      level: 4,
      label: 'Sharp',
      blurb: `Sharp, disciplined players — ${style}, and they rarely misstep.`,
    }
  return {
    level: 5,
    label: 'Expert',
    blurb: `They play close to perfect poker — ${style}, merciless with an edge.`,
  }
}

function formatNote(venue: Venue): string | null {
  switch (venue.format) {
    case 'turbo':
      return `Turbo — blinds rise every ${venue.handsPerLevel} hands instead of ${HANDS_PER_LEVEL}. Short stacks arrive fast; patience is a liability.`
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
  onOpenChange,
}: {
  venue: Venue | null
  onOpenChange: (open: boolean) => void
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {venue.name}
            {venue.format && (
              <span
                className="rounded bg-foreground/[0.06] px-1.5 py-0.5 text-[11px] font-semibold"
                style={{ color: venue.accent }}
              >
                {FORMAT_LABELS[venue.format]}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>{venue.tagline}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 pt-1">
          {/* difficulty */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">The players</p>
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
              <p className="mb-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">The format</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{note}</p>
            </section>
          )}

          {/* structure */}
          <section>
            <p className="mb-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">The table</p>
            <div className="flex flex-col">
              <InfoRow label="Buy-in" value={venue.freeroll ? 'Free' : money(venue.buyIn)} />
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
              <InfoRow label="Winner takes" value={money(venue.prize)} />
              {venue.bounty !== undefined && (
                <InfoRow label="Knockout bounty" value={`+${money(venue.bounty)} each`} />
              )}
              {rung > 0 && <InfoRow label="Ladder" value={`Rung ${rung} of ${VENUES.length}`} />}
            </div>
          </section>
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
