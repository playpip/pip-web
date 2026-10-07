'use client'

// The two email switches in Settings, as a store so the section can load them
// from an effect without calling React's setState there (docs/development.md).

import { create } from 'zustand'
import { type EmailPrefs, readEmailPrefs, writeEmailPrefs } from '@/lib/email/prefs'

interface EmailPrefsState {
  /** Null until read. */
  prefs: EmailPrefs | null
  /** 'unavailable' when the row could not be read: offline, or no table yet. */
  status: 'idle' | 'loading' | 'ready' | 'unavailable'
  error: string | null
  load: () => Promise<void>
  /** Flip one switch. Shown at once, put back if the write fails. */
  toggle: (key: keyof EmailPrefs) => Promise<void>
}

export const useEmailPrefs = create<EmailPrefsState>()((set, get) => ({
  prefs: null,
  status: 'idle',
  error: null,

  load: async () => {
    set({ status: 'loading', error: null })
    const prefs = await readEmailPrefs()
    set(prefs ? { prefs, status: 'ready' } : { prefs: null, status: 'unavailable' })
  },

  toggle: async (key) => {
    const before = get().prefs
    if (!before) return
    const next = { ...before, [key]: !before[key] }
    set({ prefs: next, error: null })
    if (!(await writeEmailPrefs(next))) {
      set({ prefs: before, error: 'Could not save that. Try again in a moment.' })
    }
  },
}))
