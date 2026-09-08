// The table escrow (technology#90).
//
// The bug: `pip.table` is a separate localStorage key that sync does not touch,
// but sitting down debits the Roll and the Roll *is* synced. So device A sat
// down, pushed a Roll a buy-in lighter, and device B pulled a Roll with nothing
// to show for the difference. Go back to A and finish and the chips come home;
// do not, and they never do.
//
// These tests are about the two rules that fix it and the one property the fix
// is for: **chips are conserved**. What they cover is the pure layer in
// `lib/sync/escrow` composed the way the stores compose it, and the merge rule
// that keeps the escrow attached to the Roll it came out of. What they do not
// cover is `store/game` and `store/sync` calling them, which needs a browser.

import test from 'ava'
import {
  claimEscrow,
  type Escrow,
  reclaimable,
  spendableRoll,
  tableIsBacked,
} from '@/lib/sync/escrow'
import { mergeProfiles, type ProfileData } from '@/lib/sync/merge'
import { migrateProfile } from '@/store/profile'
import { emptySeatStats } from '@/lib/reads'

const A = 'device-a'
const B = 'device-b'
const held = (over: Partial<Escrow> = {}): Escrow => ({
  deviceId: A,
  chips: 1_000,
  venueId: 'garage',
  ...over,
})

test('nothing is reclaimable from an account with nothing out', (t) => {
  t.is(reclaimable(null, A), 0)
  t.is(reclaimable(undefined, A), 0)
  t.is(spendableRoll(4_000, null, A), 4_000)
})

test('your own chips on your own table are not spendable again', (t) => {
  // The whole point of holding them: counting them here is how one buy-in buys
  // into two tournaments.
  t.is(reclaimable(held(), A), 0)
  t.is(spendableRoll(4_000, held(), A), 4_000)
})

test("another device's chips are spendable, because spending them is what takes them back", (t) => {
  t.is(reclaimable(held(), B), 1_000)
  t.is(spendableRoll(4_000, held(), B), 5_000)
})

test('a table is backed only by an escrow that names this device and this venue', (t) => {
  t.true(tableIsBacked(held(), A, 'garage'))
  t.false(tableIsBacked(held(), B, 'garage'), 'another device took the chips home')
  t.false(tableIsBacked(held(), A, 'pub'), 'a stale snapshot of a table we left')
})

test('an unclaimed escrow backs the table, and getting this backwards ends a live run', (t) => {
  // Load-bearing asymmetry. Null is what every account looks like on the day
  // this ships, including everybody sat at a table right now: the migration
  // cannot know, because the table is a localStorage key it may not read and it
  // also runs against rows written by other devices. Reading null as "not
  // yours" would drop their tournament on the first pull after the upgrade.
  t.true(tableIsBacked(null, A, 'garage'))
  t.true(tableIsBacked(undefined, A, 'garage'))
})

test('claiming is idempotent, so a save on every deal is a comparison and not a write', (t) => {
  const current = held()
  t.is(claimEscrow(current, held()), null)
  t.deepEqual(claimEscrow(null, current), current)
  t.deepEqual(claimEscrow(current, held({ chips: 2_000 })), held({ chips: 2_000 }))
  t.deepEqual(claimEscrow(current, held({ venueId: 'pub' })), held({ venueId: 'pub' }))
  t.deepEqual(claimEscrow(current, held({ deviceId: B })), held({ deviceId: B }))
})

// The merge: an escrow is half of a balance, so it has to follow the other half.

function profile(over: Partial<ProfileData> = {}): ProfileData {
  return {
    created: true,
    name: 'Player',
    avatar: null,
    roll: 4_000,
    peakRoll: 6_000,
    stats: {
      handsPlayed: 0,
      handsWon: 0,
      biggestPot: 0,
      showdownsWon: 0,
      tournamentsEntered: 0,
      tournamentsWon: 0,
    },
    rollHistory: [],
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
    escrow: null,
    ...over,
  } as ProfileData
}

test('the escrow follows the side the Roll follows', (t) => {
  const local = profile({ roll: 3_000, escrow: held() })
  const remote = profile({ roll: 4_000, escrow: null })
  t.deepEqual(mergeProfiles(local, remote, 'local').escrow, held())
  t.is(mergeProfiles(local, remote, 'remote').escrow, null)
})

test('a winner holding nothing does not inherit the loser’s claim', (t) => {
  // What `pickUnhandled` would have done, and the one wrong answer available:
  // `winner.escrow ?? loser.escrow` leaves a Roll that was never debited owing
  // a thousand chips to a table it has no record of.
  const local = profile({ roll: 4_000, escrow: null })
  const remote = profile({ roll: 3_000, escrow: held() })
  t.is(mergeProfiles(local, remote, 'local').escrow, null)
})

test('an old profile migrates to an unclaimed escrow rather than to no field', (t) => {
  // `undefined` would read as unclaimed too, but it is not a value the merge or
  // the fingerprint can see, and the fingerprint is what decides a push.
  const migrated = migrateProfile({ roll: 4_000, drills: {} }, 16)
  t.is(migrated.escrow, null)
  t.true('escrow' in migrated)
})

// The property the whole thing is for.

test('two devices, one buy-in: no chips are made and none are lost', (t) => {
  // The sequence in the bug report, played out through the pure rules in the
  // order the stores apply them. `total` is what the player owns however it is
  // split between the Roll and a table, and it may not move.
  const BUY_IN = 1_000
  const START = 4_000
  const total = (roll: number, escrow: Escrow | null) => roll + (escrow?.chips ?? 0)

  // A sits down: the buy-in leaves the Roll and A says it has it.
  let roll = START - BUY_IN
  let escrow: Escrow | null = { deviceId: A, chips: BUY_IN, venueId: 'garage' }
  t.is(total(roll, escrow), START)

  // B pulls that profile. Nothing happens to A's table: B has not asked for
  // anything, and a pull is not a reason to end somebody's tournament.
  t.is(roll, 3_000, 'B sees a Roll short by the buy-in, which is the truth')
  t.is(spendableRoll(roll, escrow, B), START, 'and can still spend all of it')

  // B sits down at the same price. The chips come home first, then go out
  // again against B's table.
  roll += reclaimable(escrow, B)
  escrow = null
  roll -= BUY_IN
  escrow = { deviceId: B, chips: BUY_IN, venueId: 'pub' }
  t.is(total(roll, escrow), START, 'still exactly what the player started with')

  // A pulls. Its table is no longer backed, so it goes, and it credits nothing:
  // the chips are already home and out again on B's table.
  t.false(tableIsBacked(escrow, A, 'garage'))
  t.is(total(roll, escrow), START)

  // B busts. The buy-in is spent, which is the one honest way to lose it.
  escrow = null
  t.is(total(roll, escrow), START - BUY_IN)
})

test('a player who never goes back gets the chips at the next sit-down anywhere', (t) => {
  // The version of the bug that was permanent: abandon device A and the buy-in
  // was gone. Now it is waiting at whatever table they sit at next, including a
  // cheaper one, so a short Roll can never trap them.
  const escrow: Escrow = { deviceId: A, chips: 1_000, venueId: 'garage' }
  t.is(spendableRoll(0, escrow, B), 1_000)
  t.is(reclaimable(escrow, B), 1_000)
})
