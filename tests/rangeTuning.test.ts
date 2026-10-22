// The second round of the `weightedRanges` experiment (`AiExperiment.rangeTuning`,
// version `wrange2`). Each part is pinned on a spot where it has to move the
// decision, and off it has to leave the first round exactly as it was.

import test from 'ava'
import { createTableMemory, observeAction, ratesFor, type TableMemory } from '@/lib/poker/ai/memory'
import { type AiExperiment, type AiProfile, decideAction } from '@/lib/poker/ai/policy'
import { FLOOR, opponentRanges, TUNED_FLOOR } from '@/lib/poker/ai/weightedRange'
import { cardFromString, mulberry32 } from '@/lib/poker/cards'
import { CARD_AT, COMBO_A, COMBO_B, COMBOS, cardIndex, comboIndex } from '@/lib/poker/combos'
import { type Action, applyAction, type HandState, startHand } from '@/lib/poker/engine'
import { preflopPercentile } from '@/lib/poker/range'
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

/**
 * Six-handed, button s0: under the gun (s3) goes all in for 100 big blinds,
 * or opens to three, and s4 is next with four players still behind it.
 */
function shoveSpot(allIn = true, hole = 'Qc Qd'): HandState {
  let s = startHand({
    seats: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `s${i}`, stack: 200 })),
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(4),
  })
  s = applyAction(s, { type: 'raise', amount: allIn ? 200 : 6 })
  s.players[4].hole = cards(hole)
  return s
}

/** A table that has watched s3 go all in on 18 of 40 preflop decisions. */
function shoverMemory(): TableMemory {
  const memory = createTableMemory()
  memory.players.s3 = {
    preflopRaise: { hits: 18, chances: 40 },
    postflopAggression: { hits: 0, chances: 0 },
    foldToBet: { hits: 22, chances: 40 },
    shove: { hits: 18, chances: 40 },
  }
  return memory
}

test('the memory counts all-in raises before the flop, and nothing else', (t) => {
  const memory = createTableMemory()
  const s = shoveSpot(false)
  observeAction(memory, s, { type: 'raise', amount: 200 })
  t.deepEqual(memory.players.s4.shove, { hits: 1, chances: 1 })
  observeAction(memory, s, { type: 'raise', amount: 12 })
  t.deepEqual(memory.players.s4.shove, { hits: 1, chances: 2 })
  t.true(ratesFor(memory, 's4').shove > ratesFor(undefined, 's4').shove)
})

test('shoveReads reads a shove as wide as the player shoves, and does not flatten it', (t) => {
  const range = (shoveReads: boolean, s: HandState) =>
    opponentRanges(s, s.players[4], [s.players[3]], shoverMemory(), 0.64, {
      flattenManiacs: true,
      shoveReads,
    })[0]
  // Mean weight of the holdings between two percentiles.
  const band = (w: Float64Array, lo: number, hi: number) => {
    let sum = 0
    let n = 0
    for (let c = 0; c < COMBOS; c++) {
      const p = preflopPercentile([CARD_AT[COMBO_A[c]], CARD_AT[COMBO_B[c]]])
      if (w[c] > 0 && p >= lo && p < hi) {
        sum += w[c]
        n++
      }
    }
    return sum / n
  }
  // In the top 45% but outside a regular's under-the-gun opening range,
  // which is where the read off position put the shove.
  const shove = shoveSpot()
  t.true(band(range(true, shove), 0.6, 0.7) > 1.5 * band(range(false, shove), 0.6, 0.7))
  // An open that is not all in is read as before.
  const open = shoveSpot(false)
  t.deepEqual(range(true, open), range(false, open))
})

test('shoveReads calls a shove on its equity against the shover, not the players behind', (t) => {
  const decide = (tuning: AiExperiment['rangeTuning'], seed: number) =>
    decideAction(
      shoveSpot(),
      { ...mainEvent, iterations: 400, experiment: { ...WRANGE, rangeTuning: tuning } },
      mulberry32(seed),
      shoverMemory(),
    ).type
  const all = { wideReads: true, flattenManiacs: true, halfTax: true, riverBluffs: true }
  for (let seed = 1; seed <= 5; seed++) {
    // Queens hold about 73% against the top 45%, far over the price; against
    // that and four random hands they do not clear it.
    t.is(decide({ ...all, shoveReads: true }, seed), 'call', `${seed}`)
    t.is(decide(all, seed), 'fold', `${seed}`)
  }
})

test('shoveReads pays the bare price for a shove over its open, with a deep caller still in', (t) => {
  // s3 opens and s4 shoves its 50 big blinds over it; the big blind, as deep
  // as s3, calls. s3's call does not put it all in, and the big blind could
  // still bet after it, but against the shove it is a showdown all the same.
  const spot = (hole: string) => {
    let s = startHand({
      seats: Array.from({ length: 6 }, (_, i) => ({
        id: `s${i}`,
        name: `s${i}`,
        stack: i === 4 ? 100 : 400,
      })),
      buttonIndex: 0,
      smallBlind: 1,
      bigBlind: 2,
      rng: mulberry32(4),
    })
    for (const a of [
      { type: 'raise', amount: 6 },
      { type: 'raise', amount: 100 },
      { type: 'fold' },
      { type: 'fold' },
      { type: 'fold' },
      call,
    ] as Action[])
      s = applyAction(s, a)
    s.players[3].hole = cards(hole)
    return s
  }
  const all = { wideReads: true, flattenManiacs: true, halfTax: true, riverBluffs: true }
  const decide = (hole: string, shoveReads: boolean, seed: number) =>
    decideAction(
      spot(hole),
      {
        ...mainEvent,
        iterations: 400,
        experiment: {
          ...WRANGE,
          preflopRanges: true,
          threeBetReads: true,
          rangeTuning: { ...all, shoveReads },
        },
      },
      mulberry32(seed),
    ).type
  // Middling pairs clear the bare price three-way and not the price a call
  // that buys a flop is asked for.
  for (const hole of ['9c 9d', '8c 8d']) {
    for (let seed = 1; seed <= 5; seed++) {
      t.is(decide(hole, true, seed), 'call', `${hole} ${seed}`)
      t.not(decide(hole, false, seed), 'call', `${hole} ${seed}`)
    }
  }
})

test('a short stack calling all in for the price is not a shove', (t) => {
  // s3 opens to three big blinds and s4, with exactly that left, calls all in.
  // s3 still has chips: s5 faces an open, not a shove, and shoveReads must
  // leave it as it was.
  const spot = (hole: string) => {
    let s = startHand({
      seats: Array.from({ length: 6 }, (_, i) => ({
        id: `s${i}`,
        name: `s${i}`,
        stack: i === 4 ? 6 : 400,
      })),
      buttonIndex: 0,
      smallBlind: 1,
      bigBlind: 2,
      rng: mulberry32(4),
    })
    s = applyAction(s, { type: 'raise', amount: 6 })
    s = applyAction(s, call)
    s.players[5].hole = cards(hole)
    return s
  }
  t.is(spot('2c 3d').players[4].status, 'allin')
  const all = { wideReads: true, flattenManiacs: true, halfTax: true, riverBluffs: true }
  const decide = (hole: string, shoveReads: boolean, seed: number) =>
    decideAction(
      spot(hole),
      {
        ...mainEvent,
        iterations: 200,
        experiment: {
          ...WRANGE,
          preflopRanges: true,
          threeBetReads: true,
          rangeTuning: { ...all, shoveReads },
        },
      },
      mulberry32(seed),
    )
  for (const hole of ['Ac Jd', 'Tc Td', 'Kh Qh', '7c 7d', 'Ah 5h'])
    for (let seed = 1; seed <= 4; seed++)
      t.deepEqual(decide(hole, true, seed), decide(hole, false, seed), `${hole} ${seed}`)
})
