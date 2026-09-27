// The lobby's hierarchy, which is now derived rather than arranged.
//
// The home screen leads with one table instead of listing five, so the rule
// that picks it is load-bearing in a way a tile order never was: get it wrong
// and the app confidently recommends the wrong thing, every session, to
// everybody. It is a pure function precisely so that rule can be pinned here —
// nothing in a runner can look at the card it feeds.
//
// What this cannot cover: anything about the screen. That the hero renders,
// that the shelf below drops whatever won the hero slot, that the strip fills
// left to right — all still need somebody to look at it.

import test from 'ava'
import { ladderProgress, nextUp, quickPlay } from '@/lib/nextUp'
import { refuseSitDown, type SitDownInput } from '@/lib/sitDown'
import {
  ALL_VENUES,
  CHALLENGE_TABLES,
  KITCHEN_TABLE,
  RING_TABLES,
  THE_DAILY,
  VENUES,
} from '@/config/venues'
import type { VenueRecord } from '@/store/profile'

const DEVICE = 'device-a'

const won = (...venueIds: string[]): Record<string, VenueRecord> =>
  Object.fromEntries(
    venueIds.map((id) => [id, { entered: 1, won: 1, bestFinish: 1, fastestWinHands: 20 }]),
  )

const player = (roll: number, over: Partial<SitDownInput> = {}): SitDownInput => ({
  roll,
  escrow: null,
  venueRecords: {},
  challengeWins: [],
  challengesPlayed: 0,
  ...over,
})

// --- the order ---------------------------------------------------------------

test('out of chips, the answer is the freeroll', (t) => {
  const pick = nextUp(player(VENUES[0].buyIn - 1), DEVICE)
  t.is(pick.kind, 'freeroll')
  t.is(pick.venue.id, KITCHEN_TABLE.id)
})

test('the freeroll closes the moment the bottom rung is affordable', (t) => {
  t.not(nextUp(player(VENUES[0].buyIn), DEVICE).kind, 'freeroll')
})

test('the ladder is the answer at every Roll that can reach an unwon rung', (t) => {
  // The rule, stated once. Everything below is a case where the ladder cannot
  // answer; there is no case where something else outranks a rung still to be
  // won.
  for (const roll of [VENUES[0].buyIn, 500, 50_000, 1_000_000]) {
    const p = player(roll, { venueRecords: won('garage') })
    t.is(nextUp(p, DEVICE).kind, 'ladder', `something took the hero slot at ${roll}`)
  }
})

test('the Daily never takes the hero slot', (t) => {
  // It is a once-a-day novelty rather than a step up, and it is a real table
  // with a real route, so nothing stops it being picked by accident if the
  // ordering is ever rewritten. It has a tile on the shelf and that is all
  // (Will, 2026-09-20).
  for (const roll of [0, THE_DAILY.buyIn, 50_000, 1_000_000]) {
    for (const records of [{}, won('garage'), won(...VENUES.map((v) => v.id))]) {
      const pick = nextUp(player(roll, { venueRecords: records }), DEVICE)
      t.not(pick.venue.id, THE_DAILY.id, `the Daily is the hero at ${roll}`)
    }
  }
})

test('the challenger never outranks a rung still to be won', (t) => {
  // A challenge is on offer at any Roll past its buy-in and nothing about it
  // ever expires, so ranked above the ladder it takes the hero slot at
  // essentially every Roll — the same face, every session, with the game's own
  // progression never once recommended.
  const cheapest = Math.min(...CHALLENGE_TABLES.map((v) => v.buyIn))
  for (const roll of [cheapest, 50_000, 1_000_000]) {
    const p = player(roll, { venueRecords: won('garage') })
    t.is(nextUp(p, DEVICE).kind, 'ladder', `the challenger took the hero slot at ${roll}`)
  }
})

test('the challenger comes up once the ladder has nothing new', (t) => {
  // Cleared: there is no unwon rung left to point at, and a standing invitation
  // is a better answer than a rung already taken down.
  const cleared = player(1_000_000, { venueRecords: won(...VENUES.map((v) => v.id)) })
  t.is(nextUp(cleared, DEVICE).kind, 'challenge')

  // Out of reach: the next rung costs more than the Roll, but a challenge fits.
  // A challenge pays about 2.5x, so it is a better route to that rung than
  // replaying one already beaten.
  const stalled = player(CHALLENGE_TABLES[0].buyIn, { venueRecords: won('garage', 'pub') })
  t.true(stalled.roll < VENUES[2].buyIn, 'the fixture can afford the next rung after all')
  t.is(nextUp(stalled, DEVICE).kind, 'challenge')
})

test('the hero is only ever a ladder rung, a challenge table or the freeroll', (t) => {
  // The shelf below is the directory; this card is the spine. A side table, a
  // ring game or a member room turning up here would be the five-tile grid
  // creeping back in one card at a time.
  const allowed = new Set([
    ...VENUES.map((v) => v.id),
    ...CHALLENGE_TABLES.map((v) => v.id),
    KITCHEN_TABLE.id,
  ])
  for (const roll of [0, 100, 500, 5_000, 60_000, 2_000_000]) {
    for (const records of [{}, won('garage', 'pub'), won(...VENUES.map((v) => v.id))]) {
      const pick = nextUp(player(roll, { venueRecords: records }), DEVICE)
      t.true(allowed.has(pick.venue.id), `${pick.venue.id} reached the hero slot at ${roll}`)
      t.truthy(
        ALL_VENUES.find((v) => v.id === pick.venue.id),
        'the hero offers a table that is not in the catalogue',
      )
    }
  }
})

// --- the quick game ----------------------------------------------------------

test('the quick game is always a ring table', (t) => {
  // The promise on that card is that you can stand up whenever with the chips
  // in front of you, and a ring table is the only thing in the game that keeps
  // it. A turbo is fast, which is a different promise — it still has to be
  // finished — so anything from the ladder or the side tables turning up here
  // would make the card lie.
  const rail = new Set(RING_TABLES.map((v) => v.id))
  for (const roll of [200, 600, 5_000, 100_000, 5_000_000]) {
    const room = quickPlay(player(roll), DEVICE)
    t.truthy(room, `nothing offered at ${roll}`)
    if (room) {
      t.true(rail.has(room.id), `${room.id} is not a ring table`)
      t.true(room.cash === true, `${room.id} is not a cash game`)
    }
  }
})

test('the quick game is the dearest room the Roll covers', (t) => {
  // The rule Will hit within a minute of it shipping: offering Micro to a Roll
  // that plainly covers the room above it reads as broken, not as prudent. No
  // bankroll arithmetic here — `canAfford`, the same question the rest of the
  // app asks.
  for (const room of RING_TABLES) {
    t.is(quickPlay(player(room.buyIn), DEVICE)?.id, room.id, `at exactly ${room.buyIn}`)
    t.is(quickPlay(player(room.buyIn + 1), DEVICE)?.id, room.id, `just over ${room.buyIn}`)
  }
})

test('the quick game is absent rather than locked when the Rail is out of reach', (t) => {
  // A suggestion you cannot take is not a suggestion. The card renders nothing
  // and the hero takes the width back.
  const cheapest = Math.min(...RING_TABLES.map((v) => v.buyIn))
  t.is(quickPlay(player(cheapest - 1), DEVICE), null)
  t.is(quickPlay(player(0), DEVICE), null)
})

test('a bigger Roll never offers a smaller game', (t) => {
  let previous = -1
  for (let roll = 0; roll <= 300_000; roll += 137) {
    const room = quickPlay(player(roll), DEVICE)
    const buyIn = room?.buyIn ?? 0
    t.true(buyIn >= previous, `the offer went backwards at ${roll}`)
    previous = buyIn
  }
})

test('the quick game is one the player can actually sit at', (t) => {
  for (const roll of [200, 599, 600, 20_000, 1_000_000]) {
    const p = player(roll)
    const room = quickPlay(p, DEVICE)
    if (room) t.is(refuseSitDown(room, p, DEVICE, false), null, `${room.id} at ${roll}`)
    else t.pass()
  }
})

// --- the ladder pick ---------------------------------------------------------

test('the ladder pick is the lowest rung not yet won', (t) => {
  const p = player(VENUES[1].buyIn, { venueRecords: won('garage') })
  const pick = nextUp(p, DEVICE)
  t.is(pick.venue.id, VENUES[1].id)
  t.is(pick.rung, 2)
  t.falsy(pick.repeat)
})

test('wins out of order still advance the pick', (t) => {
  // Skipping a rung is a legitimate way up, so the pick is the lowest *unwon*
  // rung rather than one past the highest won.
  const p = player(50_000, { venueRecords: won('garage', 'poolhall') })
  t.is(nextUp(p, DEVICE).venue.id, VENUES[1].id)
})

test('a rung out of reach sends you back down to rebuild, and says so', (t) => {
  // Won the Garage, lost it all back to just over its buy-in: the next rung is
  // unaffordable, so the answer is the dearest rung the Roll does cover — which
  // is one already taken down.
  const p = player(VENUES[0].buyIn, { venueRecords: won('garage') })
  const pick = nextUp(p, DEVICE)
  t.is(pick.venue.id, VENUES[0].id)
  t.true(pick.repeat)
})

test('replaying a rung is the last resort, not the second', (t) => {
  // Cleared ladder, and a Roll too small for any challenge: nothing new is
  // left anywhere, so the dearest rung the Roll covers is the honest answer.
  const p = player(VENUES[1].buyIn, { venueRecords: won(...VENUES.map((v) => v.id)) })
  t.true(p.roll < Math.min(...CHALLENGE_TABLES.map((v) => v.buyIn)))
  const pick = nextUp(p, DEVICE)
  t.is(pick.kind, 'ladder')
  t.is(pick.venue.id, VENUES[1].id)
  t.true(pick.repeat)
})

// --- the invariants ----------------------------------------------------------

test('it always answers, at every Roll', (t) => {
  // There is no empty state on the lobby, so there must be no Roll without an
  // answer. The freeroll opens exactly below the bottom rung, which is what
  // makes the last branch unmissable — if that stops being true, this fails
  // before a player meets a hero card with nothing on it.
  for (const roll of [0, 1, 99, 100, 499, 500, 7_999, 50_000, 10_000_000]) {
    const pick = nextUp(player(roll), DEVICE)
    t.truthy(pick.venue, `no answer at ${roll}`)
  }
})

test('every table it offers is one the player can actually sit at', (t) => {
  // The dead click `lib/sitDown` exists to prevent, one screen over: a hero
  // that recommends a table and a route that refuses it is worse than no hero.
  // Non-member throughout — nothing here may ever pick a member room.
  for (const roll of [0, 100, 500, 2_000, 8_000, 50_000, 500_000]) {
    for (const records of [{}, won('garage'), won('garage', 'pub', 'poolhall')]) {
      const p = player(roll, { venueRecords: records })
      const pick = nextUp(p, DEVICE)
      t.is(
        refuseSitDown(pick.venue, p, DEVICE, false),
        null,
        `${pick.venue.id} at ${roll} is offered and then refused`,
      )
    }
  }
})

// --- the strip ---------------------------------------------------------------

test('the strip counts wins, not what the Roll can afford', (t) => {
  // Affordability says what is open; winning says what has been done. A Roll
  // that covers every rung must still read 0 of 10 on a fresh profile, or the
  // strip congratulates a player for having money.
  const rich = ladderProgress({}, 10_000_000)
  t.is(rich.won, 0)
  t.is(rich.next?.rung, 1)
  t.true(rich.rungs.every((r) => r.affordable))
})

test('the strip credits wins wherever they fall', (t) => {
  const p = ladderProgress(won('garage', 'poolhall'), 5_000)
  t.is(p.won, 2)
  t.is(p.next?.venue.id, VENUES[1].id)
  t.deepEqual(
    p.rungs.filter((r) => r.won).map((r) => r.venue.id),
    ['garage', 'poolhall'],
  )
})

test('a cleared ladder has no next rung', (t) => {
  const p = ladderProgress(won(...VENUES.map((v) => v.id)), 1_000_000)
  t.is(p.won, VENUES.length)
  t.is(p.next, null)
})

test('the strip has one segment per rung, numbered from the bottom', (t) => {
  const { rungs } = ladderProgress({}, 0)
  t.is(rungs.length, VENUES.length)
  rungs.forEach((r, i) => {
    t.is(r.rung, i + 1)
    t.is(r.venue.id, VENUES[i].id)
  })
})

test('the hero and the strip agree about which rung is next', (t) => {
  // Two readings of one fact, which is the bug class `lib/sitDown` was written
  // to end. They are both derived here so they cannot drift, and this fails if
  // anybody splits them.
  const p = player(50_000, { venueRecords: won('garage', 'pub') })
  const pick = nextUp(p, DEVICE)
  const { next } = ladderProgress(p.venueRecords, p.roll)
  t.is(pick.kind, 'ladder', 'the fixture stopped exercising the ladder branch')
  if (!next) {
    t.fail('the fixture cleared the ladder, so there is nothing to agree about')
    return
  }
  t.is(pick.venue.id, next.venue.id)
  t.is(pick.rung, next.rung)
})
