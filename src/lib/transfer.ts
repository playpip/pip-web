// Device-to-device transfer without accounts or files. Two shapes, one envelope
// format (see lib/backup):
//
//   • Code  — the FULL profile, gzip-compressed to a short base64url string you
//             copy on one device and paste on another. Lossless.
//   • QR    — a TRIMMED profile (identity + cosmetics, not the heavy history)
//             encoded into a /game?p=<code> deep link. Scanning it with a phone
//             camera opens Pip and offers the restore. Small enough to scan;
//             detailed stats/history don't come along.
//
// Both decode back through validateEnvelope, so a bad paste/scan is rejected
// exactly like a bad file — nothing touches the profile until it validates.

'use client'

import {
  type BackupEnvelope,
  buildEnvelope,
  type ParsedBackup,
  validateEnvelope,
} from '@/lib/backup'

/** Query param the QR deep link carries the trimmed code in (see app/game). */
export const IMPORT_PARAM = 'p'

// `pip1:` = gzip payload, `pip0:` = raw (fallback where CompressionStream is
// missing). The prefix lets decode pick the right path and rejects junk early.
const GZIP_PREFIX = 'pip1:'
const RAW_PREFIX = 'pip0:'

/** State keys that ride in the trimmed QR payload — who you are and what you've unlocked. */
const TRIMMED_KEYS = [
  'created',
  'name',
  'avatar',
  'roll',
  'peakRoll',
  'cardBack',
  'awards',
  'owned',
  'deckFace',
  'tableFinish',
] as const

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function pipe(bytes: Uint8Array, kind: 'gzip' | 'gunzip'): Promise<Uint8Array> {
  const Ctor = kind === 'gzip' ? CompressionStream : DecompressionStream
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new Ctor('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Envelope → a compact, copy-pasteable code. Gzips when the browser supports it. */
export async function encodeEnvelope(envelope: BackupEnvelope): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(envelope))
  if (typeof CompressionStream === 'undefined') return RAW_PREFIX + toBase64Url(json)
  return GZIP_PREFIX + toBase64Url(await pipe(json, 'gzip'))
}

/** Decode a code back to a validated backup — same guarantees as a restored file. */
export async function decodeCode(code: string): Promise<ParsedBackup> {
  const trimmed = code.trim()
  try {
    let jsonBytes: Uint8Array
    if (trimmed.startsWith(GZIP_PREFIX)) {
      jsonBytes = await pipe(fromBase64Url(trimmed.slice(GZIP_PREFIX.length)), 'gunzip')
    } else if (trimmed.startsWith(RAW_PREFIX)) {
      jsonBytes = fromBase64Url(trimmed.slice(RAW_PREFIX.length))
    } else {
      return { ok: false, error: 'That doesn’t look like a Pip code.' }
    }
    return validateEnvelope(JSON.parse(new TextDecoder().decode(jsonBytes)))
  } catch {
    return { ok: false, error: 'That code is incomplete or damaged.' }
  }
}

/** The full profile as a copy-pasteable code, or null if there's nothing saved. */
export async function profileCode(): Promise<string | null> {
  const envelope = buildEnvelope()
  return envelope ? encodeEnvelope(envelope) : null
}

/** The identity + cosmetics of the profile, wrapped as an envelope for the QR path. */
function trimmedEnvelope(): BackupEnvelope | null {
  const full = buildEnvelope()
  if (!full) return null
  const state: Record<string, unknown> = {}
  for (const key of TRIMMED_KEYS) {
    if (key in full.profile.state) state[key] = full.profile.state[key]
  }
  return { ...full, profile: { version: full.profile.version, state } }
}

/** A /game?p=<code> deep link carrying the trimmed profile, sized for a QR code. */
export async function profileQrUrl(origin: string): Promise<string | null> {
  const envelope = trimmedEnvelope()
  if (!envelope) return null
  const code = await encodeEnvelope(envelope)
  return `${origin}/game?${IMPORT_PARAM}=${code}`
}
