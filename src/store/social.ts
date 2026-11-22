'use client'

// Your public profile and your inbox, as far as this device knows them
// (docs/social.md). Like the membership store, nothing happens without an
// account: it reacts to the sync store's session and asks nothing until there
// is one. The friends list and other people's profiles are read by the screens
// that show them, not kept here.

import { create } from 'zustand'
import { cardOf } from '@/lib/social/card'
import {
  type MyProfile,
  type Notice,
  ensureMyProfile,
  myNotices,
  readMyProfile,
  readNotices,
  refreshMyCard,
  socialEnabled,
  watchNotices,
} from '@/lib/social/api'
import { useProfile } from '@/store/profile'
import { useSync } from '@/store/sync'

/** The shown values are sent again at most this often, as the player plays. */
const CARD_EVERY_MS = 30 * 60 * 1000

interface SocialState {
  /** Undefined: not known yet. Null: no public profile. */
  me: MyProfile | null | undefined
  /** Null until read. */
  notices: Notice[] | null
  unread: number
  start: () => void
  loadMe: () => Promise<void>
  setMe: (me: MyProfile) => void
  loadNotices: () => Promise<void>
  /** Mark these read here and on the server, or with no ids, everything. */
  markRead: (ids?: number[]) => void
}

let started = false
let stopWatch: (() => void) | null = null
let cardSentAt = 0

const EMPTY = { me: undefined, notices: null, unread: 0 }

export const useSocial = create<SocialState>()((set, get) => ({
  ...EMPTY,

  start: () => {
    if (started || !socialEnabled()) return
    started = true
    const apply = (status: string, ready: boolean) => {
      if (!ready) return
      stopWatch?.()
      stopWatch = null
      if (status !== 'signed-in') {
        set(EMPTY)
        return
      }
      void get().loadMe()
      void get().loadNotices()
      void watchNotices(() => void get().loadNotices()).then((stop) => {
        stopWatch = stop
      })
    }
    const initial = useSync.getState()
    apply(initial.status, initial.ready)
    useSync.subscribe((state, previous) => {
      if (state.status !== previous.status || state.ready !== previous.ready) {
        apply(state.status, state.ready)
      }
    })
  },

  loadMe: async () => {
    let me = await readMyProfile()
    if (me === undefined) return
    // Everyone with an account has a profile; a new account gets theirs here,
    // once they have a player to make it from.
    const p = useProfile.getState()
    if (me === null && p.created) {
      const made = await ensureMyProfile({ name: p.name, avatar: p.avatar, ring: p.avatarRing })
      if (made.ok) me = (await readMyProfile()) ?? null
    }
    set({ me })
    // Your shown numbers move as you play: send them again now and then, on
    // the next open, rather than after every hand.
    if (me && Date.now() - cardSentAt > CARD_EVERY_MS) {
      cardSentAt = Date.now()
      void refreshMyCard({
        name: p.name,
        avatar: p.avatar,
        ring: p.avatarRing,
        card: cardOf(p, me.shown),
      })
    }
  },

  setMe: (me) => {
    cardSentAt = Date.now()
    set({ me })
  },

  loadNotices: async () => {
    const r = await myNotices()
    if (!r.ok) return
    set({ notices: r.value, unread: r.value.filter((n) => !n.read).length })
  },

  markRead: (ids) => {
    const { notices } = get()
    if (!notices) return
    const marks = (n: Notice) => !n.read && (!ids || ids.includes(n.id))
    if (!notices.some(marks)) return
    const next = notices.map((n) => (marks(n) ? { ...n, read: true } : n))
    set({ notices: next, unread: next.filter((n) => !n.read).length })
    void readNotices(ids)
  },
}))
