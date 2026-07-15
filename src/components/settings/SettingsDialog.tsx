'use client'

import { useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { motion } from 'framer-motion'
import { CardBack } from '@/components/CardBack'
import { useProfile } from '@/store/profile'
import { CARD_BACKS, cardBackById } from '@/config/cardBacks'
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
  const { cardBack: selectedId, setCardBack } = useProfile()
  const selected = cardBackById(selectedId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Pick your card back.</DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-6 pt-1">
          {/* live fanned preview of the chosen design */}
          <div className="flex flex-col items-center gap-2.5 py-2">
            <div className="flex justify-center">
              <motion.div
                key={`${selected.id}-a`}
                initial={{ rotate: 0, x: 12 }}
                animate={{ rotate: -8, x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              >
                <CardBack design={selected} size="md" />
              </motion.div>
              <motion.div
                key={`${selected.id}-b`}
                className="-ml-6"
                initial={{ rotate: 0, x: -12 }}
                animate={{ rotate: 8, x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              >
                <CardBack design={selected} size="md" />
              </motion.div>
            </div>
            <p className="text-xs text-muted-foreground">{selected.name}</p>
          </div>

          {/* the curated set */}
          <div className="grid grid-cols-6 justify-items-center gap-y-2.5">
            {CARD_BACKS.map((design) => (
              <motion.button
                key={design.id}
                onClick={() => {
                  sound.play('tap')
                  setCardBack(design.id)
                }}
                aria-label={design.name}
                whileTap={{ scale: 0.92 }}
                className={cn(
                  'rounded-lg p-0.5 ring-2 transition',
                  selectedId === design.id
                    ? 'ring-foreground/70'
                    : 'ring-transparent hover:ring-foreground/25',
                )}
              >
                <CardBack design={design} size="xs" />
              </motion.button>
            ))}
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
          <p className="text-xs text-muted-foreground">
            This overwrites everything on this device.
          </p>
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
          {pending && !pending.ok && <p className="text-xs text-suit-red">{pending.error}</p>}
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
