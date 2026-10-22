// The `weightedRanges` experiment: opponents read as a weight on every holding,
// reweighted by each action (`src/lib/poker/ai/weightedRange.ts`). These pin the
// shapes it exists to draw, which one selectivity number cannot: a range capped
// by checking and calling, and a river overbet polarised into value and air.

import test from 'ava'
import { createTableMemory, observeAction, observeHandEnd, ratesFor } from '@/lib/poker/ai/memory'
import { type AiProfile, decideAction } from '@/lib/poker/ai/policy'
import { boardStrengths, FLOOR, opponentRanges } from '@/lib/poker/ai/weightedRange'
import { cardFromString, mulberry32 } from '@/lib/poker/cards'
import { COMBO_A, COMBO_B, COMBOS, cardIndex, comboCards, comboIndex } from '@/lib/poker/combos'
import {
  type Action,
  applyAction,
  type HandState,
  isHandComplete,
  legalActions,
  startHand,
} from '@/lib/poker/engine'
import { estimateEquity } from '@/lib/poker/equity'
import { venueById, type Venue } from '@/config/venues'

const cards = (s: string) => s.split(' ').map(cardFromString)
const BOARD = 'Kh 8d 3c 2s 9h'

/**
 * Heads-up, the hero on the button raises and the villain in the big blind
 * calls, then `after` plays out. The board and the hero's cards are set by
 * hand, since only the log and the cards on the table are read.
 */
function spot(after: Action[]): HandState {
  let s = startHand({
    seats: [
      { id: 'hero', name: 'hero', stack: 400 },
      { id: 'vil', name: 'vil', stack: 400 },
    ],
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(1),
  })
  for (const a of [{ type: 'raise', amount: 6 } as Action, { type: 'call' } as Action, ...after])
    s = applyAction(s, a)
  s.community = cards(BOARD).slice(0, s.community.length)
  s.players[0].hole = cards('Ac Qc')
  return s
}

function villainRange(s: HandState): Float64Array {
  return opponentRanges(s, s.players[0], [s.players[1]], undefined, 1)[0]
}

const weight = (w: Float64Array, hole: string) => {
  const [a, b] = cards(hole)
  return w[comboIndex(a, b)]
}

const check: Action = { type: 'check' }
const call: Action = { type: 'call' }
const bet = (amount: number): Action => ({ type: 'bet', amount })

test('combo indices cover every two-card holding once, in either order', (t) => {
  const seen = new Set<string>()
  for (let c = 0; c < COMBOS; c++) {
    const [x, y] = comboCards(c)
    t.is(comboIndex(x, y), c)
    t.is(comboIndex(y, x), c)
    t.true(COMBO_A[c] < COMBO_B[c])
    seen.add(`${cardIndex(x)}-${cardIndex(y)}`)
  }
  t.is(seen.size, 1326)
})

test('every live holding keeps at least the floor; dead cards weigh nothing', (t) => {
  const w = villainRange(spot([check, bet(6), call, check, bet(12), call, bet(60)]))
  const dead = new Set(cards(`Ac Qc ${BOARD}`).map(cardIndex))
  for (let c = 0; c < COMBOS; c++) {
    if (dead.has(COMBO_A[c]) || dead.has(COMBO_B[c])) t.is(w[c], 0)
    else t.true(w[c] >= FLOOR && w[c] <= 1)
  }
})

test('a preflop 3-bet range is narrower than an open, and an open keeps aces', (t) => {
  let s = startHand({
    seats: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `s${i}`, stack: 400 })),
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(2),
  })
  // Under the gun (s3) opens; s4 3-bets.
  s = applyAction(s, { type: 'raise', amount: 6 })
  const opener = s.players[3]
  const openRange = opponentRanges(s, s.players[4], [opener], undefined, 1)[0]
  s = applyAction(s, { type: 'raise', amount: 18 })
  const threeBettor = s.players[4]
  const threeBetRange = opponentRanges(s, s.players[5], [threeBettor], undefined, 1)[0]
  const mass = (w: Float64Array) => w.reduce((a, b) => a + b, 0)
  t.true(mass(threeBetRange) < mass(openRange) * 0.75)
  t.true(weight(openRange, 'As Ad') > 0.95)
  t.true(weight(openRange, '7c 2d') <= 0.02)
})

test('checking and calling twice caps a range: sets fade against one pair', (t) => {
  const before = villainRange(spot([]))
  const capped = villainRange(spot([check, bet(6), call, check, bet(12), call]))
  // Relative to top pair, a set is much rarer after the passive line.
  const setVsPair = (w: Float64Array) => weight(w, '8h 8s') / weight(w, 'Ks Jd')
  t.true(setVsPair(capped) < setVsPair(before) * 0.6)
})

test('a check reads as one to the raiser only while the raiser is still in', (t) => {
  // Three-handed: the raiser on the button, the villain in the small blind, the
  // hero in the big. On the flop the villain checks, the hero bets, and the
  // raiser folds or calls before the villain calls; then the villain checks the turn.
  const hand = (raiser: Action, turn: Action[]) => {
    let s = startHand({
      seats: ['r', 'vil', 'hero'].map((id) => ({ id, name: id, stack: 400 })),
      buttonIndex: 0,
      smallBlind: 1,
      bigBlind: 2,
      rng: mulberry32(1),
    })
    for (const a of [{ type: 'raise', amount: 6 } as Action, call, call]) s = applyAction(s, a)
    for (const a of [check, bet(6), raiser, call, ...turn]) s = applyAction(s, a)
    s.community = cards(BOARD).slice(0, s.community.length)
    s.players[2].hole = cards('Ac Qc')
    return opponentRanges(s, s.players[2], [s.players[1]], undefined, 1)[0]
  }
  const kept = (raiser: Action, holding: string) =>
    weight(hand(raiser, [check]), holding) / weight(hand(raiser, []), holding)
  const fold: Action = { type: 'fold' }
  // With the raiser still to act, strong hands check too; with the raiser gone
  // nobody is left to trap, and the check caps the range like any other.
  for (const holding of ['Kd Kc', 'Ks Qd'])
    t.true(kept(fold, holding) < kept(call, holding) - 0.1, holding)
})

test('a river overbet is polarised; a small river bet is not', (t) => {
  const quiet = [check, check, check, check]
  const big = villainRange(spot([...quiet, bet(20)]))
  const small = villainRange(spot([...quiet, bet(4)]))
  const air = (w: Float64Array) => (weight(w, '6c 5c') + weight(w, '7d 4d')) / 2
  const middle = (w: Float64Array) => (weight(w, '8h 7h') + weight(w, '8s 6s')) / 2
  t.true(air(big) / middle(big) > (air(small) / middle(small)) * 1.5)
  // And the hero's bluff-catcher does better against the polarised bet.
  const eq = (w: Float64Array) =>
    estimateEquity({
      hole: cards('Ac Qc'),
      community: cards(BOARD),
      opponents: 1,
      iterations: 3000,
      rng: mulberry32(3),
      opponentRanges: [w],
      fastShowdown: true,
    }).equity
  t.true(eq(big) > eq(small))
})

test('board strengths: the nuts on top, a blocked holding at -1, draws lifted', (t) => {
  const flop = boardStrengths(cards('Kh 8h 3c'))
  t.is(flop[comboIndex(...(cards('Kh 2d') as [never, never]))], -1)
  t.true(weight(flop, 'Kd Ks') > 0.99)
  // A flush draw is worth more than the same high cards without one.
  t.true(weight(flop, 'Ah 4h') > weight(flop, 'Ad 4c'))
})

test('board strengths are kept per board, and a kept table is the one a fresh build gives', (t) => {
  const board = cards('Qs Jd 4h 7c')
  const first = Float64Array.from(boardStrengths(board))
  t.is(boardStrengths(board), boardStrengths([...board]))
  // Enough other boards to push it out, then build it again.
  for (const extra of ['2c', '3c', '5c', '6c', '8c', '9c', 'Tc', 'Jc', 'Kc', 'Ac']) {
    boardStrengths([...board, cardFromString(extra)])
  }
  t.deepEqual(Float64Array.from(boardStrengths(board)), first)
})

test('estimateEquity samples from a weighted range', (t) => {
  // A range of only kings: aces hold about 81% against it.
  const w = new Float64Array(COMBOS)
  for (const [x, y] of [
    ['Kc', 'Kd'],
    ['Kc', 'Kh'],
    ['Kc', 'Ks'],
    ['Kd', 'Kh'],
    ['Kd', 'Ks'],
    ['Kh', 'Ks'],
  ]) {
    w[comboIndex(cardFromString(x), cardFromString(y))] = 1
  }
  const { equity } = estimateEquity({
    hole: cards('As Ah'),
    opponents: 1,
    iterations: 4000,
    rng: mulberry32(9),
    opponentRanges: [w],
    fastShowdown: true,
  })
  t.true(equity > 0.77 && equity < 0.86, `${equity}`)
})

test('overlapping weighted ranges give the same equity in either order', (t) => {
  // Three legal joint holdings, equally likely: the hero's queens win one.
  const range = (...holes: string[]) => {
    const w = new Float64Array(COMBOS)
    for (const h of holes) w[comboIndex(...(cards(h) as [never, never]))] = 1
    return w
  }
  const x = range('As Ad', 'Ks Kd')
  const y = range('As Ah', 'Jc Jd')
  const eq = (ranges: Float64Array[]) =>
    estimateEquity({
      hole: cards('Qs Qd'),
      community: cards('Kh Qh 2c 3c 4d'),
      opponents: 2,
      iterations: 6000,
      rng: mulberry32(4),
      opponentRanges: ranges,
      fastShowdown: true,
    }).equity
  for (const e of [eq([x, y]), eq([y, x])]) t.true(Math.abs(e - 1 / 3) < 0.03, `${e}`)
})

test('memory counts 3-bets, folds to c-bets and showdowns', (t) => {
  const memory = createTableMemory()
  let s = startHand({
    seats: [
      { id: 'hero', name: 'hero', stack: 400 },
      { id: 'vil', name: 'vil', stack: 400 },
    ],
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(1),
  })
  const play = (a: Action) => {
    observeAction(memory, s, a)
    s = applyAction(s, a)
  }
  // The hero opens the button, the villain 3-bets and c-bets, the hero folds.
  play({ type: 'raise', amount: 6 })
  play({ type: 'raise', amount: 18 })
  play(call)
  play(bet(20))
  play({ type: 'fold' })
  observeHandEnd(memory, s)
  t.deepEqual(memory.players.vil.threeBet, { hits: 1, chances: 1 })
  t.deepEqual(memory.players.hero.foldToCbet, { hits: 1, chances: 1 })
  t.deepEqual(memory.players.hero.wtsd, { hits: 0, chances: 1 })
  t.deepEqual(memory.players.vil.wtsd, { hits: 0, chances: 1 })
  t.true(ratesFor(memory, 'vil').threeBet > ratesFor(undefined, 'vil').threeBet)
})

test('memory counts no flop seen when the board is run out after everybody is all in before it', (t) => {
  const memory = createTableMemory()
  let s = startHand({
    seats: ['a', 'b', 'c'].map((id) => ({ id, name: id, stack: 40 })),
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(5),
  })
  let shoved = false
  while (!isHandComplete(s)) {
    const legal = legalActions(s)
    const a: Action =
      !shoved && legal?.canRaise ? { type: 'raise', amount: legal.maxRaiseTo } : call
    shoved = true
    observeAction(memory, s, a)
    s = applyAction(s, a)
  }
  observeHandEnd(memory, s)
  t.is(s.community.length, 5)
  t.true(!!s.result?.showdown)
  for (const id of ['a', 'b', 'c']) t.is(memory.players[id].wtsd, undefined, id)
})

test('wrange plays legal, repeatable hands at every rung', (t) => {
  for (const id of ['garage', 'cardroom', 'mainevent']) {
    const venue = venueById(id) as Venue
    const profile: AiProfile = {
      ...venue.ai,
      iterations: 60,
      experiment: { fastShowdown: true, weightedRanges: true },
    }
    const run = () => {
      const rng = mulberry32(5)
      const memory = createTableMemory()
      const log: string[] = []
      for (let hand = 0; hand < 8; hand++) {
        let s = startHand({
          seats: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `s${i}`, stack: 200 })),
          buttonIndex: hand % 6,
          smallBlind: 1,
          bigBlind: 2,
          rng,
        })
        while (!isHandComplete(s)) {
          const a = decideAction(s, profile, rng, memory)
          const legal = legalActions(s)
          t.truthy(legal)
          if (a.type === 'check') t.true(legal?.canCheck)
          if (a.type === 'call') t.true(legal?.canCall)
          log.push(`${a.type}${a.amount ?? ''}`)
          observeAction(memory, s, a)
          s = applyAction(s, a)
        }
        observeHandEnd(memory, s)
      }
      return log.join(';')
    }
    t.is(run(), run(), id)
  }
})
