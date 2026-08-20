'use client'

// Moving a profile between devices without an account: a code, a QR or a file,
// in either direction. Its own dialog over Settings, for the same reason the
// account forms got one — these are real tasks, and inline they turned Settings
// into a wall of buttons.
//
// The QR used to be a dialog of its own nested inside Settings. It's a view in
// here now instead: this dialog has the room, and stacking a third surface over
// two others is worse than swapping the body of the one you're already in.

import { useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { QrCode } from '@/components/QrCode'
import { RestoreConfirm } from '@/components/settings/RestoreConfirm'
import { applyBackup, exportProfile, type ParsedBackup, readBackup } from '@/lib/backup'
import { decodeCode, profileCode, profileQrUrl } from '@/lib/transfer'
import { sound } from '@/lib/sound'
import { useCopied } from '@/lib/useCopied'

type View = 'menu' | 'qr' | 'paste'

// Touch-first sizing, same reasoning as AccountDialog: buttons clear 44px and
// a quiet link still gets a real tap target.
const secondaryButton =
  'min-h-11 flex-1 rounded-xl bg-foreground/[0.06] py-3 text-sm font-medium transition hover:bg-foreground/[0.12]'
const textLink =
  'flex min-h-11 w-full items-center justify-center text-xs text-muted-foreground/70 underline-offset-2 transition hover:text-foreground hover:underline'

export function TransferDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<View>('menu')
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const [copied, copy] = useCopied()
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')

  // No `copied` reset here any more: it clears itself after a couple of
  // seconds, so coming back to the menu inside that window and still seeing
  // the tick is accurate rather than stale.
  const backToMenu = () => {
    sound.play('tap')
    setView('menu')
    setPending(null)
    setPasteText('')
  }

  const copyCode = async () => {
    sound.play('tap')
    const code = await profileCode()
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      copy()
    } catch {
      // Clipboard blocked (rare, non-secure context) — the QR and file still work.
    }
  }

  const showQr = async () => {
    sound.play('tap')
    setView('qr')
    setQrUrl(await profileQrUrl(location.origin))
  }

  const restoring = pending?.ok === true
  const title = restoring
    ? 'Bring this profile in?'
    : view === 'qr'
      ? 'Scan to move over'
      : view === 'paste'
        ? 'Paste a code'
        : 'Move it by hand'
  const description = restoring
    ? 'Check it looks right before it replaces what’s on this device.'
    : view === 'qr'
      ? 'Point your phone camera here to bring over your chips, awards and looks.'
      : view === 'paste'
        ? 'Paste the code you copied on your other device.'
        : 'Carry your progress across yourself. No account needed for any of these.'

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) backToMenu()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-1">
          {restoring && pending?.ok && (
            <RestoreConfirm
              summary={pending.summary}
              onCancel={backToMenu}
              onConfirm={() => {
                sound.play('call')
                applyBackup(pending.envelope)
              }}
            />
          )}

          {!restoring && view === 'menu' && (
            <>
              {/* Split by direction. Mixed together, "open a file" and "save a
                  file" are near-identical names doing opposite jobs. */}
              <p className="text-xs text-muted-foreground/70">Take it with you</p>
              <div className="flex gap-2">
                <button onClick={copyCode} className={secondaryButton}>
                  {copied ? 'Copied ✓' : 'Copy code'}
                </button>
                <button onClick={showQr} className={secondaryButton}>
                  Show QR
                </button>
                <button
                  onClick={() => {
                    sound.play('tap')
                    exportProfile()
                  }}
                  className={secondaryButton}
                >
                  Save file
                </button>
              </div>

              <p className="mt-2 text-xs text-muted-foreground/70">Bring one in</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    sound.play('tap')
                    setView('paste')
                  }}
                  className={secondaryButton}
                >
                  Paste a code
                </button>
                <button
                  onClick={() => {
                    sound.play('tap')
                    fileInput.current?.click()
                  }}
                  className={secondaryButton}
                >
                  Open a file
                </button>
              </div>
            </>
          )}

          {!restoring && view === 'qr' && (
            <>
              {qrUrl ? <QrCode value={qrUrl} /> : null}
              <p className="text-center text-xs text-muted-foreground">
                Detailed stats stay on this device. Use the code for everything.
              </p>
            </>
          )}

          {!restoring && view === 'paste' && (
            <>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your Pip code here"
                rows={4}
                aria-label="Pip transfer code"
                className="w-full resize-none rounded-xl bg-foreground/[0.04] p-3 text-base outline-none ring-primary/40 focus:ring-2"
              />
              <button
                onClick={async () => {
                  sound.play('tap')
                  setPending(await decodeCode(pasteText))
                }}
                disabled={!pasteText.trim()}
                className="min-h-11 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
              >
                Restore from code
              </button>
            </>
          )}

          {pending && !pending.ok && (
            <p className="text-xs leading-relaxed text-suit-red">{pending.error}</p>
          )}

          {!restoring && view !== 'menu' && (
            <button onClick={backToMenu} className={textLink}>
              Back
            </button>
          )}

          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) setPending(await readBackup(file))
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
