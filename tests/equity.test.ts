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
