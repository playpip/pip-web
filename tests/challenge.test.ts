// The challenger rules. Everything that decides who is waiting and at what
// stakes lives in pure functions precisely so it can be tested here: there is
// no store test infrastructure in this repo, and nothing in a runner can look
// at the card these functions feed.

import test from 'ava'
import {
  affordableBand,
  challengeable,
  challengeTableFor,
  currentChallenge,
  playerBand,
  selectChallenger,
} from '@/lib/challenge'
import { CAST, bandFor, type CastBand } from '@/config/cast'
import { CHALLENGE_TABLES, VENUES } from '@/config/venues'
import type { VenueRecord } from '@/store/profile'

const BANDS: readonly CastBand[] = ['low', 'mid', 'high']

const won = (...venueIds: string[]): Record<string, VenueRecord> =>
  Object.fromEntries(
    venueIds.map((id) => [id, { entered: 1, won: 1, bestFinish: 1, fastestWinHands: 20 }]),
  )

const entered = (...venueIds: string[]): Record<string, VenueRecord> =>
  Object.fromEntries(
    venueIds.map((id) => [id, { entered: 3, won: 0, bestFinish: 2, fastestWinHands: null }]),
  )

// --- the tables ------------------------------------------------------------

test('there is exactly one challenge table per band, and it is a duel', (t) => {
  t.is(CHALLENGE_TABLES.length, BANDS.length)
  for (const band of BANDS) {
    const table = challengeTableFor(band)
    t.is(table.seats, 2)
    t.is(table.format, 'duel')
  }
})

test("a challenge table's buy-in puts it in its own band", (t) => {
  // `bandFor` reads the buy-in, so a table priced into the wrong bracket would
  // silently draft the wrong roster the moment anything called it on one.
  for (const band of BANDS) t.is(bandFor(challengeTableFor(band)), band)
})

test('a challenge pays about 2.5x the buy-in, and more than a ladder duel', (t) => {
  for (const table of CHALLENGE_TABLES) {
    const multiple = table.prize / table.buyIn
    t.true(multiple >= 2.4 && multiple <= 2.6, `${table.id} pays ${multiple}x`)
    t.true(multiple > 2, `${table.id} must beat the 2x a ladder duel pays`)
  }
})

test('challenge buy-ins sit between the ladder rungs, not on them', (t) => {
  // On a rung, a table paying 2.5x would leave that rung with no reason to exist.
  const ladder = new Set(VENUES.map((v) => v.buyIn))
  for (const table of CHALLENGE_TABLES) t.false(ladder.has(table.buyIn))
})

// --- who can be challenged -------------------------------------------------

test('pinned characters are never challengeable', (t) => {
  const pinned = CAST.filter((ch) => ch.only).map((ch) => ch.id)
  t.true(pinned.length > 0)
  const everyone = BANDS.flatMap((b) => challengeable(b).map((ch) => ch.id))
  for (const id of pinned) t.false(everyone.includes(id), `${id} is pinned to a venue`)
})

test('every band has a pool to draw from', (t) => {
  for (const band of BANDS) t.true(challengeable(band).length >= 5)
})

test('the collection is 22, not the whole cast of 25', (t) => {
  // Three characters are pinned to a venue. The scalp shelf has to be sized to
  // what is actually winnable or it can never be completed.
  const collectible = new Set(BANDS.flatMap((b) => challengeable(b).map((ch) => ch.id)))
  t.is(CAST.length, 25)
  t.is(collectible.size, 22)
})

// --- the band --------------------------------------------------------------

test('a player who has won nothing is in the low band', (t) => {
  t.is(playerBand({}), 'low')
  t.is(playerBand(entered('garage', 'cardroom', 'penthouse')), 'low')
})

test('the band comes from the highest ladder venue actually won', (t) => {
  t.is(playerBand(won('garage')), 'low')
  t.is(playerBand(won('poolhall')), 'low')
  t.is(playerBand(won('cardroom')), 'mid')
  t.is(playerBand(won('penthouse')), 'high')
  t.is(playerBand(won('garage', 'penthouse')), 'high')
})

test('losing a high venue after winning it does not demote you', (t) => {
  t.is(playerBand({ ...won('penthouse'), ...entered('mainevent') }), 'high')
})

// --- affordability ---------------------------------------------------------

test('the band steps down until the buy-in fits the Roll', (t) => {
  const high = challengeTableFor('high').buyIn
  const mid = challengeTableFor('mid').buyIn
  t.is(affordableBand('high', high), 'high')
  t.is(affordableBand('high', high - 1), 'mid')
  t.is(affordableBand('high', mid - 1), 'low')
})

test('a Roll below the lowest buy-in has no challenge at all', (t) => {
  const low = challengeTableFor('low').buyIn
  t.is(affordableBand('low', low - 1), null)
  t.is(
    currentChallenge({ roll: 0, venueRecords: {}, challengeWins: [], challengesPlayed: 0 }),
    null,
  )
})

test('a band is never stepped up, only down', (t) => {
  t.is(affordableBand('low', 1_000_000), 'low')
})

// --- selection -------------------------------------------------------------

test('the challenger always comes from the requested band', (t) => {
  for (const band of BANDS) {
    const ids = new Set(challengeable(band).map((ch) => ch.id))
    for (let played = 0; played < 40; played++) {
      t.true(ids.has(selectChallenger(band, [], played).id))
    }
  }
})

test('unbeaten characters come up before anyone is repeated', (t) => {
  const pool = challengeable('low')
  const wins = pool.slice(0, pool.length - 1).map((ch) => ch.id)
  // One left unbeaten: they are the only person who can be next, whatever the
  // rotation counter says.
  const last = pool[pool.length - 1]
  for (let played = 0; played < 10; played++) {
    t.is(selectChallenger('low', wins, played).id, last.id)
  }
})

test('losing rotates the challenger, so nobody is a wall', (t) => {
  // Play and lose, repeatedly: `challengesPlayed` climbs, `challengeWins` does
  // not, and a different face turns up each time.
  const first = selectChallenger('low', [], 0)
  const second = selectChallenger('low', [], 1)
  t.not(first.id, second.id)

  const seen = new Set<string>()
  const pool = challengeable('low')
  for (let played = 0; played < pool.length; played++) {
    seen.add(selectChallenger('low', [], played).id)
  }
  t.is(seen.size, pool.length, 'losing every time still shows the whole band')
})

test('winning takes that character out of the queue', (t) => {
  const first = selectChallenger('low', [], 0)
  const next = selectChallenger('low', [first.id], 1)
  t.not(next.id, first.id)
})

test('a cleared band falls back to rematches over the same pool', (t) => {
  const pool = challengeable('high')
  const wins = pool.map((ch) => ch.id)
  for (let played = 0; played < 20; played++) {
    const pick = selectChallenger('high', wins, played)
    t.true(wins.includes(pick.id))
  }
})

test('clearing a band never hands you the same face straight back', (t) => {
  const pool = challengeable('high')
  const wins = pool.map((ch) => ch.id)
  const justBeaten = wins[wins.length - 1]
  for (let played = 0; played < 20; played++) {
    t.not(selectChallenger('high', wins, played).id, justBeaten)
  }
})

// --- the whole thing -------------------------------------------------------

test('two devices with the same state derive the same challenger', (t) => {
  // The reason nothing stores the current challenger: this property is what
  // replaces reconciling a pending-challenge object across devices.
  const state = {
    roll: 60_000,
    venueRecords: won('garage', 'cardroom', 'penthouse'),
    challengeWins: ['laurent', 'webb'],
    challengesPlayed: 7,
  }
  const phone = currentChallenge(state)
  const laptop = currentChallenge({ ...state, venueRecords: { ...state.venueRecords } })
  t.truthy(phone)
  t.is(phone?.character.id, laptop?.character.id)
  t.is(phone?.venue.id, laptop?.venue.id)
})

test('the challenge is pitched at the demonstrated band when it is affordable', (t) => {
  const challenge = currentChallenge({
    roll: 60_000,
    venueRecords: won('penthouse'),
    challengeWins: [],
    challengesPlayed: 0,
  })
  t.is(challenge?.band, 'high')
  t.is(challenge?.venue.id, 'challenge-high')
  t.true(challenge?.character.bands.includes('high'))
})

test('a busted high-band player gets a challenge they can actually sit at', (t) => {
  const challenge = currentChallenge({
    roll: 900,
    venueRecords: won('penthouse'),
    challengeWins: [],
    challengesPlayed: 0,
  })
  t.is(challenge?.band, 'low')
  t.true((challenge?.venue.buyIn ?? Number.POSITIVE_INFINITY) <= 900)
})

test('the rematch flag says whether this face is already on the shelf', (t) => {
  const first = selectChallenger('low', [], 0)
  const fresh = currentChallenge({
    roll: 5_000,
    venueRecords: {},
    challengeWins: [],
    challengesPlayed: 0,
  })
  t.is(fresh?.character.id, first.id)
  t.false(fresh?.rematch)

  const pool = challengeable('low')
  const cleared = currentChallenge({
    roll: 5_000,
    venueRecords: {},
    challengeWins: pool.map((ch) => ch.id),
    challengesPlayed: pool.length,
  })
  t.true(cleared?.rematch)
})
