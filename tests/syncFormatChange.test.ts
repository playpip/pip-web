// The profile store carries the sync fingerprint across a format change.
//
// `carryFingerprint` (tests/syncPlan.test.ts) is the rule; this holds the
// wiring: a device whose saved profile is exactly what the server took, opened
// by a build with a newer PERSIST_VERSION, must still read as saved. Before,
// it read as unsaved and asked two-device players which copy to keep.

import test from 'ava'

class MemoryStorage {
  private items = new Map<string, string>()
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
  clear() {
    this.items.clear()
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null
  }
  get length() {
    return this.items.size
  }
}

// The store finds its storage when it is created (zustand reads
// `window.localStorage`, and skips persisting without a window), so this comes
// before the import.
const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true })

test.serial('a saved device reads as saved after a format change', async (t) => {
  const { useProfile, PERSIST_VERSION } = await import('@/store/profile')
  const { dataOf, fingerprint, isUnpushed } = await import('@/lib/sync/plan')
  const { readBookmark } = await import('@/lib/sync/bookmark')

  // What the previous build saved: today's profile without the newest field.
  const old = JSON.parse(JSON.stringify(dataOf(useProfile.getState()))) as Record<string, unknown>
  old.roll = 7_400
  delete old.rating
  storage.setItem('pip.profile', JSON.stringify({ state: old, version: PERSIST_VERSION - 1 }))
  storage.setItem('pip.sync', JSON.stringify({ seen: 't1', pushed: fingerprint(dataOf(old)) }))

  await useProfile.persist.rehydrate()

  const local = dataOf(useProfile.getState())
  t.is(local.roll, 7_400)
  t.not(fingerprint(local), fingerprint(dataOf(old)), 'the migration changed the shape')
  t.false(isUnpushed(local, readBookmark()))
  t.is(readBookmark().seen, 't1')
})

test.serial('unsaved progress still reads as unsaved after a format change', async (t) => {
  const { useProfile, PERSIST_VERSION } = await import('@/store/profile')
  const { dataOf, fingerprint, isUnpushed } = await import('@/lib/sync/plan')
  const { readBookmark } = await import('@/lib/sync/bookmark')

  const old = JSON.parse(JSON.stringify(dataOf(useProfile.getState()))) as Record<string, unknown>
  delete old.rating
  const lastPushed = fingerprint(dataOf({ ...old, roll: 4_000 }))
  old.roll = 9_000 // won after the last push, never sent
  storage.setItem('pip.profile', JSON.stringify({ state: old, version: PERSIST_VERSION - 1 }))
  storage.setItem('pip.sync', JSON.stringify({ seen: 't1', pushed: lastPushed }))

  await useProfile.persist.rehydrate()

  t.is(readBookmark().pushed, lastPushed)
  t.true(isUnpushed(dataOf(useProfile.getState()), readBookmark()))
})
