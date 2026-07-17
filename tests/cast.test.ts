import test from 'ava'
import { CAST, bandFor, rosterFor, draftCast, profileFor, characterById } from '@/config/cast'
import { VENUES, SIDE_TABLES, KITCHEN_TABLE } from '@/config/venues'
import { mulberry32 } from '@/lib/poker/cards'

const ALL_VENUES = [...VENUES, ...SIDE_TABLES, KITCHEN_TABLE]

test('character ids are unique and every character has lines', (t) => {
  t.is(new Set(CAST.map((ch) => ch.id)).size, CAST.length)
  for (const ch of CAST) {
    t.true(ch.lines.seat.length > 0, `${ch.id} has no seat lines`)
    t.true(ch.lines.win.length > 0, `${ch.id} has no win lines`)
    t.true(ch.lines.bust.length > 0, `${ch.id} has no bust lines`)
    t.truthy(ch.bio)
  }
})

test('every venue can seat a full table from its own roster', (t) => {
  for (const venue of ALL_VENUES) {
    const roster = rosterFor(venue)
    t.true(
      roster.length >= venue.seats - 1,
      `${venue.id} needs ${venue.seats - 1} AI, roster has ${roster.length}`,
    )
  }
})

test('pinned characters own their venues', (t) => {
  t.deepEqual(
    rosterFor(KITCHEN_TABLE).map((ch) => ch.id),
    ['ray'],
  )
  const vault = SIDE_TABLES.find((v) => v.id === 'vault')!
  t.deepEqual(
    rosterFor(vault).map((ch) => ch.id),
    ['sable'],
  )
  // ...and never wander onto other tables.
  for (const venue of ALL_VENUES.filter((v) => v.id !== 'kitchen' && v.id !== 'vault')) {
    const ids = new Set(rosterFor(venue).map((ch) => ch.id))
    t.false(ids.has('ray'), `ray in ${venue.id}`)
    t.false(ids.has('sable'), `sable in ${venue.id}`)
  }
})

test('bands follow buy-in', (t) => {
  t.is(bandFor(VENUES[0]), 'low') // garage
  t.is(bandFor(VENUES.find((v) => v.id === 'casino')!), 'mid')
  t.is(bandFor(VENUES.find((v) => v.id === 'mainevent')!), 'high')
})

test('draftCast draws distinct characters and is reproducible with a seed', (t) => {
  const venue = VENUES.find((v) => v.id === 'cardroom')!
  const a = draftCast(venue, 5, mulberry32(42))
  const b = draftCast(venue, 5, mulberry32(42))
  t.deepEqual(
    a.map((ch) => ch.id),
    b.map((ch) => ch.id),
  )
  t.is(new Set(a.map((ch) => ch.id)).size, 5)
})

test('draftCast tops up from the wider cast when a roster runs short', (t) => {
  const venue = VENUES[0] // garage: low roster
  const picked = draftCast(venue, 12, mulberry32(1))
  t.is(picked.length, 12)
  t.is(new Set(picked.map((ch) => ch.id)).size, 12)
})

test('profileFor nudges personality but never skill, and clamps to [0,1]', (t) => {
  const venue = VENUES.find((v) => v.id === 'garage')! // tightness 0.15
  const marge = characterById('marge')! // tightness +0.12
  const doris = characterById('doris')! // tightness -0.1
  t.true(profileFor(venue, marge).tightness > venue.ai.tightness)
  t.true(profileFor(venue, doris).tightness >= 0)
  t.is(profileFor(venue, marge).skill, venue.ai.skill)
  t.is(profileFor(venue, marge).iterations, venue.ai.iterations)
  // A big negative delta can't push below zero.
  t.true(profileFor(venue, doris).tightness === Math.max(0, venue.ai.tightness - 0.1))
})
