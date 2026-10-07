// How long a player counts as new, and the name they are given. The lobby leads
// a new player in with three doors instead of eleven, and the sync merge never
// lets the given name overwrite a chosen one, so both rules are pinned here.

import test from 'ava'
import {
  DEFAULT_PLAYER_NAME,
  NEW_PLAYER_TOURNAMENTS,
  SAVE_NUDGE_HANDS,
  hasPlaceholderName,
  isNewPlayer,
  offersSaveMidRun,
  seatedVenue,
} from '../src/lib/newPlayer'

test('the given name is a placeholder; a chosen one is not', (t) => {
  t.true(hasPlaceholderName(DEFAULT_PLAYER_NAME))
  t.true(hasPlaceholderName(` ${DEFAULT_PLAYER_NAME} `))
  t.true(hasPlaceholderName(''), 'an empty name is what setName turns into the placeholder')
  t.false(hasPlaceholderName('Will'))
  t.false(hasPlaceholderName('Player One'))
})

test('a player is new until a few tournaments in', (t) => {
  t.true(isNewPlayer({ tournamentsEntered: 0, handsPlayed: 0 }))
  t.true(isNewPlayer({ tournamentsEntered: NEW_PLAYER_TOURNAMENTS - 1, handsPlayed: 40 }))
  t.false(isNewPlayer({ tournamentsEntered: NEW_PLAYER_TOURNAMENTS, handsPlayed: 40 }))
})

test('a cash-game regular is not new for never entering a tournament', (t) => {
  t.false(isNewPlayer({ tournamentsEntered: 0, handsPlayed: 500 }))
})

// --- the first Garage, and the save card ------------------------------------

const GARAGE = { id: 'garage', smallBlind: 1, bigBlind: 2, handsPerLevel: 12 }

test('a first Garage is the short one: 25 big blinds, blinds up every 5 hands', (t) => {
  t.deepEqual(seatedVenue(GARAGE, {}), { ...GARAGE, smallBlind: 2, bigBlind: 4, handsPerLevel: 5 })
  t.deepEqual(
    seatedVenue(GARAGE, { garage: { bestFinish: null } }),
    { ...GARAGE, smallBlind: 2, bigBlind: 4, handsPerLevel: 5 },
    'entered and left without finishing is still a first',
  )
})

test('after one finished Garage, and at every other table, nothing changes', (t) => {
  t.is(seatedVenue(GARAGE, { garage: { bestFinish: 3 } }), GARAGE)
  const pub = { id: 'pub', smallBlind: 3, bigBlind: 6 }
  t.is(seatedVenue(pub, {}), pub)
})

const nudge = (over: Partial<Parameters<typeof offersSaveMidRun>[0]> = {}) =>
  offersSaveMidRun({
    signedOut: true,
    dismissed: false,
    betweenHands: true,
    cash: false,
    tournamentsEntered: 1,
    handIndex: 1,
    chipsUp: 0,
    ...over,
  })

test('the save card shows once a newcomer is ahead, or a few hands in', (t) => {
  t.false(nudge(), 'one hand in and level')
  t.true(nudge({ chipsUp: 6 }), 'ahead')
  t.true(nudge({ handIndex: SAVE_NUDGE_HANDS }), 'a few hands in')
})

test('the save card never shows signed in, dismissed, mid-hand, at cash, or after the first tournaments', (t) => {
  const up = { chipsUp: 6 }
  t.false(nudge({ ...up, signedOut: false }))
  t.false(nudge({ ...up, dismissed: true }))
  t.false(nudge({ ...up, betweenHands: false }))
  t.false(nudge({ ...up, cash: true }))
  t.false(nudge({ ...up, tournamentsEntered: NEW_PLAYER_TOURNAMENTS + 1 }))
  t.true(nudge({ ...up, tournamentsEntered: NEW_PLAYER_TOURNAMENTS }))
})
