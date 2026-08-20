'use client'

import { Link2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HandTimeline } from '@/components/HandTimeline'
import { useGame } from '@/store/game'
import { encodeHand } from '@/lib/handLink'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { useCopied } from '@/lib/useCopied'

/** Reviewable timeline of the last completed hand. */
export function HandHistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const record = useGame((s) => s.lastHand)
  const money = useMoney()
  const [copied, copy] = useCopied()

  // The hand is IN the link — no server, no account, just a URL fragment.
  const share = () => {
    if (!record) return
    sound.play('tap')
    const url = `${location.origin}/hand#${encodeHand(record)}`
    void navigator.clipboard?.writeText(url).then(() => copy())
  }

  // The close handler used to be the only thing that put this label back.
  // It clears itself now, so closing is just closing.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Last hand</DialogTitle>
          <DialogDescription>
            {record
              ? `Hand #${record.handNo} · Blinds ${money(record.smallBlind)}/${money(record.bigBlind)}`
              : 'Finish a hand to review it here.'}
          </DialogDescription>
        </DialogHeader>

        {record && (
          <>
            <div className="flex max-h-[60vh] min-h-0 flex-col gap-1 overflow-y-auto pt-1">
              <HandTimeline record={record} />
            </div>
            <button
              onClick={share}
              className="mt-1 flex items-center justify-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
            >
              <Link2 className="size-3.5" />
              {copied ? 'Link copied' : 'Share this hand'}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
