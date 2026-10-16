// The cast harness (`pnpm persona-stats`). Its exact properties are asserted
// here: every regular gets a seat in turn, a run is reproducible and splits by
// block, and the separation test says "same" for a seat against itself and
// "different" for rates that plainly are. Whether any two characters actually
// play alike is the harness's output, and a few hundred hands cannot say.

import test from 'ava'
import {
  blockSeats,
  CONTROL,
  lookalikes,
  participantsFor,
  runPersonas,
  separatingStats,
  zOf,
} from '../scripts/persona-stats'
import { emptySeatStats } from '../scripts/table-stats'
import { rosterFor } from '@/config/cast'
import { venueById, type Venue } from '@/config/venues'

const garage = venueById('garage') as Venue

test('the field is the roster plus a control seat on the venue profile', (t) => {
  const field = participantsFor(garage)
  t.is(field[0].id, CONTROL)
  t.is(field[0].profile.tightness, garage.ai.tightness)
  t.deepEqual(
    field.slice(1).map((p) => p.id),
    rosterFor(garage).map((ch) => ch.id),
  )
})

test('seats rotate so every participant sits equally often', (t) => {
  const field = participantsFor(garage)
  const count = new Map<string, number>()
  // Over as many blocks as there are participants, each sits six times.
  for (let b = 0; b < field.length; b++) {
    const seated = blockSeats(field, b, 1)
    t.is(new Set(seated.map((p) => p.id)).size, seated.length, 'nobody sits twice')
    for (const p of seated) count.set(p.id, (count.get(p.id) ?? 0) + 1)
  }
  t.deepEqual(new Set(count.values()), new Set([6]))
})

test('a run is reproducible and splits by block', (t) => {
  const field = participantsFor(garage).map((p) => ({
    ...p,
    profile: { ...p.profile, iterations: 30 },
  }))
  const whole = runPersonas(garage, 3, 0, 2, field)
  t.deepEqual(runPersonas(garage, 3, 0, 2, field), whole)
  const first = runPersonas(garage, 3, 0, 1, field)
  const second = runPersonas(garage, 3, 1, 2, field)
  for (const id of Object.keys(whole)) {
    t.is(first[id].hands + second[id].hands, whole[id].hands)
    t.is(first[id].stat.vpip.hits + second[id].stat.vpip.hits, whole[id].stat.vpip.hits)
  }
})

test('the separation test: a seat matches itself, and plainly different rates separate', (t) => {
  const a = emptySeatStats()
  a.stat.vpip = { hits: 300, chances: 1000 }
  const b = emptySeatStats()
  b.stat.vpip = { hits: 200, chances: 1000 }
  t.is(zOf(a.stat.vpip, a.stat.vpip), 0)
  t.deepEqual(separatingStats(a, a), [])
  t.deepEqual(separatingStats(a, b), ['vpip'])
  t.true(zOf(a.stat.vpip, b.stat.vpip) > 5)
  t.is(zOf(a.stat.pfr, b.stat.pfr), 0, 'no chances, no evidence')
  t.deepEqual(lookalikes({ a, b, c: a }), [['a', 'c']])
})
