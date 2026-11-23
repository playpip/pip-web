import test from 'ava'
import { VENUES } from '@/config/venues'
import { mulberry32 } from '@/lib/poker/cards'
import {
  addBots,
  block,
  createRoom,
  IDLE_EXPIRE_MS,
  join,
  kick,
  mediaAllowed,
  start,
  type Joiner,
  type Result,
  type RoomState,
} from '@/lib/multiplayer/room'
import {
  OPEN_TABLES_SHOWN,
  type OpenTableEntry,
  openTableOf,
  openTablesFor,
} from '@/lib/multiplayer/openTables'
import { viewFor } from '@/lib/multiplayer/view'

const pub = VENUES[1]
const person = (n: number): Joiner => ({
  userId: `user-${n}`,
  name: `Player ${n}`,
  avatar: { seed: `s${n}`, backgroundColor: 'b6e3f4' },
  ring: null,
})
const must = (r: Result): RoomState => {
  if (!r.ok) throw new Error(r.error)
  return r.state
}
const open = (kind: 'private' | 'slow' = 'private', code = 'OPEN01') =>
  createRoom({ code, kind, venue: pub, host: person(0), listed: true, now: 0 })

const entry = (over: Partial<OpenTableEntry>): OpenTableEntry => ({
  code: 'AAAAAA',
  kind: 'private',
  venueId: pub.id,
  buyIn: pub.buyIn,
  forRoll: true,
  people: 1,
  bots: 0,
  maxSeats: 6,
  host: { name: 'Host', avatar: { seed: 'h', backgroundColor: 'b6e3f4' }, ring: null },
  openedAt: 0,
  hostUserId: 'host',
  shut: [],
  ...over,
})

test('an open table has no camera or voice, whoever hosts it', (t) => {
  const s = open()
  t.true(s.listed)
  t.false(mediaAllowed(s))
  t.false(viewFor(s, 'user-0').media)
  t.true(viewFor(s, 'user-0').listed)
  // The same room opened for friends keeps them.
  const friends = createRoom({
    code: 'FRND01',
    kind: 'private',
    venue: pub,
    host: person(0),
    now: 0,
  })
  t.true(mediaAllowed(friends))
  t.false(viewFor(friends, 'user-0').listed)
})

test('quick match is never listed', (t) => {
  const s = createRoom({ code: 'QUICK1', kind: 'quick', venue: pub, listed: true, now: 0 })
  t.is(s.listed, undefined)
  t.is(openTableOf(s), null)
})

test('a listed room is on the list with its host, people and regulars', (t) => {
  let s = open()
  s = must(join(s, person(1), 0))
  s = must(addBots(s, 'user-0', 1, mulberry32(1)))
  const e = openTableOf(s)!
  t.is(e.code, 'OPEN01')
  t.is(e.host.name, 'Player 0')
  t.is(e.hostUserId, 'user-0')
  t.is(e.people, 2)
  t.is(e.bots, 1)
  t.is(e.maxSeats, s.maxSeats)
  t.true(e.forRoll)
})

test('a room for friends, a full one and a dealt one are not on the list', (t) => {
  t.is(
    openTableOf(
      createRoom({ code: 'FRND01', kind: 'private', venue: pub, host: person(0), now: 0 }),
    ),
    null,
  )
  let s = open()
  s = must(addBots(s, 'user-0', s.maxSeats - 1, mulberry32(2)))
  t.is(openTableOf(s), null, 'full')
  s = open()
  s = must(join(s, person(1), 0))
  s = must(start(s, 'user-0', 0, mulberry32(3)))
  t.is(openTableOf(s), null, 'dealt')
})

test('a slow game is listed with its move clock', (t) => {
  const e = openTableOf(open('slow'))!
  t.is(e.kind, 'slow')
  t.truthy(e.moveHours)
})

test('nobody the host removed or blocked is shown the table', (t) => {
  let s = open()
  s = must(join(s, person(1), 0))
  s = must(join(s, person(2), 0))
  const p1 = s.players.find((p) => p.userId === 'user-1')!.id
  const p2 = s.players.find((p) => p.userId === 'user-2')!.id
  s = must(kick(s, 'user-0', p1, 0))
  s = must(block(s, 'user-0', p2))
  const e = { ...openTableOf(s)!, openedAt: 0 }
  t.deepEqual(openTablesFor([e], 'user-1', 0), [])
  t.deepEqual(openTablesFor([e], 'user-2', 0), [])
  t.is(openTablesFor([e], 'user-3', 0).length, 1)
})

test('the list puts live tables first, then the busiest, then the newest', (t) => {
  const list = openTablesFor(
    [
      entry({ code: 'SLOW01', kind: 'slow', people: 3, openedAt: 5 }),
      entry({ code: 'LIVE01', people: 1, openedAt: 1 }),
      entry({ code: 'LIVE02', people: 2, openedAt: 0 }),
      entry({ code: 'LIVE03', people: 1, openedAt: 2 }),
    ],
    'viewer',
    10,
  )
  t.deepEqual(
    list.map((x) => x.code),
    ['LIVE02', 'LIVE03', 'LIVE01', 'SLOW01'],
  )
})

test('the list never sends account ids, and marks your own table', (t) => {
  const [mine] = openTablesFor([entry({ hostUserId: 'me', shut: ['x'] })], 'me', 0)
  t.true(mine.yours)
  t.false('hostUserId' in mine)
  t.false('shut' in mine)
  const [theirs] = openTablesFor([entry({})], 'me', 0)
  t.false(theirs.yours)
})

test('a table past its idle clock ages off, and the list is capped', (t) => {
  t.deepEqual(openTablesFor([entry({ openedAt: 0 })], 'v', IDLE_EXPIRE_MS + 1), [])
  t.is(openTablesFor([entry({ kind: 'slow', openedAt: 0 })], 'v', IDLE_EXPIRE_MS + 1).length, 1)
  const many = Array.from({ length: OPEN_TABLES_SHOWN + 5 }, (_, i) =>
    entry({ code: `T${String(i).padStart(5, '0')}` }),
  )
  t.is(openTablesFor(many, 'v', 0).length, OPEN_TABLES_SHOWN)
})
