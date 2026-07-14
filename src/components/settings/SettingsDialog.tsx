'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { CardBack } from '@/components/CardBack'
import { useProfile } from '@/store/profile'
import { CARD_COLORS, CARD_PATTERNS } from '@/config/cardBacks'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { cardBack, setCardBack } = useProfile()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Customize your card backs.</DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-6 pt-1">
          {/* fanned preview */}
          <div className="flex justify-center py-2">
            <div className="-rotate-[8deg]">
              <CardBack design={cardBack} size="md" />
            </div>
            <div className="-ml-6 rotate-[8deg]">
              <CardBack design={cardBack} size="md" />
            </div>
          </div>

          {/* pattern */}
          <div>
            <p className="mb-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">Pattern</p>
            <div className="flex gap-2.5 overflow-x-auto px-0.5 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CARD_PATTERNS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    sound.play('tap')
                    setCardBack({ ...cardBack, pattern: p.id })
                  }}
                  aria-label={p.label}
                  className={cn(
                    'shrink-0 rounded-xl ring-2 transition hover:opacity-90',
                    cardBack.pattern === p.id ? 'ring-foreground/80' : 'ring-transparent',
                  )}
                >
                  <CardBack design={{ ...cardBack, pattern: p.id }} size="sm" />
                </button>
              ))}
            </div>
          </div>

          {/* colour */}
          <div>
            <p className="mb-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">Colour</p>
            <div className="flex justify-between">
              {CARD_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    sound.play('tap')
                    setCardBack({ ...cardBack, color: c.value })
                  }}
                  aria-label={c.id}
                  className={cn(
                    'size-8 rounded-full ring-2 ring-offset-2 ring-offset-popover transition',
                    cardBack.color === c.value ? 'ring-foreground/80' : 'ring-transparent',
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
