import test from 'ava'
import { DEFAULT_PREFS, parsePrefs, type PlayPrefs } from '@/lib/multiplayer/notices'
import {
  FRIEND_TABLE_GAP_MS,
  TABLE_GAP_MS,
  readTableNews,
  tablePush,
  tablePushAllowed,
} from '@/lib/multiplayer/nudges'
import { ANNOUNCE_MAX, tableAudience } from '@/lib/multiplayer/openTables'

const H = 60 * 60 * 1000
// Noon in London: awake.
const noon = Date.parse('2026-11-23T12:00:00Z')
const london: PlayPrefs = { ...DEFAULT_PREFS, tz: 'Europe/London' }
const never = { friend: null, any: null }
const news = {
  code: 'ABCDEF',
  name: 'Sam',
  venueId: 'pub',
  buyIn: 300,
  forRoll: true,
  slow: false,
  seated: 1,
  maxSeats: 4,
  friend: false,
}

test('open tables pushes are off until switched on; old pages leave them off', (t) => {
  t.false(DEFAULT_PREFS.tables)
  const old = { tz: 'UTC', quietFrom: 0, quietTo: 0, push: true, email: false }
  t.like(parsePrefs(old), { tables: false, friends: true })
  t.like(parsePrefs({ ...old, tables: true }), { tables: true })
})

test("a friend's table comes under Friends, at most one an hour", (t) => {
  const friend = { friend: true }
  t.true(tablePushAllowed(friend, london, never, noon))
  t.false(tablePushAllowed(friend, london, { friend: noon - H / 2, any: null }, noon))
  t.true(tablePushAllowed(friend, london, { friend: noon - FRIEND_TABLE_GAP_MS, any: null }, noon))
  t.false(tablePushAllowed(friend, { ...london, friends: false }, never, noon))
  // Friends off, Open tables on: it is told as anybody's.
  t.true(tablePushAllowed(friend, { ...london, friends: false, tables: true }, never, noon))
})

test("anybody's table needs Open tables, at most one every three hours", (t) => {
  const stranger = { friend: false }
  t.false(tablePushAllowed(stranger, london, never, noon))
  const on = { ...london, tables: true }
  t.true(tablePushAllowed(stranger, on, never, noon))
  t.false(tablePushAllowed(stranger, on, { friend: null, any: noon - 2 * H }, noon))
  t.true(tablePushAllowed(stranger, on, { friend: null, any: noon - TABLE_GAP_MS }, noon))
  // A friend's push does not use up anybody's.
  t.true(tablePushAllowed(stranger, on, { friend: noon, any: null }, noon))
})

test('no table push in the quiet hours or with pushes off', (t) => {
  const on = { ...london, tables: true }
  t.false(tablePushAllowed({ friend: true }, on, never, Date.parse('2026-11-23T02:00:00Z')))
  t.false(tablePushAllowed({ friend: false }, on, never, Date.parse('2026-11-23T02:00:00Z')))
  t.false(tablePushAllowed({ friend: true }, { ...on, push: false }, never, noon))
})

test('a table push says who, where and how full, and opens the join screen', (t) => {
  t.deepEqual(tablePush(news), {
    copy: { title: 'Sam opened a table', body: 'The Pub, 300 buy-in. 1 of 4 seated.' },
    url: '/game/room?code=ABCDEF',
    tag: 'room-ABCDEF',
  })
  t.is(tablePush({ ...news, slow: true }).copy.title, 'Sam opened a slow game')
  t.regex(tablePush({ ...news, forRoll: false }).copy.body, /for fun/)
})

test('table news is checked field by field', (t) => {
  t.deepEqual(readTableNews(news), news)
  t.is(readTableNews({ ...news, code: 'nope' }), null)
  t.is(readTableNews({ ...news, venueId: 'nowhere' }), null)
  t.is(readTableNews({ ...news, name: '' }), null)
  t.is(readTableNews({ ...news, seated: -1 }), null)
  t.is(readTableNews(null), null)
})

test('the audience: friends and subscribers once each, never the host or the shut out', (t) => {
  const got = tableAudience(
    'host',
    ['f1', 'f2', 'host'],
    ['f1', 's1', 's2', 'blocker'],
    ['f2', 'blocker'],
  )
  t.deepEqual(got, [
    { userId: 'f1', friend: true },
    { userId: 's1', friend: false },
    { userId: 's2', friend: false },
  ])
  const many = Array.from({ length: ANNOUNCE_MAX + 10 }, (_, i) => `s${i}`)
  t.is(tableAudience('host', [], many, []).length, ANNOUNCE_MAX)
})
