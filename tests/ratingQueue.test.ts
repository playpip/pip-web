import test from 'ava'
import type { SubmittedHand } from '../src/lib/rating/maths'
import { MAX_DECISIONS_PER_HOUR, MAX_HAND_AGE_MS, validateHands } from '../src/lib/rating/maths'
import { sendable } from '../src/lib/rating/queue'

const NOW = Date.UTC(2026, 10, 5, 12)
const decision = { kind: 'flop-call', loss: 0, stake: 10 } as const
const hand = (at: number, n = 1): SubmittedHand => ({
  at,
  decisions: Array.from({ length: n }, () => ({ ...decision })),
})

test('a queue with a hand past the age limit still sends the rest', (t) => {
  const old = hand(NOW - MAX_HAND_AGE_MS - 1)
  const recent = [hand(NOW - 60_000), hand(NOW - 30_000)]
  const queue = [old, ...recent]
  // Sent whole, the server refuses everything, the new hands included.
  t.false(validateHands(queue, 0, NOW).ok)
  const out = sendable(queue, NOW)
  t.deepEqual(out, recent)
  t.true(validateHands(out, 0, NOW).ok)
})

test('a hand just inside the age limit is dropped before a slow send can refuse it', (t) => {
  const edge = hand(NOW - MAX_HAND_AGE_MS + 60_000)
  t.is(sendable([edge, hand(NOW - 1000)], NOW).length, 1)
})

test('a backlog over the hourly limit sends the oldest that fit, never more', (t) => {
  const queue = Array.from({ length: 200 }, (_, i) => hand(NOW - 1_000_000 + i * 3000, 8))
  const out = sendable(queue, NOW)
  const decisions = out.reduce((sum, h) => sum + h.decisions.length, 0)
  t.true(decisions <= MAX_DECISIONS_PER_HOUR)
  t.true(decisions > MAX_DECISIONS_PER_HOUR - 8)
  t.deepEqual(out, queue.slice(0, out.length))
})

test('an ordinary queue goes up as it is', (t) => {
  const queue = [hand(NOW - 9000, 2), hand(NOW - 6000), hand(NOW - 3000, 3)]
  t.deepEqual(sendable(queue, NOW), queue)
})
