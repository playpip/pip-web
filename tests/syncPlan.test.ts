// The sync decision. Every branch here can cost a player chips, and until
// technology#89 not one of them had a test: `store/sync.ts` needs a browser, so
// the merge policy was covered and the orchestration around it was not. The
// decision now lives in a pure function for the same reason the merge does.
//
// The bug these tests exist to hold shut: a push that dies in flight (what
// backgrounding a PWA does to it) left the winnings local, and the next open
// could not tell that from being in sync — so it either skipped the push and
// reported "synced", or adopted the server's Roll with no prompt.

import test from 'ava'
import { fingerprint, isUnpushed, planSync, type Bookmark } from '@/lib/sync/plan'
import type { ProfileData } from '@/lib/sync/merge'
import { emptySeatStats } from '@/lib/reads'
import { STARTING_ROLL } from '@/config/venues'

const VERSION = 99

function profile(over: Partial<ProfileData> = {}): ProfileData {
  return {
    created: true,
    name: 'Player',
    avatar: null,
    roll: 4_000,
    peakRoll: 6_000,
    stats: {
      handsPlayed: 300,
      handsWon: 90,
      biggestPot: 2_400,
      showdownsWon: 40,
      tournamentsEntered: 12,
      tournamentsWon: 3,
    },
    rollHistory: [{ t: 10, roll: 4_000 }],
    venueRecords: {},
    tendencies: emptySeatStats(),
    cardBack: 'classic',
    awards: {},
    cameFromFreeroll: false,
    castRecords: {},
    tableTalk: true,
    handCoaching: true,
    haptics: false,
    daily: null,
    owned: [],
    deckFace: 'classic',
    tableFinish: null,
    challengeWins: [],
    challengesPlayed: 0,
    drills: {},
    ...over,
  } as ProfileData
}

/** What onboarding leaves behind, and what a cleared profile looks like. */
function pristine(): ProfileData {
  return profile({
    roll: STARTING_ROLL,
    peakRoll: STARTING_ROLL,
    rollHistory: [{ t: 9_999, roll: STARTING_ROLL }],
    stats: { ...profile().stats, handsPlayed: 0, tournamentsEntered: 0 },
  })
}

const OURS = 'device-a'
const THEIRS = 'device-b'

function row(profileData: ProfileData, over: { updatedAt?: string; deviceId?: string } = {}) {
  return {
    profile: profileData,
    updatedAt: over.updatedAt ?? 't1',
    deviceId: over.deviceId ?? OURS,
    version: VERSION,
  }
}

function plan(over: {
  local: ProfileData
  row?: ReturnType<typeof row> | null
  bookmark?: Bookmark
  changedHere?: boolean
}) {
  return planSync({
    local: over.local,
    row: over.row === undefined ? row(over.local) : over.row,
    bookmark: over.bookmark ?? { seen: 't1', pushed: null },
    deviceId: OURS,
    changedHere: over.changedHere ?? false,
    persistVersion: VERSION,
  })
}

// --- the bug -----------------------------------------------------------------

test('a push that never landed is still pending after a reload', (t) => {
  const before = profile({ roll: 4_000 })
  const after = profile({ roll: 9_000 }) // the session the push was meant to carry

  const p = plan({
    local: after,
    row: row(before),
    bookmark: { seen: 't1', pushed: fingerprint(before) },
    changedHere: false, // the flag died with the page
  })

  t.is(p.action, 'push')
})

test('the same state with no fingerprint reads as in sync', (t) => {
  // What shipped, and what an upgrading player's bookmark still looks like on
  // its first run: no `pushed`, so the in-memory flag is all there is. The
  // fallback is deliberate — it is the old behaviour, not a new prompt.
  const p = plan({
    local: profile({ roll: 9_000 }),
    row: row(profile({ roll: 4_000 })),
    bookmark: { seen: 't1', pushed: null },
  })

  t.is(p.action, 'idle')
})

test('a row that moved elsewhere never swallows unpushed chips', (t) => {
  const local = profile({ roll: 9_000 })
  const remote = profile({ roll: 1_200 })

  const p = plan({
    local,
    row: row(remote, { updatedAt: 't2', deviceId: THEIRS }),
    bookmark: { seen: 't1', pushed: fingerprint(profile({ roll: 4_000 })) },
    changedHere: false,
  })

  t.is(p.action, 'conflict')
})

test('a row that moved elsewhere is adopted when this device is level', (t) => {
  const local = profile({ roll: 4_000 })
  const remote = profile({ roll: 1_200 })

  const p = plan({
    local,
    row: row(remote, { updatedAt: 't2', deviceId: THEIRS }),
    bookmark: { seen: 't1', pushed: fingerprint(local) },
  })

  t.is(p.action, 'adopt')
  t.is(p.action === 'adopt' ? p.profile.roll : null, 1_200)
})

// --- the branches around it --------------------------------------------------

test('no row yet is a straight upload', (t) => {
  t.is(plan({ local: profile(), row: null }).action, 'upload')
})

test('a row from a newer client is refused', (t) => {
  const p = planSync({
    local: profile(),
    row: { ...row(profile()), version: VERSION + 1 },
    bookmark: { seen: null, pushed: null },
    deviceId: OURS,
    changedHere: false,
    persistVersion: VERSION,
  })
  t.is(p.action, 'too-new')
})

test('signing in on a fresh device restores the account outright', (t) => {
  const remote = profile({ roll: 12_000 })
  const p = plan({
    local: pristine(),
    row: row(remote, { updatedAt: 't2', deviceId: THEIRS }),
    bookmark: { seen: null, pushed: null },
  })

  t.is(p.action, 'restore')
  t.deepEqual(p.action === 'restore' ? p.profile : null, remote)
})

test('a cleared profile is restored, not pushed over the account', (t) => {
  // Drop `pip.profile`, keep `pip.sync`: the bookmark still matches the row and
  // the fingerprint no longer matches anything. Reading that as work to upload
  // would write the empty profile over a real account, so the fingerprint gets
  // no vote in this branch.
  const remote = profile({ roll: 12_000 })
  const p = plan({
    local: pristine(),
    row: row(remote),
    bookmark: { seen: 't1', pushed: fingerprint(remote) },
  })

  t.is(p.action, 'restore')
})

test('a deliberate reset goes up rather than being restored', (t) => {
  // Same pristine profile, but produced on purpose in this session. `dirty` is
  // the only thing that tells the two apart, which is why it survives.
  const p = plan({
    local: pristine(),
    row: row(profile({ roll: 12_000 })),
    bookmark: { seen: 't1', pushed: fingerprint(profile({ roll: 12_000 })) },
    changedHere: true,
  })

  t.is(p.action, 'push')
})

test('our own last write coming back is not a foreign row', (t) => {
  const local = profile()
  const p = plan({
    local,
    row: row(local, { updatedAt: 't9', deviceId: OURS }),
    bookmark: { seen: 't1', pushed: fingerprint(local) },
  })

  t.is(p.action, 'idle')
})

test('both moved but agree: merge in the player’s favour and push', (t) => {
  const local = profile({ awards: { rounder: 20 }, peakRoll: 8_000 })
  const remote = profile({ awards: { grinder: 30 }, peakRoll: 6_000 })

  const p = plan({
    local,
    row: row(remote, { updatedAt: 't2', deviceId: THEIRS }),
    bookmark: { seen: 't1', pushed: fingerprint(profile()) },
  })

  t.is(p.action, 'merge')
  if (p.action !== 'merge') return
  t.deepEqual(p.profile.awards, { rounder: 20, grinder: 30 })
  t.is(p.profile.peakRoll, 8_000)
})

test('a state the server has accepted is idle', (t) => {
  const local = profile()
  const p = plan({ local, bookmark: { seen: 't1', pushed: fingerprint(local) } })
  t.is(p.action, 'idle')
})

// --- the bookmark it hands back ---------------------------------------------

test('a pull forgets the fingerprint; staying put keeps it', (t) => {
  const local = profile({ roll: 4_000 })
  const pushed = fingerprint(profile({ roll: 1_000 }))

  const stay = plan({ local, bookmark: { seen: 't1', pushed } })
  t.is(stay.action === 'push' ? stay.bookmark.pushed : null, pushed)

  const pull = plan({
    local,
    row: row(profile({ roll: 4_000, name: 'Elsewhere' }), { updatedAt: 't2', deviceId: THEIRS }),
    bookmark: { seen: 't1', pushed: fingerprint(local) },
  })
  // The local profile is about to become something the server never took from
  // this device, so the fingerprint stops meaning anything.
  t.is(pull.action, 'adopt')
  t.is(pull.action === 'adopt' ? pull.bookmark.pushed : 'kept', null)
  t.is(pull.action === 'adopt' ? pull.bookmark.seen : null, 't2')
})

// --- the fingerprint ---------------------------------------------------------

test('the fingerprint survives a reload and notices a chip', (t) => {
  const a = profile()
  // A rehydrated store rebuilds the object in the initial state's key order,
  // not the stored one, so key order cannot count.
  const shuffled = Object.fromEntries(
    Object.entries(a as unknown as Record<string, unknown>).reverse(),
  ) as unknown as ProfileData

  t.is(fingerprint(a), fingerprint(shuffled))
  t.not(fingerprint(a), fingerprint(profile({ roll: a.roll + 1 })))
  t.not(fingerprint(a), fingerprint(profile({ awards: { rounder: 1 } })))
})

test('an unknown fingerprint is not evidence of anything', (t) => {
  const local = profile()
  t.false(isUnpushed(local, { seen: 't1', pushed: null }))
  t.false(isUnpushed(local, { seen: 't1', pushed: fingerprint(local) }))
  t.true(isUnpushed(local, { seen: 't1', pushed: fingerprint(profile({ roll: 1 })) }))
})
