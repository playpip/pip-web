'use client'

import { useRef, useState } from 'react'
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
import { exportProfile, readBackup, applyBackup, type ParsedBackup } from '@/lib/backup'
import { useMoney } from '@/lib/useMoney'
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

          <BackupSection />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Export / restore the local profile — the insurance for an account-free app. */
function BackupSection() {
  const money = useMoney()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<ParsedBackup | null>(null)

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setPending(await readBackup(file))
  }

  return (
    <div>
      <p className="mb-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">Backup</p>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Your progress lives on this device. Back it up to a file to keep it safe or move it
        somewhere else.
      </p>

      {pending?.ok ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.04] p-4">
          <p className="text-sm">
            Replace your profile with <span className="font-medium">{pending.summary.name}</span> —{' '}
            {money(pending.summary.roll)} chips, {pending.summary.chipsEarned} award chips?
          </p>
          <p className="text-xs text-muted-foreground">This overwrites everything on this device.</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPending(null)}
              className="flex-1 rounded-xl bg-foreground/[0.06] py-2.5 text-sm font-medium transition hover:bg-foreground/[0.12]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                sound.play('call')
                applyBackup(pending.envelope)
              }}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Restore
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => {
                sound.play('tap')
                exportProfile()
              }}
              className="flex-1 rounded-xl bg-foreground/[0.06] py-2.5 text-sm font-medium transition hover:bg-foreground/[0.12]"
            >
              Back up profile
            </button>
            <button
              onClick={() => {
                sound.play('tap')
                fileInput.current?.click()
              }}
              className="flex-1 rounded-xl bg-foreground/[0.06] py-2.5 text-sm font-medium transition hover:bg-foreground/[0.12]"
            >
              Restore…
            </button>
          </div>
          {pending && !pending.ok && (
            <p className="text-xs text-suit-red">{pending.error}</p>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void pickFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      )}
    </div>
  )
}
