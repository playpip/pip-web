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
//      cost a hand. A push that dies with the tab is not a failure the app ever
//      sees, so what to retry is worked out from a fingerprint of the last
//      state the server accepted rather than from a flag in memory, and the
//      decision itself is pure and tested in lib/sync/plan.
//   3. **Never silently destroy progress.** Additive fields always merge in the
//      player's favour. When the two devices actually disagree about the Roll,
//      the player is asked. See lib/sync/merge for why.

'use client'

import { create } from 'zustand'
import { deviceId, getSupabase, syncConfigured, type ProfileRow } from '@/lib/sync/client'
import { mergeProfiles, summarise, type ProfileData, type SideSummary } from '@/lib/sync/merge'
import { fingerprint, isUnpushed, planSync, type Bookmark } from '@/lib/sync/plan'
import { friendly, neverReachedServer } from '@/lib/sync/errors'
import { migrateProfile, PERSIST_VERSION, useProfile } from '@/store/profile'
import { dropUnbackedTable } from '@/store/game'
import { track, trackOnce } from '@/lib/analytics'
import type { Json } from '@/types/supabase-types'

/** Where this device got to last time, so divergence is detectable. */
const BOOKMARK_KEY = 'pip.sync'

const NO_BOOKMARK: Bookmark = { seen: null, pushed: null }

/**
 * How long a tab coming back to the foreground waits before pulling again, so
 * flicking between apps is not a request each time.
 */
const RESUME_MIN_GAP_MS = 30_000

function readBookmark(): Bookmark {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY)
    if (!raw) return NO_BOOKMARK
    // A bookmark written before fingerprints has no `pushed`. Null is the
    // honest answer there, and the next push fills it in.
    const stored = JSON.parse(raw) as Partial<Bookmark>
    return { seen: stored.seen ?? null, pushed: stored.pushed ?? null }
  } catch {
    return NO_BOOKMARK
  }
}

function writeBookmark(bookmark: Bookmark) {
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark))
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
  /**
   * The stored session has been looked for, one way or the other. `status`
   * starts at 'signed-out' because that is the honest default before anything
   * is known, which is fine inside a dialog the player opened but not for a
   * permanent offer on the lobby: without this a returning player watches
   * "create a free account" flash over their own signed-in screen every load.
   * Anything that *offers* an account waits for this; anything the player
   * opened themselves does not have to.
   */
  ready: boolean
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
  ready: false,
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
    if (!sb) {
      // No project configured: `status` is 'off' and stays there, so the
      // question is settled.
      set({ ready: true })
      return
    }

    const { data } = await sb.auth.getSession()
    if (data.session?.user.email) {
      set({ ready: true, status: 'signed-in', email: data.session.user.email })
      await get().syncNow()
    } else {
      set({ ready: true })
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
      if (unpushed(get)) void push(set, get)
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (unpushed(get)) void push(set, get)
        return
      }
      // Back in the foreground: the row may have moved on another device while
      // this one slept. Without this, a warm PWA or a tab left open since
      // before you played elsewhere pulls only at app open, and its next
      // change writes over the fresher row.
      const { busy, conflict, lastSyncedAt } = get()
      if (busy || conflict) return
      if (lastSyncedAt !== null && Date.now() - lastSyncedAt < RESUME_MIN_GAP_MS) return
      void get().syncNow()
    })
  },

  signUp: async (email, password) => {
    const sb = await getSupabase()
    if (!sb) return false
    set({ busy: true, error: null })
    const { error } = await sb.auth.signUp({ email, password })
    if (error) {
      if (neverReachedServer(error)) trackOnce('sync-auth-unreachable')
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
      // Once per tab: someone on a network that cannot reach Supabase will
      // retry, and ten events from one blocked person would read as ten people.
      // The question is what share of players cannot get through, so count them.
      if (neverReachedServer(error)) trackOnce('sync-auth-unreachable')
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
    writeBookmark(NO_BOOKMARK)
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

    const local = localData()
    const plan = planSync({
      local,
      row: data
        ? {
            profile: migrateProfile(structuredClone(data.state), data.version) as ProfileData,
            updatedAt: data.updated_at,
            deviceId: data.device_id,
            version: data.version,
          }
        : null,
      bookmark: readBookmark(),
      deviceId: deviceId(),
      changedHere: get().dirty,
      persistVersion: PERSIST_VERSION,
    })

    switch (plan.action) {
      // A row from a client newer than this one. Refusing is the same rule the
      // backup restore path already follows, for the same reason.
      case 'too-new':
        set({
          busy: false,
          error: 'Your account has progress from a newer version of Pip. Update, then sync.',
        })
        return

      case 'upload':
        set({ busy: false, dirty: true })
        await push(set, get)
        return

      case 'idle':
        writeBookmark(plan.bookmark)
        set({ busy: false, lastSyncedAt: Date.now() })
        return

      // Nothing arrived, but the server never took what is here: the case a
      // killed push used to leave looking synced.
      case 'push':
        writeBookmark(plan.bookmark)
        set({ busy: false, dirty: true, lastSyncedAt: Date.now() })
        await push(set, get)
        return

      case 'restore':
      case 'adopt':
        applyMerged(plan.profile)
        writeBookmark(plan.bookmark)
        set({ busy: false, dirty: false, lastSyncedAt: Date.now() })
        return

      case 'merge':
        applyMerged(plan.profile)
        writeBookmark(plan.bookmark)
        set({ busy: false, dirty: true })
        await push(set, get)
        return

      case 'conflict':
        track('sync-conflict')
        set({
          busy: false,
          conflict: {
            local: summarise(local),
            remote: summarise(plan.remote),
            remoteData: plan.remote,
            remoteUpdatedAt: plan.seen,
          },
        })
        return
    }
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
    writeBookmark({ seen: conflict.remoteUpdatedAt, pushed: null })
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
    writeBookmark(NO_BOOKMARK)
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

  // Fingerprint what is being sent, before sending it. A hand can finish while
  // the request is in flight, and marking that clean on the response is how a
  // change gets left behind.
  const state = localData()
  const sent = fingerprint(state)

  const { data, error } = await sb
    .from('profiles')
    .upsert(
      {
        user_id: userId,
        version: PERSIST_VERSION,
        // `state` is a jsonb column. ProfileData is structurally JSON, but
        // TypeScript can't prove that, hence the cast.
        state: state as unknown as Json,
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
  writeBookmark({ seen: data.updated_at, pushed: sent })
  set({ dirty: fingerprint(localData()) !== sent, lastSyncedAt: Date.now(), error: null })
}

/** Is there local progress the server has not accepted? Survives a reload. */
function unpushed(get: () => SyncState): boolean {
  return get().dirty || isUnpushed(localData(), readBookmark())
}

/** Fold a merged profile back into the live store (persist writes it through). */
function applyMerged(merged: ProfileData) {
  useProfile.setState(merged as Partial<ReturnType<typeof useProfile.getState>>)
  // The table is not synced and is not going to be, but whether it is still
  // backed by chips is (technology#90). A profile naming another device means
  // the player sat down over there, which took this buy-in home to the Roll,
  // so the table here has no money behind it any more.
  dropUnbackedTable(merged.escrow)
}
