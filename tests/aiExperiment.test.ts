// The AI's experiment switches (`AiProfile.experiment`, measured with
// `pnpm bot-duel`). Two things are asserted exactly.
//
// **With no switch set, the AI is the one that shipped.** The Daily replays its
// opponents off a seed, so every decision and every draw from the rng has to
// come out the same as before the switches existed. The fingerprint
// (`tests/helpers.ts`) is a hash of every action over a fixed set of hands at
// three rungs; the value below was computed on the commit before this file
// existed and typed in, not read back out of the code.
//
// **`fastShowdown` changes nothing but the time it takes.** It settles the same
// sampled showdowns with a different evaluator, so the same rng must give the
// same equity to the last bit and the same decisions all the way through.

import test from 'ava'
import { decideAction } from '@/lib/poker/ai/policy'
import { createTableMemory, type TableMemory } from '@/lib/poker/ai/memory'
import { cardFromString, mulberry32 } from '@/lib/poker/cards'
import { applyAction, startHand } from '@/lib/poker/engine'
import { estimateEquity } from '@/lib/poker/equity'
import { exactStrength, holeStrength, preflopPercentile, preflopTop } from '@/lib/poker/range'
import {
  answerScale,
  levelShare,
  openShare,
  opponentShares,
  reRaiseShare,
} from '@/lib/poker/ai/preflopRanges'
import { opponentRanges } from '@/lib/poker/ai/weightedRange'
import { venueById, type Venue } from '@/config/venues'
import { fingerprint } from './helpers'

const cards = (s: string) => s.split(' ').map(cardFromString)

/** Computed at 8dd33e6, before `AiProfile.experiment` existed. */
const SHIPPED = 'b6e55ee'

test('with no experiment set, the AI makes exactly the decisions it shipped with', (t) => {
  t.is(fingerprint(), SHIPPED)
})

test('fastShowdown makes exactly the same decisions', (t) => {
  t.is(
    fingerprint((p) => ({ ...p, experiment: { fastShowdown: true } })),
    SHIPPED,
  )
})

test('weightedRanges off, or the new memory tallies kept, changes nothing shipped', (t) => {
  // The fingerprint feeds every hand's end to the memory, so the 3-bet,
  // fold-to-c-bet and showdown tallies fill up; the shipped AI must not read them.
  t.is(
    fingerprint((p) => ({ ...p, experiment: { weightedRanges: false } })),
    SHIPPED,
  )
  t.is(
    fingerprint((p) => ({ ...p, experiment: { fastShowdown: true, weightedRanges: false } })),
    SHIPPED,
  )
})

test('weightedRanges does change decisions, so the switch is live', (t) => {
  t.not(
    fingerprint((p) => ({ ...p, experiment: { fastShowdown: true, weightedRanges: true } })),
    SHIPPED,
  )
})

/**
 * `wrange`, the first round of weighted ranges, computed on its own commit
 * before `rangeTuning` existed. Kept fixed so the second round is measured
 * against the same first round.
 */
const WRANGE = '3ad719a9'

test('rangeTuning does nothing without weightedRanges, and leaves wrange as it was', (t) => {
  t.is(
    fingerprint((p) => ({ ...p, experiment: { rangeTuning: true } })),
    SHIPPED,
  )
  t.is(
    fingerprint((p) => ({ ...p, experiment: { fastShowdown: true, rangeTuning: true } })),
    SHIPPED,
  )
  const wrange = { fastShowdown: true, weightedRanges: true }
  t.is(
    fingerprint((p) => ({ ...p, experiment: wrange })),
    WRANGE,
  )
  t.is(
    fingerprint((p) => ({ ...p, experiment: { ...wrange, rangeTuning: false } })),
    WRANGE,
  )
  t.is(
    fingerprint((p) => ({ ...p, experiment: { ...wrange, rangeTuning: {} } })),
    WRANGE,
  )
})

test('rangeTuning on top of weightedRanges changes decisions, so the switch is live', (t) => {
  t.not(
    fingerprint((p) => ({
      ...p,
      experiment: { fastShowdown: true, weightedRanges: true, rangeTuning: true },
    })),
    WRANGE,
  )
})

test('fastShowdown gives the same equity to the last bit, ranged or not', (t) => {
  const spots = [
    { hole: 'Ah Kh', community: '', opponents: 5 },
    { hole: '7c 7d', community: 'Kc 7h 2s', opponents: 2 },
    { hole: 'Qs Js', community: 'Ts 9d 2s 4c', opponents: 3 },
    { hole: '5d 4d', community: 'Ac Kd Qs Jh 9c', opponents: 1 },
  ]
  for (const spot of spots) {
    for (const selectivity of [undefined, [0.3, 0.6, 0.1, 0.8, 0.5]]) {
      const base = {
        hole: cards(spot.hole),
        community: spot.community ? cards(spot.community) : [],
        opponents: spot.opponents,
        iterations: 400,
        opponentSelectivity: selectivity?.slice(0, spot.opponents),
      }
      const slow = estimateEquity({ ...base, rng: mulberry32(5) })
      const fast = estimateEquity({ ...base, rng: mulberry32(5), fastShowdown: true })
      t.deepEqual(fast, slow, `${spot.hole} | ${spot.community}`)
    }
  }
})

test('exactStrength tells top pair from bottom pair, where holeStrength cannot', (t) => {
  const board = cards('Kc 8d 3s')
  const top = cards('Kd 4h')
  const bottom = cards('3d 4c')
  t.true(exactStrength(top, board) > exactStrength(bottom, board))
  t.is(holeStrength(top, board), holeStrength(bottom, board))
})

test('exactStrength counts a draw only when a hole card is in it', (t) => {
  // Four hearts on the turn: a heart in the hand is a made flush, not a draw,
  // so read the flop instead, where three on board plus one is the draw.
  const flop = cards('Kh 8h 3h')
  t.true(exactStrength(cards('Ah 2c'), flop) > exactStrength(cards('Ac 2c'), flop))
  // Four to a straight on the board belongs to everybody and adds to nobody.
  const run = cards('9c Td Jh Qs')
  const a = exactStrength(cards('2c 3d'), run)
  const b = exactStrength(cards('2h 4d'), run)
  t.true(Math.abs(a - b) < 0.01)
})

test('exactStrength is holeStrength before the flop', (t) => {
  for (const hole of ['Ah Kh', '7c 2d', 'Qs Qd']) {
    t.is(exactStrength(cards(hole), []), holeStrength(cards(hole), []))
  }
})

test('openingByBehind is read by the number of players behind', (t) => {
  // A table where only the first-in opener's share decides anything: a skill-1
  // seat first in with a middling hand. Opening every hand from seven behind
  // must raise; opening none must fold.
  const venue = venueById('mainevent') as Venue
  const state = startHand({
    seats: Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, name: `s${i}`, stack: 200 })),
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(3),
  })
  const opener = (share: number) =>
    decideAction(
      state,
      {
        ...venue.ai,
        // Loosest tightness, so the share is used as written.
        tightness: 0,
        iterations: 30,
        experiment: { openingByBehind: [0, 0, 0, 0, 0, 0, 0, share] },
      },
      mulberry32(1),
    ).type
  t.is(opener(0), 'fold')
  t.is(opener(1), 'raise')
})

test('preflopRanges off leaves the shipped decisions alone', (t) => {
  t.is(
    fingerprint((p) => ({ ...p, experiment: { fastShowdown: true, preflopRanges: false } })),
    SHIPPED,
  )
})

test('preflopRanges changes the decisions it is meant to', (t) => {
  t.not(
    fingerprint((p) => ({ ...p, experiment: { fastShowdown: true, preflopRanges: true } })),
    SHIPPED,
  )
})

/**
 * Six-handed, button on seat 0: under the gun (seat 3) opens to 3bb, the
 * cutoff 3-bets to 9bb, everybody else folds, and the opener is to act with
 * `hole`.
 */
function facingThreeBet(hole: string) {
  let s = startHand({
    seats: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `s${i}`, stack: 200 })),
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(1),
  })
  const mine = cards(hole)
  const taken = new Set(mine.map((c) => c.rank + c.suit))
  for (const p of s.players) for (const c of p.hole) taken.add(c.rank + c.suit)
  const spare = ['2c', '2d', '3c', '3d', '4c', '4d', '5c', '5d', '6c', '6d', '7c', '7d']
    .filter((c) => !taken.has(c))
    .map(cardFromString)
  // Hand any card the opener now holds to somebody else's spare.
  for (const p of s.players) {
    if (p !== s.players[3])
      p.hole = p.hole.map((c) =>
        mine.some((m) => m.rank === c.rank && m.suit === c.suit) ? (spare.pop() as typeof c) : c,
      )
  }
  s.players[3].hole = mine
  s = applyAction(s, { type: 'raise', amount: 6 })
  s = applyAction(s, { type: 'fold' })
  s = applyAction(s, { type: 'raise', amount: 18 })
  for (let i = 0; i < 3; i++) s = applyAction(s, { type: 'fold' })
  if (s.toActIndex !== 3) throw new Error('the opener should be to act')
  return s
}

function tally(hole: string, preflopRanges: boolean, threeBetReads = false, memory?: TableMemory) {
  const venue = venueById('mainevent') as Venue
  const profile = {
    ...venue.ai,
    iterations: 300,
    experiment: { fastShowdown: true, preflopRanges, threeBetReads },
  }
  const state = facingThreeBet(hole)
  const out = { fold: 0, call: 0, raise: 0 } as Record<string, number>
  for (let r = 0; r < 60; r++) out[decideAction(state, profile, mulberry32(100 + r), memory).type]++
  return out
}

test('the shipped opener never folds a middling open to a 3-bet; preflopRanges mostly does', (t) => {
  // The leak `pnpm bot-duel` found: 0.1% folds to a 3-bet at The Main Event.
  t.is(tally('Kh Js', false).fold, 0)
  t.true(tally('Kh Js', true).fold >= 50)
})

test('preflopRanges still 4-bets aces and calls with big ace-king', (t) => {
  const aces = tally('Ah Ad', true)
  t.is(aces.fold, 0)
  t.true(aces.raise > aces.call)
  t.is(tally('Ah Ks', true).fold, 0)
})

test('preflopTop is the strongest share of hands, by the same order as preflopPercentile', (t) => {
  const top = preflopTop(0.05)
  // The share, rounded up to the end of the strength tie it lands in.
  t.true(top.length >= Math.round(0.05 * 1326) && top.length < Math.round(0.06 * 1326))
  for (const hole of top) t.true(preflopPercentile(hole) >= 0.94)
  // Never empty: the narrowest range is the hands tied for the top, aces and kings.
  t.is(preflopTop(0).length, 12)
})

test('opponentTopShare deals from the range it names', (t) => {
  const hole = cards('Kh Qs')
  const base = { hole, opponents: 1, iterations: 3000, fastShowdown: true }
  const random = estimateEquity({ ...base, rng: mulberry32(2) }).equity
  const wide = estimateEquity({ ...base, rng: mulberry32(2), opponentTopShare: [0.3] }).equity
  const narrow = estimateEquity({ ...base, rng: mulberry32(2), opponentTopShare: [0.03] }).equity
  t.true(random > wide && wide > narrow, `${random} ${wide} ${narrow}`)
  // After the flop it is ignored, and the answer is the plain one, draw for draw.
  const flop = { ...base, community: cards('2c 7d 9h') }
  t.deepEqual(
    estimateEquity({ ...flop, rng: mulberry32(4), opponentTopShare: [0.03] }),
    estimateEquity({ ...flop, rng: mulberry32(4) }),
  )
})

test('each raise level is a narrower range than the one it answers', (t) => {
  for (const open of [0.15, 0.26, 0.42]) {
    t.true(levelShare(1, open) > levelShare(2, open))
    t.true(levelShare(2, open) > levelShare(3, open))
    t.true(levelShare(3, open) >= levelShare(4, open))
    t.true(levelShare(4, open) >= 0.02)
  }
  // A 3-bet range sits where a regular's does: a few percent, more against a steal.
  t.true(levelShare(2, 0.15) >= 0.05 && levelShare(2, 0.15) <= 0.08)
  t.true(levelShare(2, 0.42) > levelShare(2, 0.15))
})

test('openShare reads where the open came from', (t) => {
  const s = facingThreeBet('Ah Ad')
  // Under the gun six-handed: five behind.
  t.is(openShare(s), 0.15)
})

test('preflopTop never splits hands of equal strength by suit', (t) => {
  for (const share of [0.02, 0.05, 0.1, 0.2]) {
    const counts = new Map<string, number>()
    for (const [a, b] of preflopTop(share)) {
      if (a.rank === b.rank) counts.set(a.rank, (counts.get(a.rank) ?? 0) + 1)
    }
    for (const [rank, n] of counts) t.is(n, 6, `${rank}${rank} at ${share}`)
  }
})

test('openShare does not count a blind that is all in from posting', (t) => {
  let s = startHand({
    seats: Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`,
      name: `s${i}`,
      stack: i === 1 ? 1 : 200,
    })),
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(1),
  })
  t.is(s.players[1].status, 'allin')
  s = applyAction(s, { type: 'raise', amount: 6 })
  // Under the gun with the small blind all in: four players still to act.
  t.is(openShare(s), 0.19)
})

test('preflopRanges pays the bare price for a call that ends the betting', (t) => {
  // Under the gun opens, the cutoff 3-bets queens, under the gun moves all in.
  let s = startHand({
    seats: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `s${i}`, stack: 200 })),
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(1),
  })
  const queens = cards('Qh Qd')
  const spare = cards('2c 3d')
  for (const p of s.players) {
    p.hole = p.hole.map((c, i) =>
      queens.some((q) => q.rank === c.rank && q.suit === c.suit) ? spare[i] : c,
    )
  }
  s.players[5].hole = queens
  s = applyAction(s, { type: 'raise', amount: 6 })
  s = applyAction(s, { type: 'fold' })
  s = applyAction(s, { type: 'raise', amount: 18 })
  for (let i = 0; i < 3; i++) s = applyAction(s, { type: 'fold' })
  s = applyAction(s, { type: 'raise', amount: 200 })
  t.is(s.toActIndex, 5)
  const venue = venueById('mainevent') as Venue
  const profile = {
    ...venue.ai,
    iterations: 300,
    experiment: { fastShowdown: true, preflopRanges: true },
  }
  let calls = 0
  for (let r = 0; r < 40; r++) if (decideAction(s, profile, mulberry32(r)).type === 'call') calls++
  t.true(calls >= 30, `${calls}/40`)
})

/** `pf3`, computed on its own branch before `threeBetReads` existed. */
const PF3 = '4dd62c80'
/**
 * `wrange2`, computed on its own commit before `threeBetReads` existed
 * ('5b36d144'), then once more when a check stopped being read as one to a
 * raiser who had already folded. wpf3's own fingerprint did not move.
 */
const WRANGE2 = 'f8b3f5e0'

test('threeBetReads does nothing without preflopRanges, and leaves pf3 and wrange2 as they were', (t) => {
  const fast = { fastShowdown: true }
  const wrange2 = { ...fast, weightedRanges: true, rangeTuning: true }
  t.is(
    fingerprint((p) => ({ ...p, experiment: { ...fast, threeBetReads: true } })),
    SHIPPED,
  )
  t.is(
    fingerprint((p) => ({ ...p, experiment: { ...fast, preflopRanges: true } })),
    PF3,
  )
  t.is(
    fingerprint((p) => ({
      ...p,
      experiment: { ...fast, preflopRanges: true, threeBetReads: false },
    })),
    PF3,
  )
  t.is(
    fingerprint((p) => ({ ...p, experiment: wrange2 })),
    WRANGE2,
  )
  t.is(
    fingerprint((p) => ({ ...p, experiment: { ...wrange2, threeBetReads: true } })),
    WRANGE2,
  )
})

test('wpf3 changes decisions from both wrange2 and pf3, so the switch is live', (t) => {
  const wpf3 = fingerprint((p) => ({
    ...p,
    experiment: {
      fastShowdown: true,
      weightedRanges: true,
      rangeTuning: true,
      preflopRanges: true,
      threeBetReads: true,
    },
  }))
  t.not(wpf3, WRANGE2)
  t.not(wpf3, PF3)
})

/** A table that has seen `id` re-raise a single raise `hits` times in `chances`. */
function threeBettor(id: string, hits: number, chances: number): TableMemory {
  const memory = createTableMemory()
  memory.players[id] = {
    preflopRaise: { hits, chances },
    postflopAggression: { hits: 0, chances: 0 },
    foldToBet: { hits: 0, chances: 0 },
    threeBet: { hits, chances },
  }
  return memory
}

test('reRaiseShare is the AI’s own re-raise range, scaled by the player’s 3-bet rate', (t) => {
  for (const open of [0.15, 0.26, 0.42]) {
    // Somebody the table has not seen re-raises like a typical player.
    t.is(reRaiseShare(2, open, undefined, 'x'), levelShare(2, open))
    t.is(reRaiseShare(3, open, undefined, 'x'), levelShare(3, open))
  }
  // Seen re-raising 40 times in 100: about four and a half times typical, after the prior.
  const loose = reRaiseShare(2, 0.15, threeBettor('x', 40, 100), 'x')
  t.true(loose > 4 * levelShare(2, 0.15), `${loose}`)
  // And never wider than the widest read, however loose.
  t.is(reRaiseShare(2, 0.42, threeBettor('x', 100, 100), 'x'), 0.6)
  // A player who never re-raises is read narrower, down to the floor.
  t.true(reRaiseShare(2, 0.15, threeBettor('x', 0, 100), 'x') < levelShare(2, 0.15))
})

test('threeBetReads folds an open less often to a player who 3-bets a lot', (t) => {
  // The cutoff (s5) has re-raised 40 single raises in 100. pf3 widens its read
  // only by every preflop raise, scaled by credibility; this reads the 3-bets.
  const memory = threeBettor('s5', 40, 100)
  const pf3 = tally('Kh Js', true, false, memory)
  const byRate = tally('Kh Js', true, true, memory)
  t.true(byRate.fold < pf3.fold, `${byRate.fold} vs ${pf3.fold}`)
  // Against somebody who has never been seen, both read the same range.
  t.deepEqual(tally('Kh Js', true, true), tally('Kh Js', true, false))
})

test('threeBetReads re-raises a player who 3-bets a lot with a wider range', (t) => {
  const memory = threeBettor('s5', 40, 100)
  const state = facingThreeBet('Ah Ad')
  // Against an unseen player the AI's own ranges stand; against one seen
  // re-raising 40 in 100, a 4-bet is the same slice of a range over four times wider.
  t.is(answerScale(state, undefined, 1), 1)
  t.true(answerScale(state, memory, 1) > 4)
  // Ace-queen is no 4-bet against a typical 3-bet, and mostly one against this player.
  const typical = tally('Ah Qd', true, true)
  const loose = tally('Ah Qd', true, true, memory)
  t.true(loose.raise > typical.raise + 20, `${loose.raise} vs ${typical.raise}`)
  // pf3 itself is untouched: no wider 4-bets without threeBetReads.
  t.deepEqual(tally('Ah Qd', true, false, memory).raise, tally('Ah Qd', true, false).raise)
})

test('threeBetReads reads a called 3-bet by the caller’s raises, not their 3-bet rate', (t) => {
  // Under the gun opens, the hijack (s4) cold-calls the cutoff's 3-bet. s4
  // 3-bets a lot, but here it only called somebody else's.
  let s = startHand({
    seats: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `s${i}`, stack: 200 })),
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(1),
  })
  s = applyAction(s, { type: 'raise', amount: 6 })
  s = applyAction(s, { type: 'call' })
  s = applyAction(s, { type: 'raise', amount: 18 })
  s = applyAction(s, { type: 'call' })
  const memory = threeBettor('s4', 40, 100)
  const caller = s.players[4]
  const [byRate] = opponentShares(s, [caller], memory, 1, true)
  const [pf3] = opponentShares(s, [caller], memory, 1, false)
  t.is(byRate, pf3)
  // The cutoff, who made the 3-bet, is read by its own rate.
  t.is(opponentShares(s, [s.players[5]], undefined, 1, true)[0], levelShare(2, openShare(s)))
})

test('threeBetReads counts a short all-in call of a 3-bet as calling it', (t) => {
  // Under the gun opens to 6, the cutoff 3-bets to 18, and the button calls
  // all in for 14; the small blind is to act.
  let s = startHand({
    seats: Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`,
      name: `s${i}`,
      stack: i === 0 ? 14 : 200,
    })),
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(1),
  })
  s = applyAction(s, { type: 'raise', amount: 6 })
  s = applyAction(s, { type: 'fold' })
  s = applyAction(s, { type: 'raise', amount: 18 })
  s = applyAction(s, { type: 'call' })
  const caller = s.players[0]
  if (caller.status !== 'allin' || s.street !== 'preflop') throw new Error('unexpected spot')
  const open = openShare(s)
  t.is(opponentShares(s, [caller], undefined, 1, true)[0], levelShare(2, open))
  // pf3 keeps its own read, by chips committed: only the open.
  t.is(opponentShares(s, [caller], undefined, 1, false)[0], levelShare(1, open))
})

test('with threeBetReads, a weighted 3-bet range is a slice of the open it answers', (t) => {
  // A 3-bet over a button open is a wider range than one over an under-the-gun
  // open; the weighted ranges' own 3-bet read did not depend on the open.
  const threeBetRange = (openerSeat: number, percentile: boolean) => {
    let s = startHand({
      seats: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `s${i}`, stack: 400 })),
      buttonIndex: 0,
      smallBlind: 1,
      bigBlind: 2,
      rng: mulberry32(2),
    })
    // Fold round to the opener, who opens; the next seat 3-bets.
    while (s.toActIndex !== openerSeat) s = applyAction(s, { type: 'fold' })
    s = applyAction(s, { type: 'raise', amount: 6 })
    const threeBetter = s.players[s.toActIndex]
    s = applyAction(s, { type: 'raise', amount: 18 })
    const me = s.players[s.toActIndex]
    const w = opponentRanges(s, me, [threeBetter], undefined, 1, {}, percentile)[0]
    return w.reduce((a, b) => a + b, 0)
  }
  // Under the gun is seat 3; the button is seat 0.
  t.true(threeBetRange(0, true) > 1.5 * threeBetRange(3, true))
  t.true(Math.abs(threeBetRange(0, false) / threeBetRange(3, false) - 1) < 0.1)
})
