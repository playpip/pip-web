'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { PlayingCard } from '@/components/PlayingCard'
import type { Card } from '@/lib/poker/cards'
import type { SeatMeta } from '@/store/game'
import { useProfile } from '@/store/profile'
import { deriveReads, READS_MIN_HANDS, type SeatStats } from '@/lib/reads'
import { useMoney } from '@/lib/useMoney'

/** A little "about this player" card shown when you tap an opponent. */
export function PlayerDialog({
  open,
  onOpenChange,
  seat,
  stack,
  stats,
  hole,
  equity,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  seat: SeatMeta | null
  stack: number
  stats?: SeatStats
  /**
   * Their actual cards, and their chance of taking it.
   *
   * **Only ever supplied while spectating a tournament you are out of**
   * (pip-web#120). The store returns null for both at every other moment, so
   * this component cannot become a way to see a live opponent's hand by
   * opening a dialog — the refusal is upstream, not a prop nobody passed.
   */
  hole?: readonly Card[] | null
  equity?: number | null
}) {
  const money = useMoney()
  const record = useProfile((s) =>
    seat?.characterId ? s.castRecords[seat.characterId] : undefined,
  )
  if (!seat) return null

  // Cast characters carry their history: reads accumulate across sessions.
  const career = record?.stats
  const reads = deriveReads(career ?? stats)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader className="items-center text-center">
          <PlayerAvatar spec={seat.avatar} size={88} />
          <DialogTitle>{seat.name}</DialogTitle>
          {seat.style && <DialogDescription>{seat.style}</DialogDescription>}
        </DialogHeader>

        {seat.bio && (
          <p className="text-center text-sm italic text-muted-foreground">“{seat.bio}”</p>
        )}

        <div className="mt-1 grid grid-cols-2 gap-2">
          <Stat label="At the table" value={money(stack)} />
          <Stat label="Bankroll" value={money(seat.bankroll ?? 0)} />
        </div>

        {/* The spectator's view: what they are holding and what it is worth
            right now. Absent entirely at a live table. */}
        {hole && hole.length > 0 && (
          <div className="mt-1 flex flex-col items-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3">
            <div className="flex items-center gap-1.5">
              {hole.map((card) => (
                <PlayingCard key={`${card.rank}${card.suit}`} card={card} size="sm" />
              ))}
            </div>
            {equity !== null && equity !== undefined && (
              <p className="text-sm tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{Math.round(equity * 100)}%</span>{' '}
                to win it
              </p>
            )}
          </div>
        )}

        {/* what you've noticed about them — career-long for cast regulars */}
        {!seat.isHuman && (
          <div className="mt-1">
            <p className="mb-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Your reads
            </p>
            {reads ? (
              <div className="flex flex-col gap-2">
                {reads.map((read) => (
                  <div key={read.label} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{read.label}</span>
                    <span className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-foreground/10">
                      <span
                        className="block h-full rounded-full bg-foreground/50"
                        style={{ width: `${Math.round(read.strength * 100)}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Too early to tell — keep watching. Reads appear after {READS_MIN_HANDS} hands.
              </p>
            )}
            {career && career.handsDealt > 0 && (
              <p className="mt-3 text-xs text-muted-foreground/70">
                {career.handsDealt.toLocaleString()} hands together
                {record && record.kos > 0 && <> · busted them {record.kos}×</>}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-foreground/[0.04] px-3 py-2.5 text-center">
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}
