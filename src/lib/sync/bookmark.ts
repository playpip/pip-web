// Where this device got to last time with the account, kept in its own
// localStorage key so the profile store can carry it across a format change
// (see `carryFingerprint` in lib/sync/plan) and the sync store can read it.

import type { Bookmark } from '@/lib/sync/plan'

const BOOKMARK_KEY = 'pip.sync'

export const NO_BOOKMARK: Bookmark = { seen: null, pushed: null }

export function readBookmark(): Bookmark {
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

export function writeBookmark(bookmark: Bookmark) {
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark))
  } catch {
    // Storage blocked. Sync still works; divergence just prompts more often,
    // which errs towards asking rather than towards overwriting.
  }
}
