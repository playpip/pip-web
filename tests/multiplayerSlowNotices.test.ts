import test from 'ava'
import { VENUES } from '@/config/venues'
import { mulberry32 } from '@/lib/poker/cards'
import { act, createRoom, join, start, type Result, type RoomState } from '@/lib/multiplayer/room'
import { cardFor, noticeCopy, ordinal, timeLeft, type SlowCard } from '@/lib/multiplayer/slowCard'
import {
  DEFAULT_PREFS,
  EMAIL_GAP_MS,
  EMAIL_ONLY_AFTER_MS,
  PUSH_AFTER_MS,
  emailSlot,
  nextDue,
  parseDevice,
  parsePrefs,
  planNotice,
  type PlayPrefs,
} from '@/lib/multiplayer/notices'

const H = 60 * 60 * 1000
const must = (r: Result): RoomState => {
  if (!r.ok) throw new Error(r.error)
  return r.state
}
const person = (n: number) => ({
  userId: `user-${n}`,
  name: n === 0 ? 'Sam' : 'Priya',
  avatar: { seed: `s${n}`, backgroundColor: 'b6e3f4' },
  ring: null,
})

function dealt(): RoomState {
  const s = createRoom({ code: 'SLOWGM', kind: 'slow', venue: VENUES[1], host: person(0), now: 0 })
  return must(start(must(join(s, person(1), 0)), 'user-0', 0, mulberry32(4)))
}

const toAct = (s: RoomState) =>
  s.players.find((p) => p.id === s.hand!.players[s.hand!.toActIndex].id)!.userId!

test('a card shows only your own cards, and whose move it is', (t) => {
  const s = dealt()
  const mover = toAct(s)
  const other = mover === 'user-0' ? 'user-1' : 'user-0'
  const mine = cardFor(s, mover, { watching: false, now: 0 })
  const theirs = cardFor(s, other, { watching: true, now: 0 })
  t.true(mine.yourTurn)
  t.false(theirs.yourTurn)
  t.is(mine.hole.length, 2)
  t.is(theirs.hole.length, 2)
  t.notDeepEqual(mine.hole, theirs.hole)
  t.is(mine.turnKey, '1:0')
  t.is(mine.dueAt, s.dueAt)
  t.is(theirs.dueAt, null)
  t.is(mine.pot, s.hand!.smallBlind + s.hand!.bigBlind)
  // Nothing in a card is anybody else's hole cards.
  t.false(JSON.stringify(theirs).includes(JSON.stringify(mine.hole)))
  t.true(theirs.watching)
})

test('what the notification says', (t) => {
  const s = dealt()
  const mover = toAct(s)
  const card = cardFor(s, mover, { watching: false, now: 0 })
  const copy = noticeCopy(card, s.dueAt! - 3 * H)
  t.regex(copy!.title, /^Your move vs (Sam|Priya)$/)
  t.is(copy!.body, 'Hand 1 · 3h left')
  t.is(timeLeft(11 * H + 20 * 60_000), '11h 20m')
  t.is(timeLeft(40 * 60_000), '40m')
  t.is(ordinal(2), '2nd')
  t.is(ordinal(11), '11th')
  t.is(ordinal(23), '23rd')
})

const prefs: PlayPrefs = { ...DEFAULT_PREFS, tz: 'Europe/London', email: true }

test('slow-game email starts off, like the other emails', (t) => {
  t.false(DEFAULT_PREFS.email)
  const s = dealt()
  const card = cardFor(s, toAct(s), { watching: false, now: 0 })
  const n = planNotice(undefined, card, { ...DEFAULT_PREFS, tz: 'Europe/London' }, true, 0)!
  t.is(n.emailAt, null)
})

test('your move is pushed at once and emailed a quarter of the way through the clock', (t) => {
  const s = dealt()
  const card = cardFor(s, toAct(s), { watching: false, now: 0 })
  const now = Date.parse('2026-07-01T11:00:00Z') // midday BST
  const n = planNotice(undefined, card, prefs, true, now)!
  t.is(n.pushAt, now + PUSH_AFTER_MS)
  t.is(n.emailAt, now + 3 * H)
  // The same turn told again changes nothing.
  t.is(planNotice(n, card, prefs, true, now + H), n)
  t.is(nextDue([n]), now + PUSH_AFTER_MS)
})

test('with no device to push to, the email comes after a few minutes', (t) => {
  const s = dealt()
  const card = cardFor(s, toAct(s), { watching: false, now: 0 })
  const now = Date.parse('2026-07-01T11:00:00Z')
  const n = planNotice(undefined, card, prefs, false, now)!
  t.is(n.pushAt, null)
  t.is(n.emailAt, now + EMAIL_ONLY_AFTER_MS)
})

test('nothing during quiet hours: it waits until they end', (t) => {
  const s = dealt()
  const card = cardFor(s, toAct(s), { watching: false, now: 0 })
  const now = Date.parse('2026-07-01T23:00:00Z') // midnight BST
  const n = planNotice(undefined, card, prefs, true, now)!
  t.is(n.pushAt, Date.parse('2026-07-02T07:00:00Z')) // 08:00 BST
})

test('switches off mean nothing is planned that way', (t) => {
  const s = dealt()
  const card = cardFor(s, toAct(s), { watching: false, now: 0 })
  const n = planNotice(undefined, card, { ...prefs, push: false, email: false }, true, 0)!
  t.is(n.pushAt, null)
  t.is(n.emailAt, null)
  // Slow games off under push: emailed, not pushed, and soon, as with no device.
  const quiet = planNotice(undefined, card, { ...prefs, slow: false }, true, 0)!
  t.is(quiet.pushAt, null)
  t.not(quiet.emailAt, null)
})

test('once it is somebody else’s move there is nothing to tell you', (t) => {
  let s = dealt()
  const mover = toAct(s)
  const n = planNotice(undefined, cardFor(s, mover, { watching: false, now: 0 }), prefs, true, 0)
  s = must(act(s, mover, { type: 'call' }, 1))
  t.is(planNotice(n, cardFor(s, mover, { watching: false, now: 1 }), prefs, true, 1), undefined)
})

test('a finished game is a push, once', (t) => {
  const s = dealt()
  const card: SlowCard = {
    ...cardFor(s, 'user-0', { watching: false, now: 0 }),
    phase: 'finished',
    place: 1,
    yourTurn: false,
    turnKey: null,
  }
  const n = planNotice(undefined, card, prefs, true, Date.parse('2026-07-01T11:00:00Z'))!
  t.is(n.key, 'end')
  t.is(n.emailAt, null)
  t.is(noticeCopy(card, 0)!.title, 'You won')
  t.is(noticeCopy({ ...card, place: 2 }, 0)!.title, 'You finished 2nd')
})

test('at most one turn email every twelve hours', (t) => {
  const now = Date.parse('2026-07-01T08:00:00Z') // 09:00 BST
  t.is(emailSlot(now, null, prefs), now)
  t.is(emailSlot(now, now - EMAIL_GAP_MS, prefs), now)
  t.is(emailSlot(now, now - H, prefs), now - H + EMAIL_GAP_MS)
  // A slot that lands in quiet hours waits for the morning.
  const late = Date.parse('2026-07-01T20:00:00Z')
  t.is(emailSlot(late, late - H, prefs), Date.parse('2026-07-02T07:00:00Z'))
})

test('settings and devices are read strictly', (t) => {
  t.deepEqual(parsePrefs({ ...prefs }), prefs)
  t.is(parsePrefs({ ...prefs, tz: 'Mars/Olympus' }), null)
  t.is(parsePrefs({ ...prefs, quietFrom: 1440 }), null)
  t.is(parsePrefs({ ...prefs, push: 'yes' }), null)

  const web = {
    kind: 'web',
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    keys: { p256dh: 'BN4aEbfXjG70QHONdg8saj41rOUWe4C7', auth: 'tBHItJI5svbpez7KI4CCXg' },
  }
  t.deepEqual(parseDevice(web), web)
  t.is(parseDevice({ ...web, endpoint: 'http://example.com/push' }), null)
  t.is(parseDevice({ ...web, keys: { p256dh: '<script>', auth: 'x' } }), null)
  t.deepEqual(parseDevice({ kind: 'expo', token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' }), {
    kind: 'expo',
    token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  t.is(parseDevice({ kind: 'expo', token: 'nope' }), null)
})

test('a move set ahead is not your move to be told about', async (t) => {
  const { setPre } = await import('@/lib/multiplayer/room')
  let s = dealt()
  const mover = toAct(s)
  const other = mover === 'user-0' ? 'user-1' : 'user-0'
  s = must(setPre(s, other, { kind: 'check-fold' }))
  s = must(act(s, mover, { type: 'call' }, 1))
  // The turn is the other player's, but their check/fold is about to be made for them.
  t.is(s.dueKind, 'pre')
  t.false(cardFor(s, other, { watching: false, now: 1 }).yourTurn)
})
