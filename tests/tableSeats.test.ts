import test from 'ava'
import { CUSTOM_SEATS } from '@/config/customTable'
import {
  FELT_COMPACT,
  FELT_COMPACT_FULL,
  FELT_COMPACT_FULL_SHORT,
  FELT_WIDE,
  FELT_WIDE_FULL,
  feltFor,
  feltSeatPositions,
} from '@/lib/tableSeats'

// Where the live table puts its opponents. The layout itself is checked by
// eye (the UI is not unit-tested); what is pinned here is which felt a table
// gets, so a table that shipped before full rings existed draws exactly as it
// did.

const num = (p: string) => Number.parseFloat(p)

test('a desktop keeps the wide felt up to five opponents, and spaces a full ring along the rail', (t) => {
  for (let n = 1; n <= 5; n++) t.is(feltFor(false, n), FELT_WIDE)
  for (const n of [6, 7]) t.is(feltFor(false, n), FELT_WIDE_FULL)
})

test('a phone keeps the compact felt up to five opponents, tall or short', (t) => {
  for (let n = 1; n <= 5; n++) {
    t.is(feltFor(true, n), FELT_COMPACT)
    t.is(feltFor(true, n, true), FELT_COMPACT)
  }
})

test('six and seven opponents on a phone get the full-ring felt for its shape', (t) => {
  for (const n of [6, 7]) {
    t.is(feltFor(true, n, true), FELT_COMPACT_FULL)
    t.is(feltFor(true, n, false), FELT_COMPACT_FULL_SHORT)
  }
})

test('spacing along the rail keeps the arc’s ends and puts the seats in order', (t) => {
  for (const g of [FELT_WIDE_FULL, FELT_COMPACT_FULL]) {
    const even = feltSeatPositions(7, g)
    const byAngle = feltSeatPositions(7, { ...g, railAspect: undefined })
    t.deepEqual(even[0], byAngle[0])
    t.deepEqual(even[6], byAngle[6])
    for (let k = 1; k < 7; k++) t.true(num(even[k].left) > num(even[k - 1].left))
  }
})

test('the largest table anyone can build has a felt that seats it', (t) => {
  t.true(Math.max(...CUSTOM_SEATS) - 1 <= 7)
})

test('a full ring stays on the stage and mirrors itself', (t) => {
  for (const [n, g] of [6, 7].flatMap((n) =>
    [FELT_COMPACT_FULL, FELT_COMPACT_FULL_SHORT].map((g) => [n, g] as const),
  )) {
    const seats = feltSeatPositions(n, g)
    for (const s of seats) {
      t.true(num(s.left) > 0 && num(s.left) < 100, `${n}: ${s.left} is off the stage`)
      t.true(num(s.top) > 0 && num(s.top) < num(g.board.top))
    }
    for (let k = 0; k < n; k++) {
      const a = seats[k]
      const b = seats[n - 1 - k]
      t.true(Math.abs(num(a.left) + num(b.left) - 100) < 0.05, `${n}: seat ${k} is not mirrored`)
      t.true(Math.abs(num(a.top) - num(b.top)) < 0.05)
    }
  }
})
