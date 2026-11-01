import test from 'ava'
import { VENUES } from '@/config/venues'
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
import { viewFor } from '@/lib/multiplayer/view'
import { captureRoomView, loadRoomReview, roomHandRecord } from '@/lib/multiplayer/review'
import { HERO_ID, handStateAt } from '@/lib/review/handState'
import { gradeMove } from '@/lib/review/moveGrade'

// A stand-in for the browser's storage, so the keeping can be tested too.
const mem = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
})

const venue = VENUES[1]
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
const toActUser = (s: RoomState): string => {
  const id = s.hand!.players[s.hand!.toActIndex].id
  return s.players.find((p) => p.id === id)!.userId!
}

/** A slow game played with a mix of lines, calling `onHand` as each hand finishes. */
function play(seed: number, hands: number, onHand: (s: RoomState) => void): RoomState {
  const rng = mulberry32(seed)
  let s = must(
    join(
      createRoom({ code: 'REVIEW', kind: 'slow', venue, host: person(0), now: 0 }),
      person(1),
      0,
    ),
  )
  s = must(start(s, 'user-0', 0, rng))
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
    const before = s.handIndex
    s = must(act(s, toActUser(s), action, 0))
    if (s.history?.at(-1)?.index === before && s.dueKind === 'next-hand') {
      done++
      onHand(s)
    }
  }
  return s
}

test('each finished hand becomes a review record from your seat, with only the cards you saw', (t) => {
  let records = 0
  let decisions = 0
  play(5, 40, (s) => {
    for (const user of ['user-0', 'user-1']) {
      const view = viewFor(s, user)
      const last = view.history.at(-1)!
      const record = roomHandRecord(last.hand, last.index, view)
      t.truthy(record, `hand ${last.index}`)
      if (!record) continue
      records++
      const me = last.hand.players.find((p) => p.id === view.you)!
      // Your seat is the review's hero, and nobody else is.
      t.true(record.seats!.some((x) => x.id === HERO_ID))
      t.false(record.seats!.some((x) => x.id === view.you))
      // It ends where the hand did: your stack and what the hand did to it.
      const end = handStateAt(record, record.events.length)
      t.is(end.hand.players.find((p) => p.id === HERO_ID)!.stack, me.stack)
      // Never a card the view did not carry.
      for (const h of record.hole ?? []) {
        if (h.playerId === HERO_ID) continue
        const shown = last.hand.players.find((p) => p.id === h.playerId)!.hole
        t.deepEqual(h.cards, shown)
        t.true(last.hand.result!.showdown)
      }
      // Your own moves carry what you could see as you made them.
      for (const ev of record.events) {
        if (ev.kind === 'action' && ev.playerId === HERO_ID) {
          t.truthy(ev.decision)
          decisions++
        }
        if (ev.kind === 'action' && ev.playerId !== HERO_ID) t.is(ev.decision, undefined)
      }
      // No move is graded against a hand nobody saw.
      record.events.forEach((ev, i) => {
        if (ev.kind !== 'action') return
        const before = handStateAt(record, i).hand
        const hidden = before.players.some((p) => p.status !== 'folded' && p.hole.length < 2)
        if (hidden) t.is(gradeMove(record, i), null)
      })
    }
  })
  t.true(records > 40)
  t.true(decisions > 40)
})

test('a room is kept once per hand, however many views carry it, and closed when it ends', (t) => {
  mem.clear()
  let views = 0
  const s = play(9, 12, (s) => {
    const view = viewFor(s, 'user-0')
    // Every view of a slow game carries the last few hands again.
    captureRoomView(view)
    captureRoomView(view)
    views++
  })
  const review = loadRoomReview('REVIEW')!
  t.truthy(review)
  t.is(review.room.kind, 'slow')
  t.is(review.hands.length, views)
  const numbers = review.hands.map((h) => h.record.handNo)
  t.deepEqual(
    numbers,
    [...new Set(numbers)].sort((a, b) => a - b),
  )
  t.is(review.endedAt, null)

  captureRoomView(
    viewFor(
      {
        ...s,
        phase: 'finished',
        players: s.players.map((p) => ({ ...p, place: p.userId === 'user-0' ? 1 : 2 })),
      },
      'user-0',
    ),
  )
  const ended = loadRoomReview('REVIEW')!
  t.not(ended.endedAt, null)
  t.is(ended.outcome?.kind, 'won')
})

test('a fast room is kept from the hand on the table, as each one finishes', (t) => {
  mem.clear()
  const rng = mulberry32(13)
  let s = must(
    join(
      createRoom({ code: 'FASTGM', kind: 'private', venue, host: person(0), now: 0 }),
      person(1),
      0,
    ),
  )
  s = must(start(s, 'user-0', 0, rng))
  let finished = 0
  for (let i = 0; i < 2000 && s.phase === 'playing' && finished < 8; i++) {
    if (s.dueKind !== 'turn') {
      s = tick(s, s.dueAt!, rng)
      continue
    }
    const legal = legalActions(s.hand!)!
    s = must(act(s, toActUser(s), legal.canCheck ? { type: 'check' } : { type: 'call' }, 0))
    // A fast room carries no history: only the hand on the table, between hands.
    const view = viewFor(s, 'user-1')
    if (view.hand?.result) {
      t.is(view.history.length, 0)
      captureRoomView(view)
      captureRoomView(view)
      finished++
    }
  }
  const review = loadRoomReview('FASTGM')!
  t.is(review.room.kind, 'private')
  t.is(review.hands.length, finished)
  t.true(finished >= 8)
})
