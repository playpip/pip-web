'use client'

import { useRef, useState } from 'react'
import { QrCode } from '@/components/QrCode'
import { RestoreConfirm } from '@/components/settings/RestoreConfirm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useProfile } from '@/store/profile'
import { applyBackup, exportProfile, type ParsedBackup, readBackup } from '@/lib/backup'
import { decodeCode, profileCode, profileQrUrl } from '@/lib/transfer'
import { sound } from '@/lib/sound'
import { cn } from '@/lib/utils'

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID

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
          {APP_VERSION && (
            <p className="text-center text-[11px] tracking-wide text-muted-foreground/70">
              Pip v{APP_VERSION}
              {BUILD_ID ? ` · ${BUILD_ID}` : ''}
            </p>
          )}
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

const secondaryButton =
  'flex-1 rounded-xl bg-foreground/[0.06] py-2.5 text-sm font-medium transition hover:bg-foreground/[0.12]'

/** Move your progress between devices — no accounts, three ways to carry it. */
function BackupSection() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const [panel, setPanel] = useState<'none' | 'paste' | 'qr'>('none')
  const [copied, setCopied] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')

  const reset = () => {
    setPending(null)
    setPanel('none')
    setCopied(false)
    setPasteText('')
  }

  const copyCode = async () => {
    sound.play('tap')
    const code = await profileCode()
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // Clipboard blocked (rare, non-secure context) — fall back to the QR/file.
    }
  }

  const showQr = async () => {
    sound.play('tap')
    setPanel('qr')
    setQrUrl(await profileQrUrl(location.origin))
  }

  const restorePasted = async () => {
    sound.play('tap')
    setPending(await decodeCode(pasteText))
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setPending(await readBackup(file))
  }

  return (
    <div>
      <p className="mb-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground">
        Move to another device
      </p>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Your progress lives on this device. Copy it as a code or scan the QR from your phone — no
        account needed.
      </p>

      {pending?.ok ? (
        <RestoreConfirm
          summary={pending.summary}
          onCancel={reset}
          onConfirm={() => {
            sound.play('call')
            applyBackup(pending.envelope)
          }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button onClick={copyCode} className={secondaryButton}>
              {copied ? 'Copied ✓' : 'Copy data'}
            </button>
            <button
              onClick={() => {
                sound.play('tap')
                setPanel(panel === 'qr' ? 'none' : 'qr')
                if (panel !== 'qr') void showQr()
              }}
              className={secondaryButton}
            >
              {panel === 'qr' ? 'Hide QR' : 'Show QR'}
            </button>
          </div>

          {panel === 'qr' && (
            <div className="flex flex-col gap-2 pt-1">
              {qrUrl ? <QrCode value={qrUrl} /> : null}
              <p className="text-center text-xs text-muted-foreground">
                Scan with your phone camera to bring over your chips, awards and looks. (Detailed
                stats stay on this device — use the code for everything.)
              </p>
            </div>
          )}

          <div className="mt-1 flex gap-2">
            <button
              onClick={() => {
                sound.play('tap')
                setPanel(panel === 'paste' ? 'none' : 'paste')
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
              File…
            </button>
          </div>

          {panel === 'paste' && (
            <div className="flex flex-col gap-2 pt-1">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your Pip code here"
                rows={3}
                className="w-full resize-none rounded-xl bg-foreground/[0.04] p-3 text-xs outline-none ring-primary/40 focus:ring-2"
              />
              <button
                onClick={restorePasted}
                disabled={!pasteText.trim()}
                className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
              >
                Restore from code
              </button>
            </div>
          )}

          <button
            onClick={() => {
              sound.play('tap')
              exportProfile()
            }}
            className="mt-1 text-center text-[11px] text-muted-foreground/70 underline-offset-2 hover:underline"
          >
            Back up to a file instead
          </button>

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
