// How long a player counts as new, and the name they are given. The lobby leads
// a new player in with three doors instead of eleven, and the sync merge never
// lets the given name overwrite a chosen one, so both rules are pinned here.

import test from 'ava'
import {
  DEFAULT_PLAYER_NAME,
  NEW_PLAYER_TOURNAMENTS,
  hasPlaceholderName,
  isNewPlayer,
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
