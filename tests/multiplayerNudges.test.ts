import test from 'ava'
import { DEFAULT_PREFS, parsePrefs, type PlayPrefs } from '@/lib/multiplayer/notices'
import {
  RATING_GAP_MS,
  nextStreakCheck,
  nextUtcMidnight,
  passedCopy,
  ratingPushAllowed,
  readPlayStreak,
  socialPush,
  streakCopy,
} from '@/lib/multiplayer/nudges'

const H = 60 * 60 * 1000
const at = (iso: string) => Date.parse(iso)
const london: PlayPrefs = { ...DEFAULT_PREFS, tz: 'Europe/London' }

test('the streak check is the latest time of the day outside your quiet hours', (t) => {
  // London, awake 08:00 to 23:00: 20:00 UTC.
  t.is(nextStreakCheck(at('2026-11-09T09:00:00Z'), london), at('2026-11-09T20:00:00Z'))
  // Past today's: tomorrow's.
  t.is(nextStreakCheck(at('2026-11-09T21:00:00Z'), london), at('2026-11-10T20:00:00Z'))
  // Singapore (UTC+8) sleeps 23:00-08:00 local, 15:00-00:00 UTC: 13:00 UTC.
  const sg = { ...DEFAULT_PREFS, tz: 'Asia/Singapore' }
  t.is(nextStreakCheck(at('2026-11-09T01:00:00Z'), sg), at('2026-11-09T13:00:00Z'))
})

test('the next check after one has gone is the next day', (t) => {
  const now = at('2026-11-09T13:00:05Z')
  t.is(nextUtcMidnight(now), at('2026-11-10T00:00:00Z'))
  t.is(nextStreakCheck(nextUtcMidnight(now), london), at('2026-11-10T20:00:00Z'))
})

test('a streak played yesterday and not today is about to end', (t) => {
  const now = at('2026-11-09T20:00:00Z')
  const copy = streakCopy({ current: 6, best: 6, lastDate: '2026-11-08' }, now)
  t.deepEqual(copy, { title: 'Your 6-day streak ends in 4 hours', body: 'Play a hand to keep it.' })
  t.is(
    streakCopy({ current: 1, best: 3, lastDate: '2026-11-08' }, now)?.title,
    'Keep your streak going',
  )
})

test('played today, or long gone: nothing to say', (t) => {
  const now = at('2026-11-09T20:00:00Z')
  t.is(streakCopy({ current: 7, best: 7, lastDate: '2026-11-09' }, now), null)
  t.is(streakCopy({ current: 7, best: 7, lastDate: '2026-11-01' }, now), null)
  t.is(streakCopy(null, now), null)
})

test('a streak that ended at midnight is said once, the day after', (t) => {
  const now = at('2026-11-09T20:00:00Z')
  t.is(
    streakCopy({ current: 5, best: 5, lastDate: '2026-11-07' }, now)?.title,
    'Your streak ended at 5 days',
  )
  // A single day is not a streak worth mourning.
  t.is(streakCopy({ current: 1, best: 1, lastDate: '2026-11-07' }, now), null)
})

test('the streak is read from a synced profile, and nonsense is not', (t) => {
  t.deepEqual(readPlayStreak({ streak: { current: 3, best: 9, lastDate: '2026-11-08' } }), {
    current: 3,
    best: 9,
    lastDate: '2026-11-08',
  })
  t.is(readPlayStreak({ streak: { current: 3, lastDate: null } }), null)
  t.is(readPlayStreak({ streak: { current: -1, lastDate: '2026-11-08' } }), null)
  t.is(readPlayStreak(null), null)
})

test('"passed you" names who, and where it leaves you', (t) => {
  t.deepEqual(passedCopy('Sam', 4), {
    title: 'Sam passed you on the Pip Rating',
    body: 'You’re #4 on the board now.',
  })
  t.is(passedCopy('Sam', null).body, 'See where you are on the board.')
})

test('at most one "passed you" every twelve hours', (t) => {
  const now = at('2026-11-09T12:00:00Z')
  t.true(ratingPushAllowed(null, now))
  t.false(ratingPushAllowed(now - H, now))
  t.true(ratingPushAllowed(now - RATING_GAP_MS, now))
})

test('prefs from a page before the new switches turn them on', (t) => {
  const old = { tz: 'UTC', quietFrom: 0, quietTo: 0, push: true, email: false }
  t.like(parsePrefs(old), { slow: true, rating: true, streak: true })
  t.like(parsePrefs({ ...old, rating: false }), { rating: false, streak: true })
})

test('prefs from a page before the Friends switch turn it on', (t) => {
  const old = { tz: 'UTC', quietFrom: 0, quietTo: 0, push: true, email: false, slow: true }
  t.like(parsePrefs(old), { friends: true })
  t.like(parsePrefs({ ...old, friends: false }), { friends: false })
  t.true(DEFAULT_PREFS.friends)
})

test('a friend request and an acceptance say who, and open where to answer', (t) => {
  t.deepEqual(socialPush({ kind: 'friend-request', name: 'Al', handle: 'al_ace' }), {
    copy: { title: 'Al sent you a friend request', body: 'Say yes or no in Friends.' },
    url: '/game/friends',
    tag: 'friend-al_ace',
    live: false,
  })
  t.deepEqual(socialPush({ kind: 'friend-accepted', name: 'Bea', handle: 'bea' }), {
    copy: { title: 'Bea accepted your friend request', body: 'Challenge them to a game.' },
    url: '/game/player?h=bea',
    tag: 'friend-bea',
    live: false,
  })
})

test('a challenge or invite opens the room, and is live unless slow', (t) => {
  const base = { name: 'Al', handle: 'al_ace', code: 'ABCDEF' }
  t.deepEqual(socialPush({ ...base, kind: 'challenge', slow: false }), {
    copy: { title: 'Al challenged you', body: 'Heads-up, live now. Take your seat.' },
    url: '/game/room?code=ABCDEF',
    tag: 'room-ABCDEF',
    live: true,
  })
  t.like(socialPush({ ...base, kind: 'challenge', slow: true }), {
    copy: { body: 'A slow game, heads-up. Your seat is waiting.' },
    live: false,
  })
  t.deepEqual(socialPush({ ...base, kind: 'invite', slow: true }), {
    copy: { title: 'Al invited you to their table', body: 'A slow game. Your seat is waiting.' },
    url: '/game/room?code=ABCDEF',
    tag: 'room-ABCDEF',
    live: false,
  })
  t.like(socialPush({ ...base, kind: 'invite', slow: false }), {
    copy: { body: 'They’re at the table now.' },
    live: true,
  })
  // A code is read as a typed one would be.
  t.like(socialPush({ ...base, kind: 'invite', code: 'abc-def' }), { tag: 'room-ABCDEF' })
})

test('a friend push with anything wrong in it is not sent', (t) => {
  const ok = { kind: 'challenge', name: 'Al', handle: 'al_ace', code: 'ABCDEF', slow: false }
  t.not(socialPush(ok), null)
  for (const bad of [
    null,
    'challenge',
    [],
    { ...ok, kind: 'poke' },
    { ...ok, kind: undefined },
    { ...ok, name: undefined },
    { ...ok, name: '' },
    { ...ok, name: 'x'.repeat(25) },
    { ...ok, handle: 'Al' },
    { ...ok, handle: 'al ace' },
    { ...ok, handle: 'a'.repeat(21) },
    { ...ok, code: undefined },
    { ...ok, code: 'ABCDE' },
    { ...ok, code: 'ABCDE0' },
    { ...ok, kind: 'invite', code: 42 },
  ]) {
    t.is(socialPush(bad), null, JSON.stringify(bad))
  }
})
