'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { SeatMeta } from '@/store/game'
import { useMoney } from '@/lib/useMoney'

/** A little "about this player" card shown when you tap an opponent. */
export function PlayerDialog({
  open,
  onOpenChange,
  seat,
  stack,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  seat: SeatMeta | null
  stack: number
}) {
  const money = useMoney()
  if (!seat) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader className="items-center text-center">
          <PlayerAvatar spec={seat.avatar} size={88} />
          <DialogTitle>{seat.name}</DialogTitle>
          {seat.style && <DialogDescription>{seat.style}</DialogDescription>}
        </DialogHeader>

        {seat.bio && (
          <p className="text-center text-sm italic text-muted-foreground">&ldquo;{seat.bio}&rdquo;</p>
        )}

        <div className="mt-1 grid grid-cols-2 gap-2">
          <Stat label="At the table" value={money(stack)} />
          <Stat label="Bankroll" value={money(seat.bankroll ?? 0)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-foreground/[0.04] px-3 py-2.5 text-center">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}
