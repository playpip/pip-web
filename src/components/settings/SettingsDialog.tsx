'use client'

import { useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useProfile } from '@/store/profile'
import { exportProfile, readBackup, applyBackup, type ParsedBackup } from '@/lib/backup'
import { useMoney } from '@/lib/useMoney'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/** App settings — the quiet stuff. Looks live in the Style dialog. */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Table talk and backups.</DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-6 pt-1">
          <TableTalkSection />
          <BackupSection />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** The cast's rare one-liners at the table — on by default, easy to silence. */
function TableTalkSection() {
  const tableTalk = useProfile((s) => s.tableTalk)
  const setTableTalk = useProfile((s) => s.setTableTalk)
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Table talk</p>
        <p className="text-xs text-muted-foreground">
          The occasional quiet line from the regulars.
        </p>
      </div>
      <button
        role="switch"
        aria-checked={tableTalk}
        aria-label="Table talk"
        onClick={() => {
          sound.play('tap')
          setTableTalk(!tableTalk)
        }}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition',
          tableTalk ? 'bg-primary' : 'bg-foreground/15',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-background shadow transition-all',
            tableTalk ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
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
