import test from 'ava'
import { derivePlayStyle, STYLE_MIN_HANDS } from '@/lib/playStyle'
import { emptySeatStats, type SeatStats } from '@/lib/reads'

const stats = (over: Partial<SeatStats> = {}): SeatStats => ({ ...emptySeatStats(), ...over })

const archetypeCases = [
  {
    label: 'tight and passive',
    over: { handsDealt: 100, vpipHands: 41, raises: 1, calls: 2 },
    key: 'rock' as const,
    name: 'The Rock',
    looseness: 41 / 100,
    aggression: 1 / 3,
  },
  {
    label: 'loose at the 42 percent boundary and passive',
    over: { handsDealt: 100, vpipHands: 42, raises: 1, calls: 2 },
    key: 'station' as const,
    name: 'The Station',
    looseness: 42 / 100,
    aggression: 1 / 3,
  },
  {
    label: 'tight and aggressive at the one-half boundary',
    over: { handsDealt: 100, vpipHands: 41, raises: 1, calls: 1 },
    key: 'shark' as const,
    name: 'The Shark',
    looseness: 41 / 100,
    aggression: 1 / 2,
  },
  {
    label: 'loose and aggressive at both boundaries',
    over: { handsDealt: 100, vpipHands: 42, raises: 1, calls: 1 },
    key: 'maniac' as const,
    name: 'The Maniac',
    looseness: 42 / 100,
    aggression: 1 / 2,
  },
  {
    label: 'loose and aggressive above both boundaries',
    over: { handsDealt: 100, vpipHands: 43, raises: 2, calls: 1 },
    key: 'maniac' as const,
    name: 'The Maniac',
    looseness: 43 / 100,
    aggression: 2 / 3,
  },
]

test('derivePlayStyle names all four public archetypes at their observable boundaries', (t) => {
  for (const sample of archetypeCases) {
    const style = derivePlayStyle(stats(sample.over))

    t.is(style.key, sample.key, sample.label)
    t.is(style.name, sample.name, `${sample.label} name`)
    t.is(style.looseness, sample.looseness, `${sample.label} looseness`)
    t.is(style.aggression, sample.aggression, `${sample.label} aggression`)
  }
})

type RateAxis = 'looseness' | 'aggression' | 'foldToBet'

const zeroDenominatorCases: Array<{
  label: string
  over: Partial<SeatStats>
  axis: RateAxis
}> = [
  {
    label: 'no hands dealt',
    over: { handsDealt: 0, vpipHands: 0, raises: 2, calls: 1, betsFaced: 4, foldsToBet: 1 },
    axis: 'looseness',
  },
  {
    label: 'no raises or calls',
    over: { handsDealt: 10, vpipHands: 5, raises: 0, calls: 0, betsFaced: 4, foldsToBet: 1 },
    axis: 'aggression',
  },
  {
    label: 'no bets faced',
    over: { handsDealt: 10, vpipHands: 5, raises: 1, calls: 1, betsFaced: 0, foldsToBet: 0 },
    axis: 'foldToBet',
  },
]

test('derivePlayStyle returns zero for each empty rate denominator', (t) => {
  for (const sample of zeroDenominatorCases) {
    const style = derivePlayStyle(stats(sample.over))
    t.is(style[sample.axis], 0, sample.label)
  }
})

const readinessCases = [
  {
    label: 'below the minimum sample',
    hands: STYLE_MIN_HANDS - 1,
    ready: false,
    key: 'maniac' as const,
    name: 'The Maniac',
  },
  {
    label: 'at the minimum sample',
    hands: STYLE_MIN_HANDS,
    ready: true,
    key: 'maniac' as const,
    name: 'The Maniac',
  },
]

test('derivePlayStyle gates readiness without losing a valid classification', (t) => {
  for (const sample of readinessCases) {
    const style = derivePlayStyle(
      stats({
        handsDealt: sample.hands,
        vpipHands: Math.floor(sample.hands / 2),
        raises: 1,
        calls: 1,
      }),
    )

    t.is(style.ready, sample.ready, sample.label)
    t.is(style.key, sample.key, `${sample.label} key`)
    t.is(style.name, sample.name, `${sample.label} name`)
  }
})
