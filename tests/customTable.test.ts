import { readFileSync } from 'node:fs'
import test from 'ava'
import {
  CUSTOM_BUY_INS,
  CUSTOM_DEPTHS,
  CUSTOM_SEATS,
  CUSTOM_SPEEDS,
  CUSTOM_VENUE_ID,
  DEFAULT_CUSTOM,
  type CustomTableSpec,
  customPrize,
  customVenue,
  invitableCast,
  maxBounty,
  refuseCustomTable,
  rungFor,
} from '@/config/customTable'
import { ALL_VENUES, VENUES, venueById } from '@/config/venues'
import { PERSIST_VERSION } from '@/store/profile'

// Build your own table, and the one property that makes it safe to sell.
//
// **The player picks the shape. The buy-in picks the difficulty.** A table where
// both are choices is a chip printer: take the Garage's opponents, take the Main
// Event's buy-in, collect six million. Everything below is a way of saying that
// the two dials are not independent and cannot be made so by accident.

const spec = (over: Partial<CustomTableSpec> = {}): CustomTableSpec => ({
  ...DEFAULT_CUSTOM,
  ...over,
})

// The headline. Whatever a player builds, the opposition is the ladder's own at
// that price — and it is the *same object*, so it cannot drift from the profile
// that tests/ai.test.ts bands.
test('the opposition comes from the buy-in and from nowhere else', (t) => {
  for (const rung of VENUES) {
    const built = customVenue(spec({ buyIn: rung.buyIn }))
    t.is(built.ai, rung.ai, `a ${rung.buyIn} table is not ${rung.name}'s table`)
  }
  // And nothing about the shape can move it.
  const base = customVenue(spec({ buyIn: 2_000 })).ai
  for (const seats of CUSTOM_SEATS) {
    for (const depth of CUSTOM_DEPTHS) {
      for (const handsPerLevel of CUSTOM_SPEEDS) {
        t.is(
          customVenue(spec({ buyIn: 2_000, seats, depth, handsPerLevel })).ai,
          base,
          `${seats} seats / ${depth}x / ${handsPerLevel} changed the opposition`,
        )
      }
    }
  }
})

// The mechanical half of the same rule: there is no difficulty field to set. If
// one ever appears, this is what fails.
test('the spec has no way to express "make them worse"', (t) => {
  const fields = Object.keys(DEFAULT_CUSTOM)
  t.deepEqual(fields.sort(), ['bounty', 'buyIn', 'castIds', 'depth', 'handsPerLevel', 'seats'])
  const source = readFileSync(new URL('../src/config/customTable.ts', import.meta.url), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
  t.notRegex(source, /\bskill\b/, 'customTable.ts mentions skill, which it must never set')
  t.notRegex(source, /tightness|aggression|bluff/, 'customTable.ts tunes an AI profile by hand')
})

// A rung is picked by price, downwards. Building just under a rung gets you the
// one below, never the one above — the direction matters, because the other way
// round is a discount on difficulty.
test('a buy-in buys the rung it reaches, never the one above', (t) => {
  t.is(rungFor(VENUES[0].buyIn).id, VENUES[0].id)
  t.is(rungFor(0).id, VENUES[0].id, 'below the ladder still gets the softest table')
  for (const rung of VENUES.slice(1)) {
    t.is(rungFor(rung.buyIn).id, rung.id)
    t.true(rungFor(rung.buyIn - 1).buyIn < rung.buyIn, `${rung.id} - 1 reached ${rung.id}`)
  }
})

// The prize is the shipped formula and not a choice. Equal to what the ladder
// pays for the same shape, so a custom table is never a better price for the
// same risk.
test('a built table pays exactly what a shipped one would', (t) => {
  for (const seats of CUSTOM_SEATS) {
    for (const buyIn of CUSTOM_BUY_INS) {
      const plain = customPrize(spec({ seats, buyIn, bounty: 0 }))
      t.is(plain, buyIn * seats, `${seats} seats at ${buyIn}`)
      const bounty = maxBounty(buyIn)
      t.is(
        customPrize(spec({ seats, buyIn, bounty })),
        buyIn * seats - bounty * (seats - 1),
        'the bounty is not funded out of the prize',
      )
    }
  }
})

// The bounty cannot eat the table. A prize smaller than the buy-in would be a
// tournament you lose money by winning.
test('a bounty never leaves a prize that is not worth playing for', (t) => {
  for (const seats of CUSTOM_SEATS) {
    for (const buyIn of CUSTOM_BUY_INS) {
      const built = spec({ seats, buyIn, bounty: maxBounty(buyIn) })
      t.true(
        customPrize(built) > buyIn,
        `${seats} seats at ${buyIn} pays ${customPrize(built)} for a ${buyIn} buy-in`,
      )
    }
  }
})

// The spec is persisted, therefore client-written, therefore re-checked. These
// are the shapes somebody would try in localStorage.
test('a hand-edited spec is refused rather than dealt', (t) => {
  t.is(refuseCustomTable(DEFAULT_CUSTOM), null, 'the default is refused')
  t.truthy(refuseCustomTable(spec({ seats: 40 })), '40 seats was allowed')
  t.truthy(refuseCustomTable(spec({ seats: 1 })), 'a one-seat table was allowed')
  t.truthy(refuseCustomTable(spec({ buyIn: 1 })), 'an invented buy-in was allowed')
  t.truthy(refuseCustomTable(spec({ buyIn: -5_000 })), 'a negative buy-in was allowed')
  t.truthy(refuseCustomTable(spec({ depth: 50 })), 'a 50x stack was allowed')
  t.truthy(refuseCustomTable(spec({ handsPerLevel: 0 })), 'a zero-hand blind level was allowed')
  t.truthy(refuseCustomTable(spec({ bounty: 999_999 })), 'an unfundable bounty was allowed')
  t.truthy(refuseCustomTable(spec({ bounty: -100 })), 'a negative bounty was allowed')
  t.truthy(
    refuseCustomTable(spec({ seats: 2, castIds: ['doris', 'frank', 'marge'] })),
    'more guests than chairs was allowed',
  )
  t.truthy(refuseCustomTable(spec({ castIds: ['nobody'] })), 'an invented guest was allowed')
})

// Guests are flavour. A pinned character belongs to their own venue and cannot
// be invited out of it — Pearl keeps the shop, Sable keeps the Vault.
test('you cannot invite somebody who belongs to another room', (t) => {
  const invitable = invitableCast().map((ch) => ch.id)
  t.true(invitable.length > 5)
  for (const pinned of ['pearl', 'sable', 'bev', 'dez', 'winnie']) {
    t.false(invitable.includes(pinned), `${pinned} is pinned and was offered as a guest`)
  }
})

// A built table is the membership's, and it has a route to be played at. Both
// halves matter: without the flag it is free, and without the route it 404s
// under the static export.
test('a built table is gated and still has somewhere to be played', (t) => {
  t.true(customVenue(DEFAULT_CUSTOM).membersOnly, 'a built table is free to everybody')
  const route = venueById(CUSTOM_VENUE_ID)
  t.truthy(route, `/play/${CUSTOM_VENUE_ID} is not a generated route`)
  t.true(route?.membersOnly, 'the custom route is not gated')
  t.true(
    ALL_VENUES.some((v) => v.id === CUSTOM_VENUE_ID),
    'the custom route is missing from ALL_VENUES',
  )
})

// The placeholder in ALL_VENUES exists only so the route generates. If a hand is
// ever dealt from it the resolution step has been skipped, so it is written to
// be obviously unplayable rather than quietly cheap.
test('the route placeholder cannot be mistaken for a real table', (t) => {
  const route = venueById(CUSTOM_VENUE_ID)
  t.is(route?.buyIn, 0)
  t.is(route?.prize, 0)
  t.is(route?.bigBlind, 0)
})

// The persisted field has to survive a round trip through the sync merge, or a
// player's table quietly disappears the first time they sign in on a second
// device.
test('the built table survives a sync merge', (t) => {
  const merge = readFileSync(new URL('../src/lib/sync/merge.ts', import.meta.url), 'utf-8')
  t.regex(merge, /customTable:/, 'merge.ts does not carry the built table')

  const profile = readFileSync(new URL('../src/store/profile.ts', import.meta.url), 'utf-8')
  // The migration branch, not the version number. This used to pin
  // `PERSIST_VERSION = 18` exactly, which made it fail on the next unrelated
  // bump (19, for the blackjack session) — a test that fails for being
  // out of date rather than for being wrong teaches people to edit tests.
  // What actually matters is that the field arrived with a migration and that
  // the version never goes backwards past it.
  t.regex(profile, /fromVersion < 18\) s\.customTable = null/, 'no migration for the built table')
  t.true(PERSIST_VERSION >= 18, 'the persisted profile was rolled back past the built table')
})
