// The second round of the `weightedRanges` experiment (`AiExperiment.rangeTuning`,
// version `wrange2`). Each part is pinned on a spot where it has to move the
// decision, and off it has to leave the first round exactly as it was.

import test from 'ava'
import { createTableMemory, type TableMemory } from '@/lib/poker/ai/memory'
import { type AiExperiment, type AiProfile, decideAction } from '@/lib/poker/ai/policy'
import { FLOOR, opponentRanges, TUNED_FLOOR } from '@/lib/poker/ai/weightedRange'
import { cardFromString, mulberry32 } from '@/lib/poker/cards'
import { COMBO_A, COMBO_B, COMBOS, cardIndex, comboIndex } from '@/lib/poker/combos'
import { type Action, applyAction, type HandState, startHand } from '@/lib/poker/engine'
import { venueById, type Venue } from '@/config/venues'

const cards = (s: string) => s.split(' ').map(cardFromString)
const BOARD = 'Kh 8d 3c 2s 9h'
const WRANGE: AiExperiment = { fastShowdown: true, weightedRanges: true }
const mainEvent = (venueById('mainevent') as Venue).ai

/** Heads-up: the hero raises the button, the villain calls, then `after`. */
function spot(after: Action[], hole = 'Ac Qc'): HandState {
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
  s.players[0].hole = cards(hole)
  return s
}

const check: Action = { type: 'check' }
const call: Action = { type: 'call' }
const bet = (amount: number): Action => ({ type: 'bet', amount })

/** A table that has watched the villain bet or raise every postflop decision for a while. */
function maniacMemory(): TableMemory {
  const memory = createTableMemory()
  memory.players.vil = {
    preflopRaise: { hits: 40, chances: 40 },
    postflopAggression: { hits: 40, chances: 40 },
    foldToBet: { hits: 0, chances: 20 },
  }
  return memory
}

const weight = (w: Float64Array, hole: string) => w[comboIndex(...(cards(hole) as [never, never]))]

test('wideReads keeps every live holding at the higher floor', (t) => {
  // The villain's range after check-calling two streets and checking the river.
  const s = spot([check, bet(6), call, check, bet(12), call, check])
  const w = opponentRanges(s, s.players[0], [s.players[1]], undefined, 1, { wideReads: true })[0]
  const dead = new Set(cards(`Ac Qc ${BOARD}`).map(cardIndex))
  let atFloor = 0
  for (let c = 0; c < COMBOS; c++) {
    if (dead.has(COMBO_A[c]) || dead.has(COMBO_B[c])) continue
    t.true(w[c] >= TUNED_FLOOR - 1e-12)
    if (w[c] < TUNED_FLOOR + 1e-9) atFloor++
  }
  t.true(atFloor > 0, 'the line pushes some holdings to the floor')
  t.true(TUNED_FLOOR > FLOOR)
})

test('flattenManiacs reads a maniac’s pot-sized bets as far less polarised', (t) => {
  // The villain leads the pot on every street and the hero calls.
  const s = spot([bet(12), call, bet(36), call, bet(108)])
  const range = (flattenManiacs: boolean, memory: TableMemory | undefined) =>
    opponentRanges(s, s.players[0], [s.players[1]], memory, 1, { flattenManiacs })[0]
  const air = (w: Float64Array) => (weight(w, 'Qd Jc') + weight(w, 'Ad 5c')) / 2
  const strong = (w: Float64Array) => (weight(w, 'Ks Qd') + weight(w, '9s 9d')) / 2
  const shape = (w: Float64Array) => air(w) / strong(w)
  const maniac = maniacMemory()
  t.true(shape(range(true, maniac)) > 3 * shape(range(false, maniac)))
  // A typical player's bets are read as before.
  t.deepEqual(range(true, undefined), range(false, undefined))
})

test('flattenManiacs reads a player who raises every hand as raising almost anything', (t) => {
  // Under the gun opens; seen raising 40 preflop decisions in 40.
  let s = startHand({
    seats: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `s${i}`, stack: 400 })),
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(2),
  })
  s = applyAction(s, { type: 'raise', amount: 6 })
  const memory = createTableMemory()
  memory.players.s3 = {
    preflopRaise: { hits: 40, chances: 40 },
    postflopAggression: { hits: 0, chances: 0 },
    foldToBet: { hits: 0, chances: 0 },
  }
  const range = (flattenManiacs: boolean, m: TableMemory | undefined) =>
    opponentRanges(s, s.players[4], [s.players[3]], m, 1, { flattenManiacs })[0]
  const mass = (w: Float64Array) => w.reduce((a, b) => a + b, 0)
  // The read open range is already as wide as the cap allows; flattening widens
  // it by a quarter again and lifts the hands below it off the floor.
  t.true(mass(range(true, memory)) > 1.2 * mass(range(false, memory)))
  t.true(weight(range(true, memory), '7c 2d') > weight(range(false, memory), '7c 2d'))
  // A typical opener is read as before.
  t.deepEqual(range(true, undefined), range(false, undefined))
})

test('halfTax folds the big blind to a steal less often', (t) => {
  // Six-handed, folded to the button, who opens; the small blind folds.
  const folds = (tuning: AiExperiment['rangeTuning']) => {
    let n = 0
    for (let i = 0; i < 60; i++) {
      let s = startHand({
        seats: Array.from({ length: 6 }, (_, k) => ({ id: `s${k}`, name: `s${k}`, stack: 200 })),
        buttonIndex: 0,
        smallBlind: 1,
        bigBlind: 2,
        rng: mulberry32(100 + i),
      })
      for (const a of [
        { type: 'fold' },
        { type: 'fold' },
        { type: 'fold' },
        { type: 'raise', amount: 5 },
        { type: 'fold' },
      ] as Action[])
        s = applyAction(s, a)
      const profile: AiProfile = {
        ...mainEvent,
        iterations: 200,
        experiment: { ...WRANGE, rangeTuning: tuning },
      }
      if (decideAction(s, profile, mulberry32(i)).type === 'fold') n++
    }
    return n
  }
  const full = folds(false)
  const half = folds({ halfTax: true })
  t.true(half < full, `${half} vs ${full}`)
})

test('riverBluffs keeps a showdown hand the shipped read would check', (t) => {
  // Bottom pair after betting flop and turn into a caller: the weighted range
  // reads the caller as made hands, so the pair looks like a bluff candidate;
  // the shipped read sees showdown value and checks it.
  const s = spot([check, bet(6), call, check, bet(12), call, check], 'Ah 3h')
  const bets = (rangeTuning: AiExperiment['rangeTuning']) => {
    let n = 0
    const profile: AiProfile = {
      ...mainEvent,
      iterations: 300,
      experiment: { ...WRANGE, rangeTuning },
    }
    for (let i = 0; i < 60; i++) if (decideAction(s, profile, mulberry32(i)).type !== 'check') n++
    return n
  }
  t.true(bets(false) > 15)
  t.is(bets({ riverBluffs: true }), 0)
  // Air is still bluffed: the gate only takes away what the shipped read would not bluff.
  const air = spot([check, bet(6), call, check, bet(12), call, check], 'Qc Tc')
  const profile: AiProfile = {
    ...mainEvent,
    iterations: 300,
    experiment: { ...WRANGE, rangeTuning: true },
  }
  let gated = 0
  for (let i = 0; i < 60; i++)
    if (decideAction(air, profile, mulberry32(i)).type !== 'check') gated++
  t.true(gated > 15)
})
