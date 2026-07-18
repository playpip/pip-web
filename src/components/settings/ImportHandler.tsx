'use client'

import { useEffect, useState } from 'react'
import { RestoreConfirm } from '@/components/settings/RestoreConfirm'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { applyBackup, type ParsedBackup } from '@/lib/backup'
import { decodeCode, IMPORT_PARAM } from '@/lib/transfer'
import { sound } from '@/lib/sound'

/**
 * Handles the QR deep link — /game?p=<code>. Decodes the scanned profile and
 * offers the restore, then strips the param so a refresh or reshare can't replay
 * it. Mounted on the lobby, since that's where the QR (start_url) lands.
 */
export function ImportHandler() {
  const [parsed, setParsed] = useState<ParsedBackup | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const url = new URL(location.href)
    const code = url.searchParams.get(IMPORT_PARAM)
    if (!code) return
    url.searchParams.delete(IMPORT_PARAM)
    history.replaceState(null, '', url.pathname + url.search + url.hash)

    let live = true
    decodeCode(code).then((res) => {
      if (!live) return
      setParsed(res)
      setOpen(true)
    })
    return () => {
      live = false
    }
  }, [])

  if (!parsed) return null
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Load this profile?</DialogTitle>
          <DialogDescription>Scanned from another device.</DialogDescription>
        </DialogHeader>
        {parsed.ok ? (
          <RestoreConfirm
            summary={parsed.summary}
            onCancel={() => setOpen(false)}
            onConfirm={() => {
              sound.play('call')
              applyBackup(parsed.envelope)
            }}
          />
        ) : (
          <p className="text-sm text-suit-red">{parsed.error}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
