import test from 'ava'
import { VENUES } from '@/config/venues'
import { mulberry32 } from '@/lib/poker/cards'
import { legalActions } from '@/lib/poker/engine'
import {
  act,
  addBots,
  block,
  blockedBetween,
  configure,
  createRoom,
  disconnect,
  join,
  kick,
  leave,
  removeBot,
  start,
  tick,
  timeoutAction,
  AWAY_TURN_MS,
  TURN_MS,
  type Joiner,
  type Result,
  type RoomState,
} from '@/lib/multiplayer/room'
import { viewFor } from '@/lib/multiplayer/view'

const garage = VENUES[0]
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

const room = (now = 0) =>
  createRoom({ code: 'ABCDEF', kind: 'private', venue: pub, host: person(0), now })

const totalChips = (s: RoomState): number =>
  s.hand
    ? s.hand.players.reduce((sum, p) => sum + p.stack + p.committedThisHand, 0) +
      s.players
        .filter((p) => !s.hand!.players.some((h) => h.id === p.id))
        .reduce((a, p) => a + p.stack, 0)
    : s.players.reduce((sum, p) => sum + p.stack, 0)

/** Run the clock forward until the game ends, every human timing out. */
function playOut(s: RoomState, rng: () => number, limit = 20_000): RoomState {
  let now = s.dueAt ?? 0
  for (let i = 0; i < limit && s.phase === 'playing'; i++) {
    now = Math.max(now, s.dueAt ?? now)
    s = tick(s, now, rng)
  }
  return s
}

test('the host is seated on creation and the room waits in the lobby', (t) => {
  const s = room()
  t.is(s.phase, 'lobby')
  t.is(s.players.length, 1)
  t.is(s.players[0].userId, 'user-0')
  t.is(s.players[0].stack, pub.buyIn)
  t.is(s.hostUserId, 'user-0')
})

test('friends join with the code up to six seats, and no further', (t) => {
  let s = room()
  for (let n = 1; n < 6; n++) s = must(join(s, person(n), 0))
  t.is(s.players.length, 6)
  const full = join(s, person(9), 0)
  t.false(full.ok)
  t.is(!full.ok && full.error, 'full')
})

test('joining again is a reconnect, not a second seat', (t) => {
  let s = must(join(room(), person(1), 0))
  s = disconnect(s, 'user-1', 0)
  t.false(s.players[1].connected)
  s = must(join(s, person(1), 0))
  t.is(s.players.length, 2)
  t.true(s.players[1].connected)
})

test('only the host starts a private room, and not alone', (t) => {
  let s = room()
  const alone = start(s, 'user-0', 0, mulberry32(1))
  t.is(!alone.ok && alone.error, 'too-few')
  s = must(join(s, person(1), 0))
  const notHost = start(s, 'user-1', 0, mulberry32(1))
  t.is(!notHost.ok && notHost.error, 'not-host')
  s = must(start(s, 'user-0', 0, mulberry32(1)))
  t.is(s.phase, 'playing')
  t.truthy(s.hand)
  t.is(s.prize, pub.buyIn * 2)
})

test('nobody new sits down once the cards are dealt', (t) => {
  let s = must(join(room(), person(1), 0))
  s = must(start(s, 'user-0', 0, mulberry32(2)))
  const late = join(s, person(2), 0)
  t.is(!late.ok && late.error, 'started')
})

test('the host fills empty chairs with the cast, never past the table and never twice over', (t) => {
  let s = must(addBots(room(), 'user-0', 10, mulberry32(3)))
  t.is(s.players.length, 6)
  const bots = s.players.filter((p) => p.bot)
  t.is(bots.length, 5)
  t.is(new Set(bots.map((b) => b.characterId)).size, 5)
  t.true(bots.every((b) => b.ai !== undefined && b.userId === null))
  const notHost = addBots(must(join(room(), person(1), 0)), 'user-1', 1, mulberry32(3))
  t.is(!notHost.ok && notHost.error, 'not-host')
  s = must(removeBot(s, 'user-0', bots[0].id))
  t.is(s.players.length, 5)
})

test('a move from anybody but the player to act is refused', (t) => {
  let s = must(join(room(), person(1), 0))
  s = must(start(s, 'user-0', 0, mulberry32(4)))
  const toAct = s.hand!.players[s.hand!.toActIndex].id
  const other = s.players.find((p) => p.id !== toAct)!
  const r = act(s, other.userId!, { type: 'fold' }, 0)
  t.is(!r.ok && r.error, 'not-your-turn')
  const stranger = act(s, 'user-99', { type: 'fold' }, 0)
  t.is(!stranger.ok && stranger.error, 'not-seated')
})

test('an illegal move is refused without changing the table', (t) => {
  let s = must(join(room(), person(1), 0))
  s = must(start(s, 'user-0', 0, mulberry32(5)))
  const toAct = s.players.find((p) => p.id === s.hand!.players[s.hand!.toActIndex].id)!
  const r = act(s, toAct.userId!, { type: 'raise', amount: 10_000_000 }, 0)
  t.is(!r.ok && r.error, 'illegal')
  const check = legalActions(s.hand!)!.canCheck
  if (!check) {
    const r2 = act(s, toAct.userId!, { type: 'check' }, 0)
    t.is(!r2.ok && r2.error, 'illegal')
  }
})

test('a turn runs out into a check when it is free and a fold when it is not', (t) => {
  let s = must(join(room(), person(1), 0))
  s = must(start(s, 'user-0', 0, mulberry32(6)))
  t.is(s.dueKind, 'turn')
  t.is(s.dueAt, TURN_MS)
  // Heads-up preflop the button faces the big blind: running out folds.
  t.deepEqual(timeoutAction(s.hand!), { type: 'fold' })
  const before = s.handIndex
  s = tick(s, TURN_MS, mulberry32(6))
  t.is(s.hand!.street, 'complete')
  t.is(s.dueKind, 'next-hand')
  s = tick(s, s.dueAt!, mulberry32(6))
  t.is(s.handIndex, before + 1)
})

test('an alarm that fires early does nothing', (t) => {
  let s = must(join(room(), person(1), 0))
  s = must(start(s, 'user-0', 0, mulberry32(7)))
  t.is(tick(s, TURN_MS - 1, mulberry32(7)), s)
})

test('a bot that cannot decide checks or folds instead of stalling the table', (t) => {
  const rng = mulberry32(3)
  let s = must(addBots(room(), 'user-0', 3, rng))
  // An AI profile that throws the moment the policy reads it.
  const broken = new Proxy({} as NonNullable<RoomState['players'][number]['ai']>, {
    get: () => {
      throw new Error('broken profile')
    },
  })
  s = { ...s, players: s.players.map((p) => (p.bot ? { ...p, ai: broken } : p)) }
  s = must(start(s, 'user-0', 0, rng))
  let moved = 0
  for (let i = 0; i < 50 && s.phase === 'playing'; i++) {
    const hand = s.hand!
    const toAct = hand.result ? null : hand.players[hand.toActIndex]
    const bot = s.players.find((p) => p.id === toAct?.id)?.bot
    const actions = hand.actions.length
    const next = tick(s, s.dueAt!, rng)
    t.not(next, s)
    if (bot && next.hand === s.hand) t.fail('the bot did not move')
    if (bot && next.hand!.actions.length > actions) {
      t.true(['check', 'fold'].includes(next.hand!.actions[actions].type))
      moved++
    }
    s = next
  }
  t.true(moved > 0)
})

test('a player who drops out gets the short clock, and the long one back on return', (t) => {
  let s = must(join(room(), person(1), 0))
  s = must(start(s, 'user-0', 0, mulberry32(8)))
  const toAct = s.players.find((p) => p.id === s.hand!.players[s.hand!.toActIndex].id)!
  s = disconnect(s, toAct.userId!, 1_000)
  t.is(s.dueAt, 1_000 + AWAY_TURN_MS)
  s = must(join(s, person(Number(toAct.userId!.split('-')[1])), 2_000))
  t.is(s.dueAt, 2_000 + TURN_MS)
})

test('leaving the lobby frees the seat and hands the room on', (t) => {
  let s = must(join(room(), person(1), 0))
  s = leave(s, 'user-0', 0)
  t.is(s.players.length, 1)
  t.is(s.hostUserId, 'user-1')
  s = leave(s, 'user-1', 0)
  t.is(s.dueKind, 'expire')
})

test('a full game with the cast plays to one winner, keeps every chip, and places everybody', (t) => {
  for (let seed = 1; seed <= 12; seed++) {
    const rng = mulberry32(seed)
    let s = must(addBots(must(join(room(), person(1), 0)), 'user-0', 3, rng))
    s = must(start(s, 'user-0', 0, rng))
    const chips = s.players.length * pub.buyIn
    t.is(totalChips(s), chips)
    s = playOut(s, rng)
    t.is(s.phase, 'finished', `seed ${seed}`)
    t.is(
      s.players.reduce((sum, p) => sum + p.stack, 0),
      chips,
    )
    const places = s.players.map((p) => p.place).sort()
    t.deepEqual(
      places,
      s.players.map((_, i) => i + 1),
      `seed ${seed}: every place once`,
    )
    const winner = s.players.find((p) => p.place === 1)!
    t.is(winner.stack, chips)
    t.is(s.dueKind, 'expire')
  }
})

test('the button moves one live seat round the table each hand', (t) => {
  const rng = mulberry32(21)
  let s = must(addBots(room(), 'user-0', 3, rng))
  s = must(start(s, 'user-0', 0, rng))
  const order = s.players.map((p) => p.id)
  const first = order.indexOf(s.buttonId!)
  s = tick(s, s.dueAt!, rng)
  while (s.dueKind !== 'next-hand') s = tick(s, s.dueAt!, rng)
  s = tick(s, s.dueAt!, rng)
  const live = s.players.filter((p) => p.stack > 0).map((p) => p.id)
  let expected = (first + 1) % order.length
  while (!live.includes(order[expected])) expected = (expected + 1) % order.length
  t.is(s.buttonId, order[expected])
})

test('quick match only seats the players it matched, then fills with AI strangers', (t) => {
  let s = createRoom({
    code: 'QQQQQQ',
    kind: 'quick',
    venue: pub,
    reserved: ['user-1', 'user-2'],
    now: 0,
  })
  t.is(s.dueKind, 'start')
  const stranger = join(s, person(7), 0)
  t.is(!stranger.ok && stranger.error, 'not-invited')
  s = must(join(s, person(1), 0))
  t.is(s.dueAt, 15_000)
  // The second matched player arriving starts it straight away.
  s = must(join(s, person(2), 1_000))
  t.is(s.dueAt, 1_000)
  s = tick(s, 1_000, mulberry32(9))
  t.is(s.phase, 'playing')
  t.is(s.players.length, pub.seats)
  const fill = s.players.filter((p) => p.bot)
  t.is(fill.length, pub.seats - 2)
  // Strangers, not the cast: no character, an ordinary name, the stake's game.
  t.true(fill.every((p) => p.characterId === undefined && p.ai !== undefined))
  t.is(new Set(s.players.map((p) => p.name)).size, s.players.length)
  t.is(s.prize, pub.buyIn * pub.seats)
})

test('a quick table nobody turned up to closes instead of dealing to the cast', (t) => {
  let s = createRoom({ code: 'QQQQQQ', kind: 'quick', venue: garage, reserved: ['user-1'], now: 0 })
  s = tick(s, s.dueAt!, mulberry32(10))
  t.is(s.phase, 'closed')
})

test('a player who leaves mid-game has every turn folded for them at once', (t) => {
  const rng = mulberry32(11)
  let s = must(join(room(), person(1), 0))
  s = must(start(s, 'user-0', 0, rng))
  const toAct = s.players.find((p) => p.id === s.hand!.players[s.hand!.toActIndex].id)!
  s = leave(s, toAct.userId!, 5_000)
  t.true(s.players.find((p) => p.id === toAct.id)!.left)
  t.true(s.dueAt! < 5_000 + 1_000)
})

// --- the host's settings, removing people, and leaving ---------------------

test('the host sets the table before the deal, within range, and nobody else can', (t) => {
  let s = must(join(room(), person(1), 0))
  s = must(configure(s, 'user-0', { seats: 4, depth: 2, blinds: 'flat', turnSeconds: 15 }))
  t.is(s.maxSeats, 4)
  t.is(s.settings.depth, 2)
  const guest = configure(s, 'user-1', { seats: 3 })
  t.is(!guest.ok && guest.error, 'not-host')
  // Never smaller than the people already sitting, never past six.
  t.is((configure(s, 'user-0', { seats: 1 }) as { error?: string }).error, 'bad-settings')
  t.is((configure(s, 'user-0', { seats: 7 }) as { error?: string }).error, 'bad-settings')
  s = must(start(s, 'user-0', 0, mulberry32(30)))
  t.is((configure(s, 'user-0', { depth: 3 }) as { error?: string }).error, 'started')
})

test('deep stacks start deeper, the prize is unchanged, and the turn clock follows the setting', (t) => {
  let s = must(join(room(), person(1), 0))
  s = must(configure(s, 'user-0', { depth: 3, turnSeconds: 60 }))
  s = must(start(s, 'user-0', 0, mulberry32(31)))
  const chips = s.hand!.players.reduce((sum, p) => sum + p.stack + p.committedThisHand, 0)
  t.is(chips, pub.buyIn * 3 * 2)
  t.is(s.prize, pub.buyIn * 2)
  t.is(s.dueAt, 60_000)
})

test('fixed blinds never rise', (t) => {
  const rng = mulberry32(32)
  let s = must(addBots(room(), 'user-0', 2, rng))
  s = must(configure(s, 'user-0', { blinds: 'flat', depth: 3 }))
  s = must(start(s, 'user-0', 0, rng))
  let now = 0
  for (let i = 0; i < 400 && s.phase === 'playing'; i++) {
    t.is(s.hand!.bigBlind, pub.bigBlind)
    now = Math.max(now, s.dueAt ?? now)
    s = tick(s, now, rng)
  }
})

test('a game for fun has no prize', (t) => {
  let s = must(join(room(), person(1), 0))
  s = must(configure(s, 'user-0', { forRoll: false }))
  s = must(start(s, 'user-0', 0, mulberry32(33)))
  t.is(s.prize, 0)
})

test('a removed person loses their seat before the deal and cannot come back', (t) => {
  let s = must(join(room(), person(1), 0))
  const p1 = s.players.find((p) => p.userId === 'user-1')!.id
  t.is((kick(s, 'user-1', 'p0', 0) as { error?: string }).error, 'not-host')
  t.is((kick(s, 'user-0', 'p0', 0) as { error?: string }).error, 'illegal')
  s = must(kick(s, 'user-0', p1, 0))
  t.is(s.players.length, 1)
  const back = join(s, person(1), 0)
  t.is(!back.ok && back.error, 'kicked')
})

test('removed mid-game, a player is folded through the hand and out at the next deal', (t) => {
  const rng = mulberry32(34)
  let s = must(join(must(join(room(), person(1), 0)), person(2), 0))
  s = must(start(s, 'user-0', 0, rng))
  const p2 = s.players.find((p) => p.userId === 'user-2')!.id
  s = must(kick(s, 'user-0', p2, 0))
  t.true(s.players.find((p) => p.id === p2)!.standing)
  let now = 0
  while (s.dueKind !== 'next-hand' && s.phase === 'playing') {
    now = Math.max(now, s.dueAt ?? now)
    s = tick(s, now, rng)
  }
  s = tick(s, s.dueAt!, rng)
  const gone = s.players.find((p) => p.id === p2)!
  t.is(gone.stack, 0)
  t.is(gone.place, 3)
  t.false(s.hand!.players.some((p) => p.id === p2))
  t.is(!join(s, person(2), 0).ok && 'kicked', 'kicked')
})

test('under "they’re out", leaving ends your game; under "keep their seat", it does not', (t) => {
  for (const leaving of ['out', 'keep-seat'] as const) {
    const rng = mulberry32(35)
    let s = must(join(room(), person(1), 0))
    s = must(configure(s, 'user-0', { leaving }))
    s = must(start(s, 'user-0', 0, rng))
    s = leave(s, 'user-1', 0)
    let now = 0
    while (s.dueKind !== 'next-hand' && s.phase === 'playing') {
      now = Math.max(now, s.dueAt ?? now)
      s = tick(s, now, rng)
    }
    if (s.phase === 'playing') s = tick(s, s.dueAt!, rng)
    if (leaving === 'out') {
      t.is(s.phase, 'finished', 'heads-up, the one who stayed wins')
      t.is(s.players.find((p) => p.userId === 'user-0')!.place, 1)
    } else {
      t.true(s.phase === 'playing' || s.phase === 'finished')
      t.false(s.players.find((p) => p.userId === 'user-1')!.standing ?? false)
    }
  }
})

// --- blocking ----------------------------------------------------------------

test('a block is private, one way to set and both ways to apply', (t) => {
  let s = must(join(room(), person(1), 0))
  const p1 = s.players.find((p) => p.userId === 'user-1')!.id
  s = must(block(s, 'user-0', p1))
  t.true(blockedBetween(s, 'user-0', 'user-1'))
  t.true(blockedBetween(s, 'user-1', 'user-0'))
  t.deepEqual(viewFor(s, 'user-0').blocked, [p1])
  // The person blocked is never told.
  t.deepEqual(viewFor(s, 'user-1').blocked, [])
  t.is((block(s, 'user-0', 'p0') as { error?: string }).error, 'illegal')
})

test('somebody the host has blocked before cannot join their room', (t) => {
  const s = createRoom({
    code: 'ABCDEF',
    kind: 'private',
    venue: pub,
    host: person(0),
    hostBlocks: ['user-1'],
    now: 0,
  })
  const r = join(s, person(1), 0)
  t.is(!r.ok && r.error, 'kicked')
  t.true(join(s, person(2), 0).ok)
})
