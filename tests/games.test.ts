import test from 'ava'
import { VENUES } from '@/config/venues'
import { gameKind, handJustFinished, seatEntries } from '@/lib/multiplayer/games'
import { mulberry32 } from '@/lib/poker/cards'
import { legalActions, type Action } from '@/lib/poker/engine'
import {
  act,
  createRoom,
  join,
  start,
  tick,
  type Joiner,
  type Result,
  type RoomState,
} from '@/lib/multiplayer/room'
import { HERO_ID } from '@/lib/review/handState'

// Your games (docs/games.md): what the room server writes for each person at
// the table when a multiplayer hand finishes.

const venue = VENUES[1]
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const person = (n: number): Joiner => ({
  userId: uuid(n),
  name: `Player ${n}`,
  avatar: { seed: `s${n}`, backgroundColor: 'b6e3f4' },
  ring: null,
})
const must = (r: Result): RoomState => {
  if (!r.ok) throw new Error(r.error)
  return r.state
}

/** A slow game played to `hands` finished hands, each finished state passed to `onHand` with the one before it. */
function play(
  seed: number,
  hands: number,
  onHand: (before: RoomState, s: RoomState) => void,
): RoomState {
  const rng = mulberry32(seed)
  let s = must(
    join(createRoom({ code: 'GAMES', kind: 'slow', venue, host: person(0), now: 0 }), person(1), 0),
  )
  s = must(start(s, uuid(0), 0, rng))
  let done = 0
  for (let i = 0; i < 4000 && s.phase === 'playing' && done < hands; i++) {
    if (s.dueKind === 'next-hand' || s.dueKind === 'pre') {
      s = tick(s, s.dueAt!, rng)
      continue
    }
    const legal = legalActions(s.hand!)!
    const r = rng()
    const action: Action =
      r < 0.15
        ? { type: 'fold' }
        : r < 0.35 && (legal.canRaise || legal.canBet)
          ? { type: legal.canBet ? 'bet' : 'raise', amount: legal.minRaiseTo }
          : legal.canCheck
            ? { type: 'check' }
            : { type: 'call' }
    const id = s.hand!.players[s.hand!.toActIndex].id
    const user = s.players.find((p) => p.id === id)!.userId!
    const before = s
    s = must(act(s, user, action, 0))
    if (handJustFinished(before, s)) {
      done++
      onHand(before, s)
    }
  }
  return s
}

test('each person gets their own copy, with only the cards they saw', (t) => {
  let checked = 0
  play(7, 12, (_, s) => {
    const entries = seatEntries(s, 1_000)
    t.is(entries.length, 2)
    const showdown = s.hand!.result!.showdown === true
    for (const e of entries) {
      const seat = s.players.find((p) => p.userId === e.user)!
      t.is(e.game.key, `room:GAMES:${s.startedAt}`)
      t.is(e.game.kind, 'slow')
      t.is(e.hand.record.handNo, s.handIndex)
      // The seat is the review's hero, and every card it holds is its own or shown.
      const own = e.hand.record.hole?.find((h) => h.playerId === HERO_ID)
      t.truthy(own)
      t.deepEqual(own!.cards, s.hand!.players.find((p) => p.id === seat.id)!.hole)
      for (const h of e.hand.record.hole ?? []) {
        if (h.playerId === HERO_ID) continue
        t.true(showdown, 'an opponent’s cards only after a showdown')
        const them = s.hand!.players.find((p) => p.id === h.playerId)!
        t.not(them.status, 'folded')
      }
      // Decisions rated come out of this seat's own graded calls and folds.
      for (const d of e.rated?.decisions ?? []) t.true(d.stake >= 1)
      checked++
    }
  })
  t.true(checked >= 20)
})

test('a hand is written once, when its result first appears', (t) => {
  let finished = 0
  const end = play(11, 6, () => finished++)
  t.is(finished, 6)
  // The same finished state saved again is not a new hand.
  t.false(handJustFinished(end, end))
})

test('a dev account and a bot get no copy', (t) => {
  play(3, 1, (_, s) => {
    const dev = {
      ...s,
      players: s.players.map((p, i) => (i === 0 ? { ...p, userId: 'dev-will' } : p)),
    }
    t.deepEqual(
      seatEntries(dev, 0).map((e) => e.user),
      [uuid(1)],
    )
  })
})

test('rooms are named by how they were opened', (t) => {
  t.is(gameKind({ kind: 'slow' }), 'slow')
  t.is(gameKind({ kind: 'private' }), 'private')
  t.is(gameKind({ kind: 'private', listed: true }), 'open')
  t.is(gameKind({ kind: 'quick' }), 'open')
})
