import test from 'ava'
import { encodeHand, decodeHand, decodeShared, reviewable } from '@/lib/handLink'
import type { GradedDecision } from '@/lib/review/grade'
import { cardFromString } from '@/lib/poker/cards'
import type { HandRecord } from '@/store/game'

const cards = (...s: string[]) => s.map(cardFromString)

const record: HandRecord = {
  handNo: 7,
  smallBlind: 15,
  bigBlind: 30,
  events: [
    { kind: 'action', playerId: 'ai0', playerName: 'Vivienne', type: 'raise', amount: 90 },
    { kind: 'action', playerId: 'hero', playerName: 'Will', type: 'call', amount: 90 },
    { kind: 'board', label: 'Flop', cards: cards('Ah', '7d', '2c') },
    { kind: 'action', playerId: 'hero', playerName: 'Will', type: 'check' },
    { kind: 'action', playerId: 'ai0', playerName: 'Vivienne', type: 'bet', amount: 120 },
    { kind: 'action', playerId: 'hero', playerName: 'Will', type: 'fold' },
  ],
  community: cards('Ah', '7d', '2c'),
  reveals: [{ playerId: 'hero', playerName: 'Will', cards: cards('Kd', 'Kc'), handName: 'Pair' }],
  summary: 'Vivienne wins 300',
}

test('a hand survives the encode → decode round trip', (t) => {
  const token = encodeHand(record)
  t.regex(token, /^[A-Za-z0-9\-_]+$/, 'token is URL-fragment safe')
  const back = decodeHand(token)
  t.truthy(back)
  t.is(back!.handNo, 7)
  t.is(back!.smallBlind, 15)
  t.is(back!.bigBlind, 30)
  t.is(back!.summary, record.summary)
  t.deepEqual(back!.community, record.community)
  t.is(back!.events.length, record.events.length)
  // Player names and the hero flag carry over (ids are re-synthesised).
  const call = back!.events[1]
  t.is(call.kind, 'action')
  if (call.kind === 'action') {
    t.is(call.playerName, 'Will')
    t.is(call.playerId, 'hero')
    t.is(call.type, 'call')
    t.is(call.amount, 90)
  }
  const flop = back!.events[2]
  t.is(flop.kind, 'board')
  if (flop.kind === 'board') t.deepEqual(flop.cards, cards('Ah', '7d', '2c'))
  t.deepEqual(back!.reveals[0].cards, cards('Kd', 'Kc'))
  t.is(back!.reveals[0].handName, 'Pair')
})

test('unicode names survive', (t) => {
  const rec = { ...record, events: record.events.slice(0, 1), reveals: [] }
  rec.events[0] = { ...rec.events[0], playerName: 'Åsa 🃏' } as (typeof rec.events)[0]
  const back = decodeHand(encodeHand(rec))
  t.truthy(back)
  const ev = back!.events[0]
  if (ev.kind === 'action') t.is(ev.playerName, 'Åsa 🃏')
})

test('malformed tokens decode to null, never throw', (t) => {
  t.is(decodeHand(''), null)
  t.is(decodeHand('not base64!!'), null)
  t.is(decodeHand('AAAA'), null) // valid base64, not valid JSON
  t.is(decodeHand(encodeHand(record).slice(0, 10)), null) // truncated
  // Valid JSON, wrong shape / version.
  const forge = (obj: unknown) =>
    decodeHand(
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, ''),
    )
  t.is(forge({ v: 99 }), null)
  t.is(forge({ v: 1, p: 'nope' }), null)
  t.is(forge({ v: 1, n: 1, b: [1, 2], p: ['A'], h: 0, e: [[0, 'z']], c: '', r: [], s: '' }), null) // unknown action code
  t.is(
    forge({ v: 1, n: 1, b: [1, 2], p: ['A'], h: 0, e: [['*', 'Flop', 'Zz']], c: '', r: [], s: '' }),
    null,
  ) // bad card
})

// --- v2: the hand as the review needs it ------------------------------------

const avatar = (seed: string) => ({ seed, backgroundColor: 'b6e3f4' })
const at = (pot: number, hero: number, viv: number, bob: number, c: [number, number, number]) => ({
  pot,
  stacks: { ai0: viv, hero, ai1: bob },
  committed: { ai0: c[0], hero: c[1], ai1: c[2] },
})

/** Three seats, one of whom (Bob) folds without ever being shown. */
const full: HandRecord = {
  ...record,
  seats: [
    { id: 'ai0', name: 'Vivienne', avatar: avatar('viv') },
    { id: 'hero', name: 'Will', avatar: avatar('will') },
    { id: 'ai1', name: 'Bob', avatar: avatar('bob') },
  ],
  hole: [
    { playerId: 'ai0', cards: cards('Ac', 'Qs') },
    { playerId: 'hero', cards: cards('Kd', 'Kc') },
    { playerId: 'ai1', cards: cards('9h', '8h') },
  ],
  buttonId: 'ai1',
  start: at(45, 985, 1000, 970, [0, 15, 30]),
  events: [
    {
      kind: 'action',
      playerId: 'ai0',
      playerName: 'Vivienne',
      type: 'raise',
      amount: 90,
      ...at(135, 985, 910, 970, [90, 15, 30]),
    },
    {
      kind: 'action',
      playerId: 'hero',
      playerName: 'Will',
      type: 'call',
      amount: 90,
      ...at(210, 910, 910, 970, [90, 90, 30]),
    },
    {
      kind: 'action',
      playerId: 'ai1',
      playerName: 'Bob',
      type: 'fold',
      ...at(210, 910, 910, 970, [90, 90, 30]),
    },
    { kind: 'board', label: 'Flop', cards: cards('Ah', '7d', '2c') },
    {
      kind: 'action',
      playerId: 'hero',
      playerName: 'Will',
      type: 'check',
      ...at(210, 910, 910, 970, [0, 0, 0]),
    },
    {
      kind: 'action',
      playerId: 'ai0',
      playerName: 'Vivienne',
      type: 'bet',
      amount: 120,
      ...at(330, 910, 790, 970, [120, 0, 0]),
    },
    {
      kind: 'action',
      playerId: 'hero',
      playerName: 'Will',
      type: 'fold',
      ...at(330, 910, 790, 970, [120, 0, 0]),
    },
  ],
}

const decision: GradedDecision = {
  eventIndex: 6,
  street: 'flop',
  folded: true,
  required: 0.26666,
  equity: 0.1234,
  toCall: 120,
  pot: 330,
  margin: 55.4,
  bb: 1.8466,
  grade: 'sound',
  verdict: 'right',
}

test('without review data a link is still v1, and decodes as before', (t) => {
  const plain = decodeShared(encodeHand(full))
  t.truthy(plain)
  t.is(plain!.record.seats, undefined, 'a plain link shows what the table showed')
  t.is(plain!.record.hole, undefined)
  t.deepEqual(plain!.decisions, [])
})

test('a review link carries the whole table back', (t) => {
  const back = decodeShared(encodeHand(full, { decisions: [decision], venueName: 'The Garage' }))
  t.truthy(back)
  const rec = back!.record
  t.true(reviewable(rec))
  t.is(back!.venueName, 'The Garage')
  // Seat order, names and faces.
  t.deepEqual(
    rec.seats!.map((s) => [s.name, s.avatar.seed]),
    [
      ['Vivienne', 'viv'],
      ['Will', 'will'],
      ['Bob', 'bob'],
    ],
  )
  t.is(rec.seats![1].id, 'hero')
  // Every hand dealt, including the one that folded unseen.
  const bob = rec.seats![2].id
  t.deepEqual(rec.hole!.find((h) => h.playerId === bob)?.cards, cards('9h', '8h'))
  t.is(rec.buttonId, bob)
  t.deepEqual(rec.start, {
    pot: 45,
    stacks: { p0: 1000, hero: 985, [bob]: 970 },
    committed: { p0: 0, hero: 15, [bob]: 30 },
  })
  // The chips on each move, keyed to the re-synthesised ids.
  const bet = rec.events[5]
  t.is(bet.kind, 'action')
  if (bet.kind === 'action') {
    t.is(bet.pot, 330)
    t.is(bet.stacks?.p0, 790)
    t.is(bet.committed?.p0, 120)
  }
  t.is(rec.events[3].kind, 'board')
  // The price, to the precision a screen shows it.
  const [d] = back!.decisions
  t.is(d.eventIndex, 6)
  t.is(d.street, 'flop')
  t.true(d.folded)
  t.is(d.required, 0.267)
  t.is(d.equity, 0.123)
  t.is(d.grade, 'sound')
  t.is(d.verdict, 'right')
})

test('a review link stays a sensible length', (t) => {
  const token = encodeHand(full, { decisions: [decision], venueName: 'The Garage' })
  t.true(token.length < 1600, `${token.length} characters`)
})

test('a hand the review cannot grade goes out as a plain replay', (t) => {
  const omaha: HandRecord = {
    ...full,
    hole: full.hole!.map((h) => ({ ...h, cards: [...h.cards, ...cards('2d', '3d')] })),
  }
  t.false(reviewable(omaha))
  t.is(decodeShared(encodeHand(omaha, { decisions: [] }))!.record.seats, undefined)
  const old: HandRecord = { ...full, events: record.events }
  t.false(reviewable(old), 'no chips recorded on the moves')
})

test('a review link with a broken table refuses whole', (t) => {
  const token = encodeHand(full, { decisions: [decision] })
  const wire = JSON.parse(Buffer.from(token, 'base64url').toString())
  const forge = (patch: object) =>
    decodeShared(Buffer.from(JSON.stringify({ ...wire, ...patch })).toString('base64url'))
  t.truthy(forge({}))
  t.is(forge({ o: ['AcQs', 'KdKc'] }), null, 'hole cards for the wrong number of players')
  t.is(forge({ x: wire.x.slice(1) }), null, 'snapshots out of step with the events')
  t.is(forge({ t: [0, 1, 7] }), null, 'a seat nobody is in')
  t.is(
    forge({ d: [[6, 9, 1, 0.2, 0.1, 120, 330, 55, 1.8, 1]] }),
    null,
    'a street that does not exist',
  )
  t.is(forge({ st: [45, [1, 2], [0, 0, 0]] }), null, 'stacks missing a player')
})
