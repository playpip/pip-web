import test from 'ava'
import { draftCast } from '@/config/cast'
import {
  ALL_VENUES,
  RAIL_SEATS,
  RING_TABLES,
  THE_DAILY,
  playPath,
  seatChoices,
  withSeats,
} from '@/config/venues'
import { CUSTOM_SEATS } from '@/config/customTable'
import { mulberry32 } from '@/lib/poker/cards'

// The Rail lets a player pick the table size. Cash is the only place that is
// safe — there is no prize priced on the count — so most of what is pinned here
// is what the choice must not reach.

test('a Rail room takes any size on offer', (t) => {
  for (const room of RING_TABLES) {
    for (const n of RAIL_SEATS) t.is(withSeats(room, n).seats, n)
  }
})

test('a size that is not on offer leaves the room as it is', (t) => {
  const room = RING_TABLES[0]
  for (const n of [0, 1, 9, 40, 2.5, Number.NaN]) t.is(withSeats(room, n), room)
  t.is(withSeats(room, null), room)
})

test('no table with a prize can be re-sized to any size the Rail offers', (t) => {
  // The top of the ladder is the one exception, and only upwards, with its
  // prize following the count (tests/ladderSeats.test.ts).
  for (const venue of ALL_VENUES.filter((v) => !v.cash && !seatChoices(v))) {
    t.is(withSeats(venue, 8), venue, `${venue.id} took a new size`)
  }
  t.is(withSeats(THE_DAILY, 8).seats, THE_DAILY.seats)
})

test('the Rail goes no further than the felt does', (t) => {
  t.deepEqual([...RAIL_SEATS], [...CUSTOM_SEATS])
})

test('only a changed size reaches the route', (t) => {
  const room = RING_TABLES[0]
  t.is(playPath(room), `/play/${room.id}`)
  t.is(playPath(withSeats(room, room.seats)), `/play/${room.id}`)
  t.is(playPath(withSeats(room, 8)), `/play/${room.id}?seats=8`)
  t.is(playPath(THE_DAILY), `/play/${THE_DAILY.id}`)
})

test('every Rail room seats a full eight with seven different faces', (t) => {
  for (const room of RING_TABLES) {
    const full = withSeats(room, 8)
    for (let seed = 1; seed <= 5; seed++) {
      const drawn = draftCast(full, full.seats - 1, mulberry32(seed))
      t.is(drawn.length, 7, room.id)
      t.is(new Set(drawn.map((ch) => ch.id)).size, 7, `${room.id}: a face drawn twice`)
      t.true(
        drawn.every((ch) => !ch.only),
        `${room.id}: a pinned character left their table`,
      )
    }
  }
})
