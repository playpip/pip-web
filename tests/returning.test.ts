import { readFileSync } from 'node:fs'
import test from 'ava'
import { VENUES } from '@/config/venues'
import {
  act,
  createRoom,
  join,
  start,
  tick,
  type Result,
  type RoomState,
} from '@/lib/multiplayer/room'
import { viewFor } from '@/lib/multiplayer/view'
import { mulberry32 } from '@/lib/poker/cards'
import { roomHandToCount, weekIndex, weekVisit } from '@/lib/returning'

const at = (iso: string) => Date.parse(iso)

test('weeks run Monday to Sunday, UTC', (t) => {
  // Monday 2 November 2026 to Sunday 8 November 2026 is one week.
  const monday = weekIndex(at('2026-11-02T00:00:00Z'))
  t.is(weekIndex(at('2026-11-08T23:59:59Z')), monday)
  t.is(weekIndex(at('2026-11-01T23:59:59Z')), monday - 1)
  t.is(weekIndex(at('2026-11-09T00:00:00Z')), monday + 1)
  // The epoch was a Thursday, in the same week as Monday 29 December 1969.
  t.is(weekIndex(at('1969-12-29T00:00:00Z')), 0)
  t.is(weekIndex(0), 0)
  t.is(weekIndex(at('1970-01-05T00:00:00Z')), 1)
})

test('a first ever hand counts the week and nothing else', (t) => {
  t.deepEqual(weekVisit(null, 100), { firstThisWeek: true, again: false, keep: 100 })
})

test('a second hand in the same week counts nothing', (t) => {
  t.deepEqual(weekVisit(100, 100), { firstThisWeek: false, again: false, keep: 100 })
})

test('playing the week after counts a return', (t) => {
  t.deepEqual(weekVisit(99, 100), { firstThisWeek: true, again: true, keep: 100 })
})

test('a gap of a week or more is a new week, not a return', (t) => {
  t.deepEqual(weekVisit(98, 100), { firstThisWeek: true, again: false, keep: 100 })
  t.deepEqual(weekVisit(3, 100), { firstThisWeek: true, again: false, keep: 100 })
})

test('a clock set back sends nothing and keeps the later week', (t) => {
  t.deepEqual(weekVisit(101, 100), { firstThisWeek: false, again: false, keep: 101 })
})

// --- a hand in a room counts too ---------------------------------------------
//
// Rooms, quick match and slow games deal on the server, so the ladder's count
// in store/game never sees them. Slow-game turn pushes are there to bring
// people back, and a player who only comes back for their slow game has to
// count as coming back.

const must = (r: Result): RoomState => {
  if (!r.ok) throw new Error(r.error)
  return r.state
}
const person = (n: number) => ({
  userId: `user-${n}`,
  name: `P${n}`,
  avatar: { seed: `s${n}`, backgroundColor: 'b6e3f4' },
  ring: null,
})
const table = (code: string, seed: number) => {
  const s = must(
    join(
      createRoom({ code, kind: 'private', venue: VENUES[1], host: person(0), now: 0 }),
      person(1),
      0,
    ),
  )
  return must(start(s, 'user-0', 0, mulberry32(seed)))
}
/** Fold the hand away, then let the pause run out until the next is dealt. */
const nextHand = (s: RoomState): RoomState => {
  const id = s.hand!.players[s.hand!.toActIndex].id
  const userId = s.players.find((p) => p.id === id)!.userId!
  let state = must(act(s, userId, { type: 'fold' }, 0))
  for (let i = 0; i < 10 && state.handIndex === s.handIndex && state.dueAt !== null; i++) {
    state = tick(state, state.dueAt, mulberry32(i))
  }
  return state
}

test('the first view of a room you are dealt into counts: a slow game opened on your turn', (t) => {
  t.true(roomHandToCount(null, viewFor(table('AAAAAA', 1), 'user-0')))
})

test('more views of the same hand count nothing more', (t) => {
  const s = table('AAAAAA', 2)
  const mover = s.players.find((p) => p.id === s.hand!.players[s.hand!.toActIndex].id)!.userId!
  const after = must(act(s, mover, { type: 'call' }, 0))
  t.is(after.handIndex, s.handIndex)
  t.false(roomHandToCount(viewFor(s, 'user-0'), viewFor(after, 'user-0')))
})

test('a new hand, or a new table, counts', (t) => {
  const s = table('AAAAAA', 3)
  t.is(nextHand(s).handIndex, s.handIndex + 1)
  t.true(roomHandToCount(viewFor(s, 'user-0'), viewFor(nextHand(s), 'user-0')))
  t.true(roomHandToCount(viewFor(s, 'user-0'), viewFor(table('BBBBBB', 3), 'user-0')))
})

test('somebody not dealt in counts nothing', (t) => {
  const s = table('AAAAAA', 4)
  const watcher = viewFor(s, 'user-9')
  t.is(watcher.you, null)
  t.false(roomHandToCount(null, watcher))
  // Seated, but between hands: nothing dealt yet.
  t.false(roomHandToCount(null, { ...viewFor(s, 'user-0'), hand: null }))
})

test('the room store counts what arrives', (t) => {
  const store = readFileSync(new URL('../src/store/room.ts', import.meta.url), 'utf-8')
  t.regex(store, /if \(roomHandToCount\(prev, view\)\) \{\s*notePlayedThisWeek\(\)/)
})
