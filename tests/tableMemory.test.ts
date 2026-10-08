import test from 'ava'
import {
  aiSelectivity,
  decideAction,
  opponentSelectivity,
  type AiProfile,
} from '@/lib/poker/ai/policy'
import {
  createTableMemory,
  credibility,
  observeAction,
  type TableMemory,
} from '@/lib/poker/ai/memory'
import { mulberry32 } from '@/lib/poker/cards'
import { applyAction, type HandState, potSize, startHand } from '@/lib/poker/engine'
import { venueById } from '@/config/venues'

const seats = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i === 0 ? 'hero' : `ai${i}`, name: 'x', stack: 200 }))

/** Hero raises the button, the blinds fold to the big blind, who calls. */
function openedPot(seed: number): HandState {
  const rng = mulberry32(seed)
  let s = startHand({ seats: seats(6), buttonIndex: 0, smallBlind: 1, bigBlind: 2, rng })
  while (s.players[s.toActIndex].id !== 'hero') s = applyAction(s, { type: 'fold' })
  s = applyAction(s, { type: 'raise', amount: 6 })
  s = applyAction(s, { type: 'fold' })
  return s
}

/** Teach a memory that the hero bets or raises every chance they get. */
function maniacMemory(): TableMemory {
  const memory = createTableMemory()
  for (let seed = 0; seed < 30; seed++) {
    const s = openedPot(seed)
    const flop = applyAction(s, { type: 'call' })
    const checked = applyAction(flop, { type: 'check' })
    observeAction(memory, checked, { type: 'bet', amount: 8 })
  }
  return memory
}

test('an unseen player reads as typical', (t) => {
  const memory = createTableMemory()
  t.is(credibility(memory, 'nobody', false), 1)
  t.is(credibility(undefined, 'nobody', true), 1)
})

test('a player who bets everything loses credibility, and one bet does not', (t) => {
  t.true(credibility(maniacMemory(), 'hero', false) < 0.5)

  const once = createTableMemory()
  const s = applyAction(applyAction(openedPot(1), { type: 'call' }), { type: 'check' })
  observeAction(once, s, { type: 'bet', amount: 8 })
  t.true(credibility(once, 'hero', false) > 0.75, 'one bet is shrunk toward typical')
})

test('a player who never bets earns credibility', (t) => {
  const memory = createTableMemory()
  for (let seed = 0; seed < 30; seed++) {
    const s = applyAction(applyAction(openedPot(seed), { type: 'call' }), { type: 'check' })
    observeAction(memory, s, { type: 'check' })
  }
  t.true(credibility(memory, 'hero', false) > 1)
})

test('a flop c-bet reads as a wider range than the chips-in read gives it', (t) => {
  const s = applyAction(
    applyAction(applyAction(openedPot(3), { type: 'call' }), { type: 'check' }),
    {
      type: 'bet',
      amount: 8,
    },
  )
  const hero = s.players.find((p) => p.id === 'hero')!
  t.true(aiSelectivity(s, hero) < opponentSelectivity(s, hero))
  t.true(aiSelectivity(s, hero, maniacMemory()) < aiSelectivity(s, hero))
})

test('preflop, the AI read is the chips-in read for a stranger', (t) => {
  const s = openedPot(4)
  const hero = s.players.find((p) => p.id === 'hero')!
  t.is(aiSelectivity(s, hero), opponentSelectivity(s, hero))
})

/** Fold rate of the Main Event's big blind, checked to on the flop, to a ⅔-pot c-bet. */
function cbetFoldRate(memory?: TableMemory): number {
  const ai: AiProfile = { ...venueById('mainevent')!.ai, iterations: 300 }
  const rng = mulberry32(42)
  let faced = 0
  let folded = 0
  for (let seed = 0; seed < 400 && faced < 60; seed++) {
    let s = openedPot(seed)
    const pre = decideAction(s, ai, rng, memory)
    if (pre.type !== 'call') continue
    s = applyAction(s, pre)
    const lead = decideAction(s, ai, rng, memory)
    if (lead.type !== 'check') continue
    s = applyAction(s, lead)
    s = applyAction(s, { type: 'bet', amount: Math.round(potSize(s) * 0.66) })
    faced++
    if (decideAction(s, ai, rng, memory).type === 'fold') folded++
  }
  if (faced < 30) throw new Error(`only ${faced} spots`)
  return folded / faced
}

/**
 * The hole a beginner found: raise, bet the flop with anything, and the top of
 * the ladder folded 71% of checked flops (`pnpm exploit-sim`, 2026-10-08). A
 * two-thirds pot bet profits with any two cards above 40%. Against somebody the
 * table has seen bet every time, it must not.
 */
test('the top table stops folding to a player it has seen bet everything', (t) => {
  const stranger = cbetFoldRate()
  const maniac = cbetFoldRate(maniacMemory())
  t.true(maniac < 0.4, `folded ${(maniac * 100).toFixed(0)}% to a known maniac`)
  t.true(stranger > maniac, 'a stranger still gets more credit than a known maniac')
})

test('the big blind defends wider against a player who raises every hand', (t) => {
  const ai: AiProfile = { ...venueById('mainevent')!.ai, iterations: 200 }
  const raiser = createTableMemory()
  for (let seed = 0; seed < 40; seed++) {
    const s = startHand({
      seats: seats(6),
      buttonIndex: 0,
      smallBlind: 1,
      bigBlind: 2,
      rng: mulberry32(seed),
    })
    let at = s
    while (at.players[at.toActIndex].id !== 'hero') at = applyAction(at, { type: 'fold' })
    observeAction(raiser, at, { type: 'raise', amount: 6 })
  }
  const folds = (memory?: TableMemory) => {
    const rng = mulberry32(9)
    let n = 0
    for (let seed = 0; seed < 200; seed++) {
      if (decideAction(openedPot(seed), ai, rng, memory).type === 'fold') n++
    }
    return n
  }
  t.true(folds(raiser) < folds())
})
