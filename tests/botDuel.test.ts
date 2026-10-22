// The duel harness (`pnpm bot-duel`) and the per-seat tracker it reports with.
//
// Same split as tests/cashSim.test.ts. The poker half is asserted exactly: a
// policy against itself scores exactly zero on every deal, a run is the same
// run every time and the same run in slices, every chair is played by each
// side, and chips are conserved between them. Those are the properties that
// make a duel a measurement. Whether one AI is better than another is never
// asserted here: at the spread poker has, no sample a test can afford would
// tell, and a test that "passed" on one would pass whatever the code did.

import test from 'ava'
import {
  addTotals,
  CHUNK,
  configFrom,
  foldChunks,
  type DuelConfig,
  parseSide,
  playCashDeal,
  playSngDeal,
  runChunks,
  runDuel,
  type Side,
  seatPlan,
  summarize,
  type DuelTotals,
  emptyTotals,
} from '../scripts/bot-duel'
import { createHandTracker, emptySeatStats, isRiverBluff, rate } from '../scripts/table-stats'
import { cardFromString } from '@/lib/poker/cards'
import { applyAction, isHandComplete, legalActions, startHand } from '@/lib/poker/engine'
import { createTableMemory, observeAction, observeHandEnd } from '@/lib/poker/ai/memory'
import { decideAction } from '@/lib/poker/ai/policy'
import { mulberry32 } from '@/lib/poker/cards'
import { venueById, type Venue } from '@/config/venues'

const garage = venueById('garage') as Venue

/** A cheap duel: few seats, few sims, so a test can afford a few deals. */
const duel = (over: Partial<Parameters<typeof configFrom>[0]> = {}): DuelConfig =>
  configFrom({
    venueId: 'garage',
    a: 'v1',
    b: 'v1',
    seats: 3,
    layout: 'alternate',
    mode: 'cash',
    seed: 7,
    stackBb: 100,
    itersCap: 40,
    ...over,
  })

const cards = (s: string) => s.split(' ').map(cardFromString)

// --- the poker half ----------------------------------------------------------

test('a policy against itself scores exactly zero on every cash deal', (t) => {
  // The property the measurement rests on: chairs own their decision streams,
  // so two sides that play alike play the same hand, and only a difference in
  // play can move the score.
  for (const layout of ['alternate', 'solo'] as const) {
    const cfg = duel({ layout, seats: 4 })
    for (let d = 0; d < 4; d++) t.is(playCashDeal(cfg, d).x, 0, `${layout} deal ${d}`)
  }
})

test('a policy against itself scores exactly zero in a sit-and-go', (t) => {
  t.is(playSngDeal(duel({ mode: 'sng' }), 0).x, 0)
})

test('a shover against a folder wins on every deal, so the sign points the right way', (t) => {
  // The folder never puts a chip in voluntarily and the shover never folds, so
  // chips can only move from the folder's side to the shover's. It must post
  // a blind on some pass, so every deal is strictly positive for A.
  const side = (label: string, decide: Side['decide']): Side => ({
    label,
    profile: garage.ai,
    decide,
  })
  const shover = side('shover', (state) => {
    const legal = legalActions(state)
    if (legal?.canRaise) return { type: 'raise', amount: legal.maxRaiseTo }
    if (legal?.canBet) return { type: 'bet', amount: legal.maxRaiseTo }
    return legal?.canCheck ? { type: 'check' } : { type: 'call' }
  })
  const folder = side('folder', (state) =>
    legalActions(state)?.canCheck ? { type: 'check' } : { type: 'fold' },
  )
  const cfg = { ...duel(), a: shover, b: folder }
  for (let d = 0; d < 3; d++) t.true(playCashDeal(cfg, d).x > 0, `deal ${d}`)
  const flipped = { ...duel(), a: folder, b: shover }
  for (let d = 0; d < 3; d++) t.true(playCashDeal(flipped, d).x < 0, `flipped deal ${d}`)
})

test('the same seed is the same run, and slices add up to the whole', (t) => {
  const cfg = duel({ a: 'v1@cardroom' })
  const whole = runDuel(cfg, 0, 4)
  t.deepEqual(runDuel(cfg, 0, 4), whole)
  t.deepEqual(addTotals(runDuel(cfg, 0, 1), runDuel(cfg, 1, 4)), whole)
  t.notDeepEqual(runDuel(duel({ a: 'v1@cardroom', seed: 8 }), 0, 4), whole)
})

test('a run is folded a fixed chunk at a time, so any split of chunks gives the same bits', (t) => {
  // Workers each take consecutive chunks; the parent folds every chunk in
  // order. Splitting the chunks differently must not move a single bit.
  const cfg = duel({ a: 'v1@cardroom', itersCap: 20 })
  const deals = CHUNK * 2 + 3
  const whole = foldChunks(runChunks(cfg, deals, 0, 3))
  t.is(whole.deals, deals)
  t.deepEqual(foldChunks([...runChunks(cfg, deals, 0, 1), ...runChunks(cfg, deals, 1, 3)]), whole)
  t.deepEqual(foldChunks([...runChunks(cfg, deals, 0, 2), ...runChunks(cfg, deals, 2, 3)]), whole)
})

test('chips are conserved between the sides', (t) => {
  const r = playCashDeal(duel({ a: 'v1@cardroom', seats: 3 }), 2)
  t.is(Math.round((r.stats.a.netBb + r.stats.b.netBb) * 1e9), 0)
})

test('every chair is played by each side, in either layout', (t) => {
  for (const seats of [2, 3, 6, 8]) {
    const alternate = seatPlan('alternate', seats)
    t.is(alternate.length, 2)
    for (let chair = 0; chair < seats; chair++) {
      t.deepEqual(alternate.map((p) => p[chair]).sort(), ['a', 'b'])
    }
    const solo = seatPlan('solo', seats)
    t.is(solo.length, seats)
    for (let chair = 0; chair < seats; chair++) {
      t.is(solo.filter((p) => p[chair] === 'a').length, 1)
      t.is(solo[chair].filter((s) => s === 'a').length, 1)
    }
  }
})

// --- reading a side ----------------------------------------------------------

test('a side starts from a venue profile and takes overrides', (t) => {
  const side = parseSide('v1@mainevent:iterations=99,skill=0.5,habit=caller', garage)
  t.is(side.profile.iterations, 99)
  t.is(side.profile.skill, 0.5)
  t.is(side.profile.habit, 'caller')
  t.is(side.profile.tightness, (venueById('mainevent') as Venue).ai.tightness)
  t.deepEqual(parseSide('v1', garage).profile, garage.ai)
  t.throws(() => parseSide('nope', garage))
  t.throws(() => parseSide('v1@nowhere', garage))
  t.throws(() => parseSide('v1:speed=3', garage))
})

// --- the statistics half -----------------------------------------------------

const totals = (xs: number[]): DuelTotals => ({
  ...emptyTotals(),
  deals: xs.length,
  sum: xs.reduce((a, b) => a + b, 0),
  sumSq: xs.reduce((a, b) => a + b * b, 0),
})

test('summarize: cash is bb/100 with a 95% interval from the spread between deals', (t) => {
  const s = summarize(totals([1, -1, 1, -1]), 'cash')
  t.is(s.mean, 0)
  // Sample sd of [1,-1,1,-1] is sqrt(4/3); the band is 1.96 * sd / sqrt(4) per hand.
  t.is(s.ci95.toFixed(6), ((1.96 * Math.sqrt(4 / 3) * 100) / 2).toFixed(6))
  t.true(s.straddlesZero)
  const sure = summarize(totals([2, 2.1, 1.9, 2]), 'cash')
  t.false(sure.straddlesZero)
  t.is(Math.round(sure.mean), 200)
})

test('summarize: one deal has no spread, so its interval is infinite', (t) => {
  t.is(summarize(totals([3]), 'sng').ci95, Number.POSITIVE_INFINITY)
  t.is(summarize(emptyTotals(), 'cash').deals, 0)
})

test('a river bet is a bluff when it beats under half of what the other player could hold', (t) => {
  const board = cards('Kd 9c 5s 2h 3d')
  t.false(isRiverBluff(cards('Kh Ks'), board))
  t.false(isRiverBluff(cards('Ac Kc'), board))
  t.true(isRiverBluff(cards('7c 4h'), cards('Kd Qc Js 9h 2d')))
})

test('the tracker counts every dealt-in seat once a hand and nets their chips', (t) => {
  const rng = mulberry32(3)
  const stats = { s0: emptySeatStats(), s1: emptySeatStats(), s2: emptySeatStats() }
  for (let h = 0; h < 5; h++) {
    let state = startHand({
      seats: ['s0', 's1', 's2'].map((id) => ({ id, name: id, stack: 200 })),
      buttonIndex: h % 3,
      smallBlind: 1,
      bigBlind: 2,
      rng,
    })
    const tracker = createHandTracker((id) => stats[id as keyof typeof stats])
    while (!isHandComplete(state)) {
      const action = decideAction(state, { ...garage.ai, iterations: 30 }, rng)
      tracker.observe(state, action)
      state = applyAction(state, action)
    }
    tracker.finish(state, { s0: 200, s1: 200, s2: 200 })
  }
  const all = Object.values(stats)
  t.true(all.every((s) => s.hands === 5 && s.stat.vpip.chances === 5))
  t.is(Math.round(all.reduce((n, s) => n + s.netBb, 0) * 1e9), 0)
  t.true(all.every((s) => (rate(s.stat.pfr) ?? 0) <= (rate(s.stat.vpip) ?? 0)))
})

test('a duel refuses a venue that is not Hold’em rather than deal it Hold’em', (t) => {
  for (const venueId of ['shortdeck-1000', 'bigpot', 'hilo-2000', 'draw-1000']) {
    t.throws(() => duel({ venueId }), { message: /not Hold'em/ }, venueId)
  }
  t.notThrows(() => duel({ venueId: 'cardroom' }))
})

test('a board run out after everyone is all in before the flop is no flop seen, but a showdown', (t) => {
  const stats = { s0: emptySeatStats(), s1: emptySeatStats(), s2: emptySeatStats() }
  let state = startHand({
    seats: ['s0', 's1', 's2'].map((id) => ({ id, name: id, stack: 40 })),
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(5),
  })
  const tracker = createHandTracker((id) => stats[id as keyof typeof stats])
  let shoved = false
  while (!isHandComplete(state)) {
    const legal = legalActions(state)!
    const action =
      !shoved && legal.canRaise
        ? { type: 'raise' as const, amount: legal.maxRaiseTo }
        : { type: 'call' as const }
    shoved = true
    tracker.observe(state, action)
    state = applyAction(state, action)
  }
  tracker.finish(state, { s0: 40, s1: 40, s2: 40 })
  t.is(state.community.length, 5)
  t.true(!!state.result?.showdown)
  // Nobody bet the flop, so nobody saw one: the same read as `observeHandEnd`.
  // The showdown is still won or lost.
  for (const s of Object.values(stats)) {
    t.deepEqual(s.stat.wtsd, { hits: 0, chances: 0 })
    t.is(s.stat.wonAtShowdown.chances, 1)
  }
})

test('a seat all in before the flop sees no flop, beside two that check it down; the memory agrees', (t) => {
  const stats = { s0: emptySeatStats(), s1: emptySeatStats(), s2: emptySeatStats() }
  const memory = createTableMemory()
  // The short stack under the gun shoves, both blinds call and check it down.
  let state = startHand({
    seats: [
      { id: 's0', name: 's0', stack: 10 },
      { id: 's1', name: 's1', stack: 40 },
      { id: 's2', name: 's2', stack: 40 },
    ],
    buttonIndex: 0,
    smallBlind: 1,
    bigBlind: 2,
    rng: mulberry32(5),
  })
  const tracker = createHandTracker((id) => stats[id as keyof typeof stats])
  while (!isHandComplete(state)) {
    const legal = legalActions(state)!
    const me = state.players[state.toActIndex]
    const action =
      me.id === 's0' && legal.canRaise
        ? { type: 'raise' as const, amount: legal.maxRaiseTo }
        : legal.canCheck
          ? { type: 'check' as const }
          : { type: 'call' as const }
    tracker.observe(state, action)
    observeAction(memory, state, action)
    state = applyAction(state, action)
  }
  tracker.finish(state, { s0: 10, s1: 40, s2: 40 })
  observeHandEnd(memory, state)
  t.true(!!state.result?.showdown)
  t.deepEqual(stats.s0.stat.wtsd, { hits: 0, chances: 0 })
  t.is(memory.players.s0.wtsd, undefined)
  for (const id of ['s1', 's2'] as const) {
    t.deepEqual(stats[id].stat.wtsd, { hits: 1, chances: 1 }, id)
    t.deepEqual(memory.players[id].wtsd, { hits: 1, chances: 1 }, id)
  }
})

test('a big stack whose shove is called short wins at showdown only if it wins the called pot', (t) => {
  // The 180 chips nobody called come back to the big stack as a pot of its own.
  // That is not a win, so exactly one seat wins each hand, whoever holds the cards.
  let shortWon = 0
  for (let seed = 1; seed <= 12; seed++) {
    const stats = { big: emptySeatStats(), short: emptySeatStats() }
    let state = startHand({
      seats: [
        { id: 'big', name: 'big', stack: 200 },
        { id: 'short', name: 'short', stack: 20 },
      ],
      buttonIndex: 0,
      smallBlind: 1,
      bigBlind: 2,
      rng: mulberry32(seed),
    })
    const tracker = createHandTracker((id) => stats[id as keyof typeof stats])
    while (!isHandComplete(state)) {
      const legal = legalActions(state)!
      const action = legal.canRaise
        ? { type: 'raise' as const, amount: legal.maxRaiseTo }
        : { type: 'call' as const }
      tracker.observe(state, action)
      state = applyAction(state, action)
    }
    tracker.finish(state, { big: 200, short: 20 })
    const called = state.result!.potsAwarded.filter((a) => a.amount === 40)
    t.is(called.length, 1)
    if (called[0].winners.length > 1) continue // a split pot is a win for both
    t.is(stats.big.stat.wonAtShowdown.hits + stats.short.stat.wonAtShowdown.hits, 1)
    t.is(stats.short.stat.wonAtShowdown.hits === 1, called[0].winners[0] === 'short')
    if (called[0].winners[0] === 'short') shortWon++
  }
  t.true(shortWon > 0, 'no seed had the short stack win, so the case was never tried')
})
