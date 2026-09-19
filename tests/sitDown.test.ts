// The lobby and the route have to give the same answer (technology#90).
//
// Escrow made the Roll two numbers. `profile.roll` is what the account says;
// the spendable Roll is that plus any buy-in another device is still holding,
// because sitting down here reclaims it before it pays. The cards on the lobby
// were moved onto the spendable one when escrow shipped and `/play/[venue]`
// was not, so the app offered a table and then the route it linked to sent the
// player home. No message, no error, nothing to read: a card that had just
// said "you can afford this" turning into the home screen.
//
// The fix is that there is one function, `lib/sitDown`, and both callers ask
// it. These tests are about the answers it gives and, at the end, about the
// two callers still asking it, a rule that only holds while nobody reaches
// past it for `profile.roll` again.
//
// What this cannot cover: anything about the screen. No browser here. That the
// card is enabled, that the route seats you, that the freeroll button is gone
// when it should be, all still need somebody to click them on two devices.

import { readFileSync, readdirSync } from 'node:fs'
import test from 'ava'
import {
  challengeOnOffer,
  freerollOnOffer,
  refuseSitDown,
  rollToSitDownWith,
  type SitDownInput,
} from '@/lib/sitDown'
import {
  ALL_VENUES,
  KITCHEN_TABLE,
  SIDE_SHELF,
  SIDE_TABLES,
  VENUES,
  venueById,
} from '@/config/venues'
import type { Escrow } from '@/lib/sync/escrow'

const A = 'device-a'
const B = 'device-b'

// Membership is a fourth argument to `refuseSitDown` rather than a field on the
// profile, because it must never be a field on the profile (see lib/sitDown).
// These two names exist so that every call below says which player it is asking
// about instead of trailing a bare boolean.
//
// **The money tests pass `MEMBER`.** Their subject is that the lobby and the
// route agree about the Roll, and a member room refused for not being a member
// would answer a different question with the same word. The membership axis has
// its own tests further down.
const MEMBER = true
const STRANGER = false

const player = (roll: number, escrow: Escrow | null = null): SitDownInput => ({
  roll,
  escrow,
  venueRecords: {},
  challengeWins: [],
  challengesPlayed: 0,
})

const heldBy = (deviceId: string, chips: number): Escrow => ({
  deviceId,
  chips,
  venueId: 'garage',
})

const GARAGE = VENUES[0]
const CHALLENGE_LOW = venueById('challenge-low')!
const CHALLENGE_MID = venueById('challenge-mid')!

test('a buy-in parked on the laptop is a buy-in the phone can sit down with', (t) => {
  // The exact shape of the bug: the Roll reads zero on this device because the
  // other one is sat at a table, and sitting down here fetches those chips.
  const p = player(0, heldBy(B, 1_000))
  t.is(rollToSitDownWith(p, A), 1_000)
  t.is(refuseSitDown(GARAGE, p, A, STRANGER), null, 'the route seats them')
})

test('chips this device is already holding are not a second buy-in', (t) => {
  // The mirror, and the one that matters more: counting your own escrow twice
  // is how you buy into two tournaments with one buy-in.
  const p = player(0, heldBy(A, 1_000))
  t.is(rollToSitDownWith(p, A), 0)
  for (const venue of ALL_VENUES) {
    if (venue.buyIn === 0) continue
    t.is(refuseSitDown(venue, p, A, MEMBER), 'cannot-afford', `${venue.id} is refused`)
  }
})

test('what the lobby offers is what the route honours, at every table', (t) => {
  // The dead click as a property rather than an anecdote. The cards enable on
  // `spendable >= buyIn` (VenueBrowser, RailBrowser, DailyTile); the route must
  // not then refuse them for money.
  const cases: SitDownInput[] = [
    player(0),
    player(0, heldBy(B, 1_000)),
    player(0, heldBy(A, 1_000)),
    player(99),
    player(100),
    player(2_500, heldBy(B, 40_000)),
    player(2_500, heldBy(A, 40_000)),
    player(1_000_000),
  ]
  for (const p of cases) {
    const spendable = rollToSitDownWith(p, A)
    for (const venue of ALL_VENUES) {
      const offered = spendable >= venue.buyIn
      const refused = refuseSitDown(venue, p, A, MEMBER) === 'cannot-afford'
      t.is(refused, !offered, `${venue.id} at a spendable Roll of ${spendable}`)
    }
  }
})

test('the freeroll closes when the chips are only somewhere else', (t) => {
  // It is a safety net, not a farm. A player whose Roll reads zero because
  // their laptop is at a table is not out of chips, and both the button on the
  // home screen and the route it points at have to agree about that.
  const stranded = player(0, heldBy(B, 1_000))
  t.false(freerollOnOffer(stranded, A), 'not broke, so no button')
  t.is(refuseSitDown(KITCHEN_TABLE, stranded, A, STRANGER), 'freeroll-closed')

  const broke = player(0, heldBy(A, 1_000))
  t.true(freerollOnOffer(broke, A), 'the chips are on this table, so broke')
  t.is(refuseSitDown(KITCHEN_TABLE, broke, A, STRANGER), null)
})

test('the challenge the card offers is the challenge the table seats', (t) => {
  const p = player(0, heldBy(B, 600))
  t.is(challengeOnOffer(p, A)?.venue.id, CHALLENGE_LOW.id)
  t.is(refuseSitDown(CHALLENGE_LOW, p, A, STRANGER), null)
  // Two bands up is the farm the guard exists for, affordable or not.
  t.is(refuseSitDown(CHALLENGE_MID, p, A, STRANGER), 'cannot-afford')

  // And from the device actually holding the chips there is no challenge at
  // all, so the route must not seat one.
  t.is(challengeOnOffer(p, B), null)
  t.is(refuseSitDown(CHALLENGE_LOW, p, B, STRANGER), 'cannot-afford')
})

test('an unaffordable challenge is refused for money, not for identity', (t) => {
  // `affordableBand` walks down to a band the Roll can reach, so a player who
  // can afford nothing gets no challenge. The refusal has to name the real
  // reason or the route sends them to the wrong screen.
  const skint = player(0)
  t.is(challengeOnOffer(skint, A), null)
  t.is(refuseSitDown(CHALLENGE_LOW, skint, A, STRANGER), 'cannot-afford')
})

// --- the membership axis -----------------------------------------------------
// Same failure as escrow's, one axis over: the lobby decides what to show from
// `useEntitlement()` and the route decides what to seat from the same hook, and
// if they ever derive it separately a member clicks their own room and lands on
// the home screen. So both go through this function, and these are the answers
// it owes them.

test('a member room is refused to a stranger and opened to a member', (t) => {
  const rich = player(1_000_000)
  for (const venue of ALL_VENUES.filter((v) => v.membersOnly)) {
    t.is(
      refuseSitDown(venue, rich, A, STRANGER),
      'members-only',
      `${venue.id} let a non-member sit down`,
    )
    t.is(refuseSitDown(venue, rich, A, MEMBER), null, `${venue.id} refused a member`)
  }
})

// The order of the two refusals, and it is not cosmetic. "You cannot afford it"
// is a lie told to somebody whose Roll is fine, and the worst kind: they can act
// on it. They go and win the buy-in and the room still says no.
test('a member room refuses for the membership before it refuses for money', (t) => {
  const skint = player(0)
  // The `custom` entry is excluded because it is not a table: it is the route
  // placeholder that lets a built table have somewhere to be played under the
  // static export, and its buy-in is 0, so there is no money refusal to put in
  // order against. `tests/customTable.test.ts` covers what it is for.
  const rooms = ALL_VENUES.filter((v) => v.membersOnly && v.buyIn > 0)
  t.true(rooms.length > 0)
  for (const venue of rooms) {
    t.is(refuseSitDown(venue, skint, A, STRANGER), 'members-only', venue.id)
    t.is(refuseSitDown(venue, skint, A, MEMBER), 'cannot-afford', venue.id)
  }
})

// Nothing that shipped free may acquire the flag later. This is the mechanical
// half of "anything shipped free is free forever": the free catalogue is named
// here, so making one of those rooms paid means editing this list, which is a
// thing somebody has to justify rather than a one-word diff in a config file.
test('the tables that shipped free are still free', (t) => {
  const paid = new Set(ALL_VENUES.filter((v) => v.membersOnly).map((v) => v.id))
  t.deepEqual(
    [...paid].sort(),
    [
      'bigpot',
      'custom',
      'deepstack-15000',
      'deepstack-2000',
      'deepstack-40000',
      'deepstack-5000',
      'deepstack-750',
    ],
    'the set of paid tables changed — if a free table moved behind the membership, that is rule 1',
  )
  // `falsy`, not `false`: the flag is absent on a free table rather than set to
  // false, and absent is the state the whole default rests on.
  for (const venue of [...VENUES, KITCHEN_TABLE]) {
    t.falsy(venue.membersOnly, `${venue.id} is on the free ladder and has been made paid`)
  }
})

// A member room that pays better for the same risk is the shape the "nothing you
// can buy changes a hand" line does not survive.
//
// The formula is not invented here, it is read off the shipped tables: a
// winner-take-all pays every seat's buy-in, and a bounty table funds its
// knockout payments out of that same pot. The Docks (2,000 × 6 − 500 × 5 =
// 9,500) and the Chop Shop (5,000 × 6 − 1,500 × 5 = 22,500) both land on it
// exactly, which is what makes it the rule rather than a guess.
//
// It caught two: The Back Room and Last Orders were originally written at
// 27,000 and 36,000, which is 1,000 and 500 over. Nobody would have noticed
// from the screen.
const fairPrize = (v: { buyIn: number; seats: number; bounty?: number }) =>
  v.buyIn * v.seats - (v.bounty ?? 0) * (v.seats - 1)

test('member rooms pay exactly what the free tables pay for the same risk', (t) => {
  for (const venue of ALL_VENUES.filter((v) => v.membersOnly)) {
    t.is(
      venue.prize,
      fairPrize(venue),
      `${venue.id} pays ${venue.prize} where the shipped formula pays ${fairPrize(venue)}`,
    )
  }
})

// And the tables it was derived from, so the formula cannot drift away from the
// thing it was read off without this failing too.
test('the bounty tables it was derived from still fit the formula', (t) => {
  for (const id of ['docks', 'chopshop']) {
    const venue = ALL_VENUES.find((v) => v.id === id)
    t.truthy(venue, `${id} is gone — re-derive the prize rule before trusting it`)
    if (venue) t.is(venue.prize, fairPrize(venue), id)
  }
})

// The lobby tile counts the shelf, and it has to count the shelf it is actually
// showing. It said "7 formats" over a page rendering nine the day the
// membership's tables moved onto it, because the tile counted `SIDE_TABLES` and
// the page rendered something else. Same class as the escrow bug above: two
// places deriving one fact separately.
test('the side-tables tile counts the shelf it links to', (t) => {
  const home = readFileSync(new URL('../src/components/menu/Home.tsx', import.meta.url), 'utf-8')
  const shelf = readFileSync(
    new URL('../src/components/menu/SideTables.tsx', import.meta.url),
    'utf-8',
  )
  t.regex(home, /SIDE_SHELF\.length/, 'the lobby tile counts something other than the shelf')
  t.regex(shelf, /venues=\{SIDE_SHELF\}/, 'the shelf renders something other than SIDE_SHELF')
  // And the shelf is the free side tables plus what the membership adds — if
  // that stops being true, the sentence on the tile needs re-reading too.
  t.is(SIDE_SHELF.length, SIDE_TABLES.length + 2)
  t.true(
    SIDE_SHELF.some((v) => v.membersOnly),
    'the shelf lost its member tables',
  )
})

// --- the drift guard ---------------------------------------------------------
// The bug was not a wrong answer. It was two places asking the same question
// separately, and one of them being updated. So the rule is that the screens do
// not ask it themselves.

/** Every `.ts`/`.tsx` under a directory, comments stripped: a note is not a call. */
function sources(dir: string): { path: string; code: string }[] {
  const out: { path: string; code: string }[] = []
  for (const entry of readdirSync(new URL(`../${dir}`, import.meta.url), {
    withFileTypes: true,
  })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) out.push(...sources(path))
    else if (/\.tsx?$/.test(entry.name)) {
      out.push({
        path,
        code: readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/^\s*\/\/.*$/gm, ' '),
      })
    }
  }
  return out
}

const TABLE = 'src/components/table/Table.tsx'

// No exemptions. This used to skip `Table.tsx` wholesale, on the grounds that a
// live table is the one screen where another device's escrow is not ours to
// spend. That is true of its rebuy and false of the freeroll button next to it,
// and a file-level skip cannot tell two questions apart. The rule is per-call
// and it is the one in the decision log: **a gate reads the spendable Roll if
// and only if the click leads to `sitDown`**, because that is the one path that
// reclaims. The freeroll button opens a new table through the route, so it
// qualifies; the rebuy re-seats a table already open here, so it does not.
test('no screen answers "can I sit down here" for itself', (t) => {
  const asked = /\b(canAfford|freerollOpen|currentChallenge|affordableBand)\s*\(/
  let checked = 0
  for (const dir of ['src/app', 'src/components']) {
    for (const { path, code } of sources(dir)) {
      checked++
      const hit = asked.exec(code)
      t.is(hit, null, `${path} calls ${hit?.[1]} directly, go through lib/sitDown`)
    }
  }
  t.true(checked > 50, `scanned ${checked} files, which is too few to mean anything`)
})

// The two questions the table screen asks about money, which have to stay
// different. Getting the rebuy wrong spends a buy-in twice; getting the
// freeroll wrong offers a button that the route refuses, dropping the player on
// the home screen with nothing to read. `freerollOnOffer` against a stranded
// Roll is tested above; this is the wiring that decides which one the screen
// calls.
test('the table rebuys from the Roll it holds and offers the freeroll from the Roll it can spend', (t) => {
  const code = readFileSync(new URL(`../${TABLE}`, import.meta.url), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

  t.regex(
    code,
    /roll >= venue\.buyIn/,
    'the rebuy must stay on profile.roll: rebuy() does not reclaim, so it must not offer to spend a buy-in another device is holding',
  )
  t.regex(
    code,
    /useFreerollOnOffer\(\)/,
    'the freeroll button opens a table through the route, so it has to be decided by the function the route uses',
  )
  t.notRegex(
    code,
    /freerollOpen\s*\(/,
    'freerollOpen(profile.roll) here disagrees with the route, which asks it against the spendable Roll',
  )
})
