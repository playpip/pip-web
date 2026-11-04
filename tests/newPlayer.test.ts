// How long a player counts as new, and the name they are given. The lobby leads
// a new player in with three doors instead of eleven, and the sync merge never
// lets the given name overwrite a chosen one, so both rules are pinned here.

import test from 'ava'
import { DEFAULT_PLAYER_NAME, hasPlaceholderName } from '../src/lib/newPlayer'

test('the given name is a placeholder; a chosen one is not', (t) => {
  t.true(hasPlaceholderName(DEFAULT_PLAYER_NAME))
  t.true(hasPlaceholderName(` ${DEFAULT_PLAYER_NAME} `))
  t.true(hasPlaceholderName(''), 'an empty name is what setName turns into the placeholder')
  t.false(hasPlaceholderName('Will'))
  t.false(hasPlaceholderName('Player One'))
})

// The welcome flow fills one of these in. Each must fit the name box (16
// characters), must not be the placeholder, and must not be a regular's name.
test('every suggested name fits, is chosen, and is nobody in the cast', async (t) => {
  const { SUGGESTED_NAMES, suggestName } = await import('../src/lib/newPlayer')
  const { CAST } = await import('../src/config/cast')
  const cast = new Set(CAST.map((c) => c.name.toLowerCase()))
  t.true(SUGGESTED_NAMES.length > 50)
  for (const name of SUGGESTED_NAMES) {
    t.true(name.length <= 16, `${name} is longer than the name box`)
    t.false(hasPlaceholderName(name))
    t.false(cast.has(name.toLowerCase()), `${name} is a regular`)
  }
  t.is(
    suggestName(() => 0),
    SUGGESTED_NAMES[0],
  )
  t.is(
    suggestName(() => 0.999999),
    SUGGESTED_NAMES[SUGGESTED_NAMES.length - 1],
  )
})
