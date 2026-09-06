// What sync does next, decided as a pure function.
//
// store/sync owns the session, the network and the timers. Everything it has to
// *decide* lives here, for the reason the merge policy does (lib/sync/merge):
// the store cannot be tested without a browser, and this is where the mistakes
// that cost a player chips are made.
//
// The rule this file exists to enforce: **a device must be able to tell
// "the server has my chips" from "the server has not heard from me yet", after
// a reload.** It could not before (technology#89). `dirty` lived in memory and
// the bookmark recorded only the row's `updated_at`, so a push that died in
// flight, which is what backgrounding a PWA does to it, came back as "in sync":
// the winnings stayed local and either sat there or were overwritten by the
// next pull with no prompt.
//
// The fix is one extra field: a fingerprint of the state the server last
// accepted from this device. Local state that does not match it is unpushed,
// however the app got here.

import { hasDivergence, isPristine, mergeProfiles, type ProfileData } from '@/lib/sync/merge'

export interface Bookmark {
  /** `updated_at` of the row this device last read or wrote. */
  seen: string | null
  /**
   * Fingerprint of the state the server last accepted from this device, or
   * null when that is unknown: a device that has never pushed, or one whose
   * local profile has since been replaced by a pull.
   *
   * Only a successful push writes it. Null means "fall back to the in-memory
   * flag", which is exactly the behaviour that shipped, so an existing player's
   * old `{ seen }` bookmark upgrades without a prompt.
   */
  pushed: string | null
}

/** The account's row, as much of it as the decision needs. */
export interface RemoteRow {
  profile: ProfileData
  updatedAt: string
  deviceId: string | null
  version: number
}

export interface PlanInput {
  local: ProfileData
  /** Null when the account has no row yet. */
  row: RemoteRow | null
  bookmark: Bookmark
  /** This browser's id, so "the row moved" can exclude our own last write. */
  deviceId: string
  /** The profile changed in this session and no push has taken it yet. */
  changedHere: boolean
  persistVersion: number
}

export type SyncPlan =
  /** The row was written by a newer client. Refuse rather than downgrade it. */
  | { action: 'too-new' }
  /** No row yet: this device is the first one in. */
  | { action: 'upload' }
  /** In step with the row and nothing waiting to go up. */
  | { action: 'idle'; bookmark: Bookmark }
  /** In step with the row, but the server has not taken what is here. */
  | { action: 'push'; bookmark: Bookmark }
  /** This device has nothing of its own: take the account's copy outright. */
  | { action: 'restore'; profile: ProfileData; bookmark: Bookmark }
  /** The row moved elsewhere and nothing local is waiting: take theirs. */
  | { action: 'adopt'; profile: ProfileData; bookmark: Bookmark }
  /** Both moved but agree about the Roll: merge in the player's favour, push. */
  | { action: 'merge'; profile: ProfileData; bookmark: Bookmark }
  /** Both moved and they disagree about something the player would miss. */
  | { action: 'conflict'; remote: ProfileData; seen: string }

/**
 * Does this device hold anything the server has not accepted?
 *
 * `changedHere` alone cannot answer it after a reload, which is the whole bug.
 * The fingerprint can, and it self-heals: whatever went wrong, a local profile
 * that does not match the last accepted state is pushed at the next
 * opportunity.
 */
export function isUnpushed(local: ProfileData, bookmark: Bookmark): boolean {
  if (bookmark.pushed === null) return false
  return fingerprint(local) !== bookmark.pushed
}

export function planSync(input: PlanInput): SyncPlan {
  const { local, row, bookmark, deviceId, changedHere, persistVersion } = input

  if (!row) return { action: 'upload' }
  if (row.version > persistVersion) return { action: 'too-new' }

  const remote = row.profile
  // A pull replaces the local profile with something the server never took from
  // us, so the fingerprint stops meaning anything. Recording "unknown" keeps
  // the old behaviour on the next sync rather than inventing a push.
  const pulled: Bookmark = { seen: row.updatedAt, pushed: null }
  const kept: Bookmark = { seen: row.updatedAt, pushed: bookmark.pushed }

  // This device has nothing of its own and the account has real progress:
  // restore the row outright, whatever the bookmark says. Checked first on
  // purpose, because the two cases that reach here both have a bookmark that
  // looks current:
  //
  //   - Signing in on a fresh device. Merging would fold onboarding's
  //     placeholder origin point into the account's real history and hang a
  //     cliff back down to the starting Roll off the end of the graph.
  //   - Storage half-cleared: drop `pip.profile` and keep `pip.sync`, and the
  //     bookmark still matches the row while the profile is empty. The pull
  //     would be skipped, and the first change after onboarding would push the
  //     empty profile over the account. That one costs real progress.
  //
  // `changedHere` is what separates this from a reset, which produces an
  // identical profile deliberately and is waiting to go up. The fingerprint
  // deliberately does not get a vote: a cleared profile does not match it
  // either, and treating that as work would push the empty profile up.
  if (!changedHere && isPristine(local) && !isPristine(remote)) {
    return { action: 'restore', profile: remote, bookmark: pulled }
  }

  const pending = changedHere || isUnpushed(local, bookmark)
  const movedWithoutUs = row.updatedAt !== bookmark.seen && row.deviceId !== deviceId

  if (!movedWithoutUs) {
    return pending ? { action: 'push', bookmark: kept } : { action: 'idle', bookmark: kept }
  }

  // The remote moved and this device hasn't seen it. If nothing local is
  // waiting to go up, there is nothing to lose: take the account's version.
  if (!pending) {
    return { action: 'adopt', profile: mergeProfiles(local, remote, 'remote'), bookmark: pulled }
  }

  // Both sides moved. Only ask if they actually disagree about something the
  // player would notice losing.
  if (hasDivergence(local, remote)) {
    return { action: 'conflict', remote, seen: row.updatedAt }
  }

  return { action: 'merge', profile: mergeProfiles(local, remote, 'local'), bookmark: pulled }
}

/**
 * A short, stable fingerprint of a profile.
 *
 * Short because it goes in localStorage next to the bookmark and the profile
 * itself is already the biggest thing in there; stable because it has to
 * survive a reload, so it cannot depend on key order (a rehydrated store builds
 * its object in the initial state's order, not the stored one).
 *
 * A collision means one push skipped, not corrupted data, and the next change
 * pushes anyway. 53 bits is far past what that risk is worth.
 */
export function fingerprint(data: ProfileData): string {
  return hash53(canonical(data)).toString(36)
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
}

/** cyrb53 (bryc, public domain): two 32-bit lanes combined into 53 bits. */
function hash53(str: string): number {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
