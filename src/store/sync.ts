// Cross-device sync — the orchestration half. The merge rules are pure and live
// in lib/sync/merge; this is the part that knows about sessions, the network and
// when to talk to either.
//
// Three rules this file exists to keep:
//
//   1. **Opt-in is absolute.** Nothing here runs until the player signs in. No
//      client, no request, no identity on an ordinary visit.
//   2. **Sync never blocks play.** Every push is fire-and-forget. A failed one
//      leaves the profile marked dirty and tries again later (on reconnect, on
//      the next change, on the next app open). A dropped connection must never
//      cost a hand.
//   3. **Never silently destroy progress.** Additive fields always merge in the
//      player's favour. When the two devices actually disagree about the Roll,
//      the player is asked. See lib/sync/merge for why.

'use client'

import { create } from 'zustand'
import { deviceId, getSupabase, syncConfigured, type ProfileRow } from '@/lib/sync/client'
import {
  hasDivergence,
  isPristine,
  mergeProfiles,
  summarise,
  type ProfileData,
  type SideSummary,
} from '@/lib/sync/merge'
import { friendly } from '@/lib/sync/errors'
import { migrateProfile, PERSIST_VERSION, useProfile } from '@/store/profile'
import { track } from '@/lib/analytics'
import type { Json } from '@/types/supabase-types'

/** Where this device got to last time, so divergence is detectable. */
const BOOKMARK_KEY = 'pip.sync'

interface Bookmark {
  /** `updated_at` of the row this device last read or wrote. */
  seen: string | null
}

function readBookmark(): Bookmark {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY)
    return raw ? (JSON.parse(raw) as Bookmark) : { seen: null }
  } catch {
    return { seen: null }
  }
}

function writeBookmark(seen: string | null) {
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify({ seen }))
  } catch {
    // Storage blocked. Sync still works; divergence just prompts more often,
    // which errs towards asking rather than towards overwriting.
  }
}

/** The profile's data fields, without the actions. What actually syncs. */
function localData(): ProfileData {
  const { ...all } = useProfile.getState()
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(all)) {
    if (typeof v !== 'function') out[k] = v
  }
  return out as ProfileData
}

export interface Conflict {
  local: SideSummary
  remote: SideSummary
  /** Held so resolving doesn't need a second round-trip. */
  remoteData: ProfileData
  remoteUpdatedAt: string
}

export type SyncStatus = 'off' | 'signed-out' | 'signed-in'

interface SyncState {
  status: SyncStatus
  email: string | null
  /** A request is in flight (sign-in, push, pull). Drives button spinners. */
  busy: boolean
  /** Local changes not yet accepted by the server. */
  dirty: boolean
  lastSyncedAt: number | null
  error: string | null
  conflict: Conflict | null

  init: () => Promise<void>
  signUp: (email: string, password: string) => Promise<boolean>
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  sendReset: (email: string) => Promise<boolean>
  updatePassword: (password: string) => Promise<boolean>
  syncNow: () => Promise<void>
  resetEverywhere: () => Promise<void>
  resolveConflict: (side: 'local' | 'remote') => Promise<void>
  deleteAccount: () => Promise<boolean>
  clearError: () => void
}

let started = false
let pushTimer: ReturnType<typeof setTimeout> | null = null

export const useSync = create<SyncState>()((set, get) => ({
  status: syncConfigured() ? 'signed-out' : 'off',
  email: null,
  busy: false,
  dirty: false,
  lastSyncedAt: null,
  error: null,
  conflict: null,

  clearError: () => set({ error: null }),

  /**
   * Called once on app open. Restores a session if there is one and pulls.
   * Safe to call when sync isn't configured — it does nothing.
   */
  init: async () => {
    if (started) return
    started = true
    const sb = await getSupabase()
    if (!sb) return

    const { data } = await sb.auth.getSession()
    if (data.session?.user.email) {
      set({ status: 'signed-in', email: data.session.user.email })
      await get().syncNow()
    }

    sb.auth.onAuthStateChange((_event, session) => {
      const email = session?.user.email ?? null
      set({ status: email ? 'signed-in' : 'signed-out', email })
    })

    // Anything that changes the profile marks it dirty and schedules a push.
    // Debounced rather than wired into each call site, so a tournament that
    // touches six fields is one write, and nothing in the game loop has to know
    // sync exists.
    useProfile.subscribe(() => {
      if (get().status !== 'signed-in') return
      set({ dirty: true })
      if (pushTimer) clearTimeout(pushTimer)
      pushTimer = setTimeout(() => void push(set, get), 4_000)
    })

    // Retry on reconnect, and flush before the tab goes away.
    window.addEventListener('online', () => {
      if (get().dirty) void push(set, get)
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && get().dirty) void push(set, get)
    })
  },

  signUp: async (email, password) => {
    const sb = await getSupabase()
    if (!sb) return false
    set({ busy: true, error: null })
    const { error } = await sb.auth.signUp({ email, password })
    if (error) {
      set({ busy: false, error: friendly(error.message) })
      return false
    }
    track('sync-signed-up')
    set({ busy: false, status: 'signed-in', email })
    // A fresh account has no row, so this is a straight upload of what's here.
    await get().syncNow()
    return true
  },

  signIn: async (email, password) => {
    const sb = await getSupabase()
    if (!sb) return false
    set({ busy: true, error: null })
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) {
      set({ busy: false, error: friendly(error.message) })
      return false
    }
    set({ busy: false, status: 'signed-in', email })
    await get().syncNow()
    return true
  },

  /**
   * Signing out leaves the profile on the device exactly as it is. It is a
   * local app that happens to have an account, not an account you log into.
   */
  signOut: async () => {
    const sb = await getSupabase()
    if (!sb) return
    set({ busy: true })
    await sb.auth.signOut()
    writeBookmark(null)
    set({ busy: false, status: 'signed-out', email: null, dirty: false, lastSyncedAt: null })
  },

  sendReset: async (email) => {
    const sb = await getSupabase()
    if (!sb) return false
    set({ busy: true, error: null })
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password`,
    })
    set({ busy: false, error: error ? friendly(error.message) : null })
    return !error
  },

  updatePassword: async (password) => {
    const sb = await getSupabase()
    if (!sb) return false
    set({ busy: true, error: null })
    const { error } = await sb.auth.updateUser({ password })
    set({ busy: false, error: error ? friendly(error.message) : null })
    return !error
  },

  syncNow: async () => {
    const sb = await getSupabase()
    if (!sb || get().status !== 'signed-in') return
    set({ busy: true, error: null })

    const { data: sessionData } = await sb.auth.getSession()
    const userId = sessionData.session?.user.id
    if (!userId) {
      set({ busy: false })
      return
    }

    const { data, error } = await sb
      .from('profiles')
      .select('user_id, version, state, updated_at, device_id')
      .eq('user_id', userId)
      .maybeSingle<ProfileRow>()

    if (error) {
      set({ busy: false, error: 'Could not reach sync. Your progress is safe on this device.' })
      return
    }

    // No row yet: this device is the first one in. Straight upload.
    if (!data) {
      set({ busy: false, dirty: true })
      await push(set, get)
      return
    }

    // A row from a client newer than this one. Refusing is the same rule the
    // backup restore path already follows, for the same reason.
    if (data.version > PERSIST_VERSION) {
      set({
        busy: false,
        error: 'Your account has progress from a newer version of Pip. Update, then sync.',
      })
      return
    }

    const remote = migrateProfile(structuredClone(data.state), data.version) as ProfileData
    const local = localData()
    const bookmark = readBookmark()

    // This device has nothing of its own and the account has real progress:
    // restore the row outright, whatever the bookmark says. Checked before
    // `movedWithoutUs` on purpose, because the two cases that reach here both
    // have a bookmark that looks current:
    //
    //   - Signing in on a fresh device. Merging would fold onboarding's
    //     placeholder origin point into the account's real history and hang a
    //     cliff back down to the starting Roll off the end of the graph.
    //   - Storage half-cleared: drop `pip.profile` and keep `pip.sync`, and the
    //     bookmark still matches the row while the profile is empty. The pull
    //     would be skipped, and the first change after onboarding would push
    //     the empty profile over the account. That one costs real progress.
    //
    // `dirty` is what separates this from a reset, which produces an identical
    // profile deliberately and is waiting to go up. See merge#isPristine.
    if (!get().dirty && isPristine(local) && !isPristine(remote)) {
      applyMerged(remote)
      writeBookmark(data.updated_at)
      set({ busy: false, dirty: false, lastSyncedAt: Date.now() })
      return
    }

    const movedWithoutUs = data.updated_at !== bookmark.seen && data.device_id !== deviceId()

    if (!movedWithoutUs) {
      writeBookmark(data.updated_at)
      set({ busy: false, lastSyncedAt: Date.now() })
      if (get().dirty) await push(set, get)
      return
    }

    // The remote moved and this device hasn't seen it. If nothing local is
    // waiting to go up, there is nothing to lose: take the account's version.
    if (!get().dirty) {
      applyMerged(mergeProfiles(local, remote, 'remote'))
      writeBookmark(data.updated_at)
      set({ busy: false, dirty: false, lastSyncedAt: Date.now() })
      return
    }

    // Both sides moved. Only ask if they actually disagree about something the
    // player would notice losing.
    if (hasDivergence(local, remote)) {
      track('sync-conflict')
      set({
        busy: false,
        conflict: {
          local: summarise(local),
          remote: summarise(remote),
          remoteData: remote,
          remoteUpdatedAt: data.updated_at,
        },
      })
      return
    }

    applyMerged(mergeProfiles(local, remote, 'local'))
    writeBookmark(data.updated_at)
    set({ busy: false })
    await push(set, get)
  },

  /**
   * Reset the profile on this device *and* in the account. Resetting means
   * starting again, not starting again until the next sync puts it all back.
   *
   * The push is immediate rather than left to the 4-second debounce, because
   * the wipe and the empty profile it produces are indistinguishable from a
   * device whose storage was cleared — and `syncNow` restores that one from the
   * account (see above). Getting the write in now keeps the window where a
   * reload would undo the reset as small as it can be. Offline, the profile
   * stays dirty and the reset goes up on reconnect like any other change.
   *
   * A no-op on the account when signed out: `push` returns early, and the
   * device is reset either way.
   */
  resetEverywhere: async () => {
    useProfile.getState().reset()
    if (get().status !== 'signed-in') return
    set({ dirty: true })
    await push(set, get)
  },

  resolveConflict: async (side) => {
    const conflict = get().conflict
    if (!conflict) return
    applyMerged(mergeProfiles(localData(), conflict.remoteData, side))
    writeBookmark(conflict.remoteUpdatedAt)
    set({ conflict: null, dirty: true })
    await push(set, get)
  },

  /**
   * Delete the account and the synced copy with it, which is what Settings and
   * the privacy page have always said this does.
   *
   * It used to delete only the `profiles` row and sign out, leaving the
   * `auth.users` row and its email address behind. You could sign straight back
   * in. Now it calls `delete_own_account()` and the `on delete cascade` on
   * `profiles.user_id` takes the data, so there is no half-deleted state.
   *
   * The device keeps its own profile, deliberately. That is the documented
   * behaviour: deleting the account is not meant to cost you your progress.
   */
  deleteAccount: async () => {
    const sb = await getSupabase()
    if (!sb) return false
    set({ busy: true, error: null })
    const { data: sessionData } = await sb.auth.getSession()
    if (!sessionData.session?.user.id) {
      set({ busy: false })
      return false
    }

    // The user row, not the profile row. `delete_own_account()` takes no
    // arguments and deletes `auth.uid()`, and the cascade takes the profile
    // with it. Deleting the profile here as well would only leave a window
    // where the data is gone and the account isn't.
    const { error } = await sb.rpc('delete_own_account')
    if (error) {
      set({ busy: false, error: 'Could not delete right now. Try again in a moment.' })
      return false
    }

    // Local scope on purpose: the user no longer exists, so a server-side
    // revoke has nothing to revoke and would fail. This clears the stored
    // session, which is the part that matters.
    await sb.auth.signOut({ scope: 'local' })
    writeBookmark(null)
    set({ busy: false, status: 'signed-out', email: null, dirty: false, lastSyncedAt: null })
    return true
  },
}))

/**
 * Write the local profile up. Never throws and never blocks: a failure leaves
 * `dirty` set so the next trigger retries.
 */
async function push(
  set: (partial: Partial<SyncState>) => void,
  get: () => SyncState,
): Promise<void> {
  const sb = await getSupabase()
  if (!sb || get().status !== 'signed-in' || get().conflict) return

  const { data: sessionData } = await sb.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) return

  const { data, error } = await sb
    .from('profiles')
    .upsert(
      {
        user_id: userId,
        version: PERSIST_VERSION,
        // `state` is a jsonb column. ProfileData is structurally JSON, but
        // TypeScript can't prove that, hence the cast.
        state: localData() as unknown as Json,
        updated_at: new Date().toISOString(),
        device_id: deviceId(),
      },
      { onConflict: 'user_id' },
    )
    .select('updated_at')
    .single<{ updated_at: string }>()

  if (error || !data) {
    // Offline or refused. Stay dirty and try again on reconnect.
    set({ dirty: true })
    return
  }
  writeBookmark(data.updated_at)
  set({ dirty: false, lastSyncedAt: Date.now(), error: null })
}

/** Fold a merged profile back into the live store (persist writes it through). */
function applyMerged(merged: ProfileData) {
  useProfile.setState(merged as Partial<ReturnType<typeof useProfile.getState>>)
}
