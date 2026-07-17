import test from 'ava'
import { encodeHand, decodeHand } from '@/lib/handLink'
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
