import test from 'ava'
import { addRoomOpened, roomsOpenedKey } from '../src/lib/multiplayer/roomsOpened'

test('a week is named by its Monday, UTC', (t) => {
  // Wednesday 2026-11-18 and Sunday 2026-11-22 are the same week.
  t.is(roomsOpenedKey(Date.parse('2026-11-18T12:00:00Z')), 'rooms:2026-11-16')
  t.is(roomsOpenedKey(Date.parse('2026-11-22T23:59:59Z')), 'rooms:2026-11-16')
  t.is(roomsOpenedKey(Date.parse('2026-11-23T00:00:00Z')), 'rooms:2026-11-23')
})

test('a room counts once, under member or free', (t) => {
  t.deepEqual(addRoomOpened(undefined, false), { member: 0, free: 1 })
  t.deepEqual(addRoomOpened(undefined, true), { member: 1, free: 0 })
  t.deepEqual(addRoomOpened({ member: 2, free: 5 }, true), { member: 3, free: 5 })
})
