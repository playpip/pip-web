'use client'

import type { BackupSummary } from '@/lib/backup'
import { useMoney } from '@/lib/useMoney'

/**
 * The "replace your profile?" confirm card. Shared by every restore path — file,
 * pasted code, scanned QR — so the warning and framing are always identical.
 */
export function RestoreConfirm({
  summary,
  onCancel,
  onConfirm,
}: {
  summary: BackupSummary
  onCancel: () => void
  onConfirm: () => void
}) {
  const money = useMoney()
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.04] p-4">
      <p className="text-sm">
        Replace your profile with <span className="font-medium">{summary.name}</span> —{' '}
        {money(summary.roll)} chips, {summary.chipsEarned} award chips?
      </p>
      <p className="text-xs text-muted-foreground">This overwrites everything on this device.</p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl bg-foreground/[0.06] py-2.5 text-sm font-medium transition hover:bg-foreground/[0.12]"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Restore
        </button>
      </div>
    </div>
  )
}
