'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useMoney } from '@/lib/useMoney'
import { cn } from '@/lib/utils'

/**
 * "Are you sure?" on leaving a table — shows session P/L and cashes out on
 * confirm. Freerolls cash out nothing (the stack is the house's; only the
 * winner's prize pays), so the dialog says exactly that instead of P/L.
 */
export function LeaveDialog({
  open,
  onOpenChange,
  buyIn,
  stack,
  freeroll = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  buyIn: number
  stack: number
  freeroll?: boolean
  onConfirm: () => void
}) {
  const money = useMoney()
  const pnl = stack - buyIn
  const up = pnl >= 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Leave the table?</DialogTitle>
          <DialogDescription>
            {freeroll
              ? 'It’s a freeroll — the chips stay at the table. Leave now and you walk away with nothing; only winning pays.'
              : 'You’ll cash out your chips and forfeit a shot at the prize.'}
          </DialogDescription>
        </DialogHeader>

        {!freeroll && (
          <div className="pt-1">
            <Row label="Bought in for" value={money(buyIn)} />
            <Row label="Your stack" value={money(stack)} />
            <div className="my-3 h-px bg-foreground/10" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Profit / loss</span>
              <span className={cn('text-lg font-semibold tabular-nums', up ? 'text-emerald-500' : 'text-suit-red')}>
                {up ? '+' : ''}
                {money(pnl)}
              </span>
            </div>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-2xl bg-foreground/[0.06] py-3 font-medium transition hover:bg-foreground/[0.12]"
          >
            Keep playing
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98]"
          >
            {freeroll ? 'Leave' : 'Cash out'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  )
}
