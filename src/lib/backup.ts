// Profile backup — the insurance policy for an account-free app. Exports the
// persisted profile exactly as stored (versioned), and restores by writing it
// back and reloading so zustand's migrate path runs as usual. Never partially
// applies: a restore either fully validates or nothing changes.
//
// The envelope + validation here are transport-agnostic: a downloaded file
// (this module) and a copy/paste or QR code (lib/transfer) share them, so every
// path is validated identically before it can touch the stored profile.

'use client'

import { PERSIST_VERSION } from '@/store/profile'

export const PROFILE_KEY = 'pip.profile'

export interface BackupEnvelope {
  app: 'pip'
  exportedAt: string
  profile: {
    version: number
    state: Record<string, unknown>
  }
}

/** What a restore would apply — shown in the confirm step. */
export interface BackupSummary {
  name: string
  roll: number
  chipsEarned: number
  exportedAt: string
}

/**
 * The current profile wrapped for transport, or null if there's nothing saved.
 * `exportedAt` is stamped here (browser-only, never in the engine).
 */
export function buildEnvelope(): BackupEnvelope | null {
  const raw = localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  return {
    app: 'pip',
    exportedAt: new Date().toISOString(),
    profile: JSON.parse(raw),
  }
}

/** Download the current profile as pip-profile.json. Returns false if there is nothing to export. */
export function exportProfile(): boolean {
  const envelope = buildEnvelope()
  if (!envelope) return false
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pip-profile.json'
  a.click()
  URL.revokeObjectURL(url)
  return true
}

export type ParsedBackup =
  | { ok: true; envelope: BackupEnvelope; summary: BackupSummary }
  | { ok: false; error: string }

/**
 * Validate an already-parsed value as a Pip backup. Applies nothing. Shared by
 * every restore path (file, pasted code, scanned QR) so validation lives once.
 */
export function validateEnvelope(parsed: unknown): ParsedBackup {
  const env = parsed as Partial<BackupEnvelope>
  if (env?.app !== 'pip' || typeof env.profile !== 'object' || env.profile === null) {
    return { ok: false, error: 'That doesn’t look like a Pip backup.' }
  }
  const { version, state } = env.profile as { version?: unknown; state?: unknown }
  if (typeof version !== 'number' || version > PERSIST_VERSION) {
    return { ok: false, error: 'That backup is from a newer version of Pip — update first.' }
  }
  if (typeof state !== 'object' || state === null) {
    return { ok: false, error: 'That backup is missing its profile data.' }
  }
  const s = state as Record<string, unknown>
  if (s.created !== true || typeof s.name !== 'string' || typeof s.roll !== 'number') {
    return { ok: false, error: 'That backup is incomplete or damaged.' }
  }

  return {
    ok: true,
    envelope: env as BackupEnvelope,
    summary: {
      name: s.name,
      roll: s.roll,
      chipsEarned:
        typeof s.awards === 'object' && s.awards !== null ? Object.keys(s.awards).length : 0,
      exportedAt: typeof env.exportedAt === 'string' ? env.exportedAt : '',
    },
  }
}

/** Parse + validate a backup file. Applies nothing. */
export async function readBackup(file: File): Promise<ParsedBackup> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON.' }
  }
  return validateEnvelope(parsed)
}

/** Overwrite the stored profile with a validated backup and reload the app. */
export function applyBackup(envelope: BackupEnvelope): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(envelope.profile))
  location.reload()
}
