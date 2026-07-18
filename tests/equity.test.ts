import test from 'ava'
import { estimateEquity } from '@/lib/poker/equity'
import { mulberry32 } from '@/lib/poker/cards'
import { cardFromString, type Card } from '@/lib/poker/cards'

const h = (...s: string[]): Card[] => s.map(cardFromString)

test('pocket aces crush a single random opponent preflop', (t) => {
  const r = estimateEquity({
    hole: h('Ah', 'Ad'),
    opponents: 1,
    iterations: 2000,
    rng: mulberry32(7),
  })
  t.true(r.equity > 0.8, `expected >0.8, got ${r.equity}`)
})

test('equity falls as more opponents join', (t) => {
  const one = estimateEquity({
    hole: h('Ah', 'Ad'),
    opponents: 1,
    iterations: 2000,
    rng: mulberry32(1),
  })
  const five = estimateEquity({
    hole: h('Ah', 'Ad'),
    opponents: 5,
    iterations: 2000,
    rng: mulberry32(1),
  })
  t.true(five.equity < one.equity)
})

test('the nuts on the river has ~100% equity', (t) => {
  // Royal flush already made; nobody can beat it.
  const r = estimateEquity({
    hole: h('Ah', 'Kh'),
    community: h('Qh', 'Jh', 'Th', '2c', '3d'),
    opponents: 2,
    iterations: 500,
    rng: mulberry32(3),
  })
  t.is(r.equity, 1)
})

test('same seed gives a reproducible estimate', (t) => {
  const a = estimateEquity({
    hole: h('7c', '2d'),
    opponents: 3,
    iterations: 800,
    rng: mulberry32(99),
  })
  const b = estimateEquity({
    hole: h('7c', '2d'),
    opponents: 3,
    iterations: 800,
    rng: mulberry32(99),
  })
  t.is(a.equity, b.equity)
})

test('a tighter opponent range lowers a made hand’s equity', (t) => {
  // Two pair on a three-club board: strong vs a random hand, weaker once the
  // opponent is assumed to be holding a real (flush-leaning) range.
  const board = h('Ah', 'Kd', '7c')
  const common = { hole: h('Ac', 'Ks'), community: board, iterations: 4000 } as const
  const random = estimateEquity({ ...common, opponents: 1, rng: mulberry32(5) })
  const tight = estimateEquity({
    ...common,
    opponents: 1,
    opponentSelectivity: [0.8],
    rng: mulberry32(5),
  })
  t.true(
    tight.equity < random.equity,
    `expected tight < random, got ${tight.equity} vs ${random.equity}`,
  )
})

test('zero selectivity matches raw (random) equity', (t) => {
  const opts = { hole: h('Qh', 'Qd'), opponents: 2, iterations: 1500 } as const
  const raw = estimateEquity({ ...opts, rng: mulberry32(21) })
  const zeroed = estimateEquity({ ...opts, opponentSelectivity: [0, 0], rng: mulberry32(21) })
  t.is(raw.equity, zeroed.equity)
})

test('opponentSelectivity is reproducible under a fixed seed', (t) => {
  const opts = {
    hole: h('Jc', 'Jd'),
    community: h('9c', '4c', '2h'),
    opponents: 2,
    opponentSelectivity: [0.7, 0.5],
    iterations: 800,
  } as const
  const a = estimateEquity({ ...opts, rng: mulberry32(3) })
  const b = estimateEquity({ ...opts, rng: mulberry32(3) })
  t.is(a.equity, b.equity)
})
