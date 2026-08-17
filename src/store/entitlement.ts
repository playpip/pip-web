// Membership — the client seam, and deliberately the only one.
//
// One store, one hook, one boolean. Every paid surface in the app asks
// `useEntitlement()` and nothing else, so when the Apple IAP question is
// answered, or checkout moves, or a second payment path appears, the answer
// lands in one file rather than in nine components.
//
// Three properties worth keeping, in the order they are easy to break:
//
//   1. **Nothing happens without an account.** Signed out is not a member, and
//      finding that out costs no request: the store reacts to the sync store's
//      session rather than going looking for one. An ordinary visit still
//      creates no identity.
//   2. **The client never writes this table.** RLS grants select and nothing
//      else, the webhook writes it with the service role, and
//      tests/entitlement.test.ts fails the build if a mutation ever appears
//      here. Entitlement in a table the client can write is not entitlement.
//   3. **A dropped connection does not cost a member what they paid for.** The
//      row is cached per user and honoured until the period it paid for runs
//      out. See the note in lib/membership/entitlement.ts about why a forgeable
//      cache is the right trade in an open-source app.

'use client'

import { create } from 'zustand'
import { getSupabase } from '@/lib/sync/client'
import {
  type Entitlement,
  type MembershipRow,
  NOT_A_MEMBER,
  parseCache,
  readEntitlement,
} from '@/lib/membership/entitlement'
import { useSync } from '@/store/sync'

/** Where the last known row is kept, so a member offline is still a member. */
const CACHE_KEY = 'pip.membership'

/** The columns the client is allowed to read. Kept in one place so the row shape and this agree. */
const COLUMNS = 'user_id, status, current_period_end, cancel_at_period_end'

function readCache(userId: string): MembershipRow | null {
  try {
    return parseCache(localStorage.getItem(CACHE_KEY), userId)
  } catch {
    // Storage blocked (Safari private mode). No cache, so a member offline in
    // a private window is not a member. Signing in fixes it, and that is the
    // right way round: this is a convenience, not the entitlement.
    return null
  }
}

function writeCache(userId: string, row: MembershipRow | null) {
  try {
    if (row) localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, row }))
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    // As above. Nothing depends on this succeeding.
  }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // As above.
  }
}

interface MembershipState extends Entitlement {
  /** True once a real answer has come back, from the server or from the cache. */
  checked: boolean
  /** Called once on app open. Safe when sync is not configured: it does nothing. */
  start: () => void
  /** Re-read the row. Called on sign-in, and after checkout returns. */
  refresh: () => Promise<void>
}

let started = false

export const useMembership = create<MembershipState>()((set) => ({
  ...NOT_A_MEMBER,
  checked: false,

  start: () => {
    if (started) return
    started = true

    const apply = (status: string) => {
      if (status === 'signed-in') {
        void useMembership.getState().refresh()
      } else {
        // Signing out drops the cache with it. A shared device must not leave
        // one account's membership sitting there for the next person.
        clearCache()
        set({ ...NOT_A_MEMBER, checked: true })
      }
    }

    apply(useSync.getState().status)
    useSync.subscribe((state, previous) => {
      if (state.status !== previous.status) apply(state.status)
    })
  },

  refresh: async () => {
    const sb = await getSupabase()
    if (!sb) return
    const { data } = await sb.auth.getSession()
    const userId = data.session?.user.id
    if (!userId) {
      set({ ...NOT_A_MEMBER, checked: true })
      return
    }

    // The cached row first, so a member who opens the app offline is a member
    // for the whole session rather than for everything after the request
    // fails. Trusted only as far as the period it was paid for.
    const cached = readCache(userId)
    if (cached) set({ ...readEntitlement(cached, { now: Date.now(), trusted: false }) })

    const { data: row, error } = await sb
      .from('memberships')
      .select(COLUMNS)
      .eq('user_id', userId)
      .maybeSingle()

    // Any error at all leaves the cached answer standing, which for everybody
    // who has never paid is "not a member". That covers the offline case, an
    // RLS refusal, and the state this ships in: the table exists as a migration
    // and has not been pushed, so the request comes back as an unknown
    // relation. None of those may lock a member out or let a stranger in.
    if (error) {
      set({ checked: true })
      return
    }

    writeCache(userId, row)
    set({ ...readEntitlement(row, { now: Date.now(), trusted: true }), checked: true })
  },
}))

/**
 * Is this player a member?
 *
 * The whole client seam, on purpose: one hook returning one boolean. A surface
 * that needs to know *why* somebody is not a member (a Settings row saying a
 * payment failed) reads the store directly; a surface that just gates reads
 * this, and gets to stay ignorant of Stripe forever.
 *
 * False until proven otherwise, including for the frame before the row comes
 * back. A paid surface therefore appears rather than disappearing, which is the
 * failure that is not a bug report.
 */
export function useEntitlement(): boolean {
  return useMembership((state) => state.member)
}
