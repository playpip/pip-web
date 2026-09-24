import test from 'ava'
import { fastScore } from '@/lib/drills/riverRange'
import {
  CELL_BAND,
  CLASSES,
  CLASS_COUNT,
  CALLER_SPREAD,
  SHOVE_SEATS,
  STACKS,
  UNSEEN_COMBOS,
  behind,
  callValues,
  callerModels,
  chart,
  classIndex,
  classOf,
  compat,
  decodeRange,
  encodeRange,
  nashFor,
  rangeCombos,
  rangeShare,
  shoveEv,
} from '@/lib/drills/shoveRange'
import { TRIALS } from '@/lib/drills/shoveChart'
import { type Card, RANKS, SUITS, cardFromString, mulberry32 } from '@/lib/poker/cards'

// The short-stack model. What this file holds it to:
//
// 1. the chart is what it says it is — every cell re-sampled independently
//    lands inside the band the grade allows for;
// 2. the expected-value line is the game it describes — a hand-rolled
//    simulation of the same shove, dealt card by card, agrees with it;
// 3. the stored ranges are still a Nash equilibrium of the stored chart;
// 4. card removal is counted, not assumed.

const cards = (text: string): Card[] => text.split(' ').map(cardFromString)
const DECK: Card[] = RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })))
const key = (c: Card) => `${c.rank}${c.suit}`

/** One cell, sampled again from scratch with a different seed. */
function resample(i: number, j: number, trials: number, rng: () => number): number {
  const hero = CLASSES[i].combos[0]
  const dead = new Set(hero.map(key))
  const villains = CLASSES[j].combos.filter(([a, b]) => !dead.has(key(a)) && !dead.has(key(b)))
  let won = 0
  for (let t = 0; t < trials; t++) {
    const villain = villains[Math.floor(rng() * villains.length)]
    const out = new Set([...hero, ...villain].map(key))
    const rest = DECK.filter((c) => !out.has(key(c)))
    for (let k = 0; k < 5; k++) {
      const pick = k + Math.floor(rng() * (rest.length - k))
      ;[rest[k], rest[pick]] = [rest[pick], rest[k]]
    }
    const board = rest.slice(0, 5)
    const a = fastScore([...hero, ...board])
    const b = fastScore([...villain, ...board])
    won += a > b ? 1 : a === b ? 0.5 : 0
  }
  return won / trials
}

test('there are 169 hands and every two cards belong to exactly one', (t) => {
  t.is(CLASS_COUNT, 169)
  t.is(
    CLASSES.reduce((n, c) => n + c.combos.length, 0),
    1_326,
  )
  t.is(CLASSES[classOf(cards('As Kh'))].key, 'AKo')
  t.is(CLASSES[classOf(cards('7d 7c'))].key, '77')
  t.is(CLASSES[classOf(cards('5h 9h'))].key, '95s')
})

test('card removal is counted: every hand leaves 1,225 for somebody else', (t) => {
  for (let h = 0; h < CLASS_COUNT; h++) {
    let n = 0
    for (let c = 0; c < CLASS_COUNT; c++) n += compat(h, c)
    t.is(n, UNSEEN_COMBOS, CLASSES[h].key)
  }
  t.is(compat(classIndex('AA'), classIndex('AA')), 1, 'two aces left make one pair of them')
  t.is(compat(classIndex('AKo'), classIndex('AA')), 3)
  t.is(compat(classIndex('AKs'), classIndex('KK')), 3)
  t.is(compat(classIndex('72o'), classIndex('AA')), 6)
})

test('the chart agrees with the matchups everybody knows', (t) => {
  const eq = chart()
  const at = (a: string, b: string) => eq.get(classIndex(a), classIndex(b))
  const near = (value: number, expected: number, label: string) =>
    t.true(Math.abs(value - expected) < 0.015, `${label}: ${value.toFixed(3)} against ${expected}`)
  // Published all-in figures, to a point and a half.
  near(at('AA', 'KK'), 0.82, 'aces against kings')
  near(at('AKs', 'QQ'), 0.46, 'ace-king suited against queens')
  near(at('AKo', '22'), 0.47, 'ace-king against deuces')
  near(at('JTs', 'AKo'), 0.4, 'jack-ten suited against ace-king')
  near(at('AA', '72o'), 0.88, 'aces against seven-deuce')
  // The lower triangle is the mirror of the upper, exactly.
  for (let i = 0; i < CLASS_COUNT; i += 13) {
    for (let j = 0; j < CLASS_COUNT; j += 7) {
      t.true(Math.abs(eq.get(i, j) + eq.get(j, i) - 1) < 1e-12)
    }
  }
})

test('every cell re-sampled from scratch lands inside the band the grade allows', (t) => {
  // Two independent estimates of one cell differ by at most √2 × the band at
  // 95%; with 24 cells some would stray at 95%, so this holds them at 99.9%.
  const rng = mulberry32(4_242)
  const eq = chart()
  const bound = (3.29 / 1.96) * Math.SQRT2 * CELL_BAND + 1 / 4_095
  let worst = 0
  for (let k = 0; k < 24; k++) {
    const i = Math.floor(rng() * CLASS_COUNT)
    let j = Math.floor(rng() * CLASS_COUNT)
    if (j === i) j = (j + 1) % CLASS_COUNT
    const again = resample(i, j, TRIALS, rng)
    const gap = Math.abs(again - eq.get(i, j))
    worst = Math.max(worst, gap)
    t.true(gap <= bound, `${CLASSES[i].key} v ${CLASSES[j].key}: ${gap.toFixed(4)} > ${bound}`)
  }
  t.log(`worst of 24 cells ${(worst * 100).toFixed(2)} points, bound ${(bound * 100).toFixed(2)}`)
})

// The load-bearing one: the line of arithmetic, against the game played out.
// Deal the hero's cards, deal each player behind two real cards from what is
// left, let them call if their hand is in their range, and run the board. The
// only differences from the formula are the ones the model states — the players
// behind are not independent here, because they are dealt from one deck — so
// the two agree to within the simulation's own noise and that.
test('the expected value is the shove, played out card by card', (t) => {
  const rng = mulberry32(77)
  for (const [hand, spot] of [
    ['A7o', { seat: 'btn', stack: 8 }],
    ['K9s', { seat: 'co', stack: 12 }],
    ['55', { seat: 'sb', stack: 10 }],
    ['QTo', { seat: 'utg', stack: 6 }],
  ] as const) {
    const h = classIndex(hand)
    const nash = nashFor(spot)
    const formula = shoveEv(h, spot, nash.call).ev
    const hero = CLASSES[h].combos[0]
    const seats = behind(spot.seat)
    const risk = spot.stack - (spot.seat === 'sb' ? 0.5 : 0)
    const trials = 60_000
    let total = 0
    let sumSq = 0
    for (let n = 0; n < trials; n++) {
      const deck = DECK.filter((c) => !hero.some((x) => key(x) === key(c)))
      for (let k = deck.length - 1; k > 0; k--) {
        const j = Math.floor(rng() * (k + 1))
        ;[deck[k], deck[j]] = [deck[j], deck[k]]
      }
      let result = 1.5
      for (let s = 0; s < seats.length; s++) {
        const theirs = [deck[2 * s], deck[2 * s + 1]]
        if (rng() >= nash.call[s][classOf(theirs)]) continue
        const board = deck.slice(2 * seats.length, 2 * seats.length + 5)
        const a = fastScore([...hero, ...board])
        const b = fastScore([...theirs, ...board])
        const share = a > b ? 1 : a === b ? 0.5 : 0
        const dead =
          1.5 -
          (spot.seat === 'sb' ? 0.5 : 0) -
          (seats[s] === 'sb' ? 0.5 : seats[s] === 'bb' ? 1 : 0)
        result = share * (2 * spot.stack + dead) - risk
        break
      }
      total += result
      sumSq += result * result
    }
    const mean = total / trials
    const se = Math.sqrt((sumSq / trials - mean * mean) / trials)
    t.true(
      Math.abs(mean - formula) < 4 * se + 0.08,
      `${hand} ${spot.seat} ${spot.stack}bb: formula ${formula.toFixed(3)}, played ${mean.toFixed(3)} ± ${se.toFixed(3)}`,
    )
  }
})

test('the stored ranges are still a Nash equilibrium of the stored chart', (t) => {
  // Nobody can do better by changing what they do with any hand: every hand
  // always played is worth playing, every hand never played is not, and a hand
  // played some of the time is worth the same either way. To a twentieth of a
  // big blind, which is what two thousand rounds of fictitious play and a
  // weight stored in 63rds leave (five hands in the whole chart are over a
  // fiftieth), and a fifth of the margin no spot is asked inside.
  const EPS = 0.05
  let mixed = 0
  const check = (weight: number, value: number, label: string) => {
    if (weight === 1) t.true(value > -EPS, `${label} is always played at ${value}`)
    else if (weight === 0) t.true(value < EPS, `${label} is never played at ${value}`)
    else {
      mixed++
      t.true(Math.abs(value) < EPS, `${label} is mixed at ${value}`)
    }
  }
  for (const seat of SHOVE_SEATS) {
    for (const stack of STACKS) {
      const spot = { seat, stack }
      const nash = nashFor(spot)
      for (let h = 0; h < CLASS_COUNT; h++) {
        check(
          nash.shove[h],
          shoveEv(h, spot, nash.call).ev,
          `${seat}-${stack} shoving ${CLASSES[h].key}`,
        )
      }
      behind(seat).forEach((caller, k) => {
        const values = callValues(caller, spot, nash.shove)
        for (let c = 0; c < CLASS_COUNT; c++) {
          check(nash.call[k][c], values[c], `${seat}-${stack} ${caller} calling ${CLASSES[c].key}`)
        }
      })
    }
  }
  t.log(`${mixed} hands mixed across 65 spots`)
})

test('the equilibria look like the published ones where there are published ones', (t) => {
  // Heads-up, small blind against big blind, ten big blinds, no ante: the
  // standard chart has the small blind shoving a little over half its hands and
  // the big blind calling a little over a third.
  const hu = nashFor({ seat: 'sb', stack: 10 })
  t.true(rangeShare(hu.shove) > 0.5 && rangeShare(hu.shove) < 0.66, `${rangeShare(hu.shove)}`)
  t.true(rangeShare(hu.call[0]) > 0.3 && rangeShare(hu.call[0]) < 0.42, `${rangeShare(hu.call[0])}`)
  // Later seats shove wider than earlier ones at the same stack, and deeper
  // stacks shove tighter than shorter ones from the same seat.
  for (const stack of STACKS) {
    const shares = SHOVE_SEATS.map((seat) => rangeShare(nashFor({ seat, stack }).shove))
    for (let i = 1; i < shares.length; i++) t.true(shares[i] >= shares[i - 1] - 0.02, `${stack}bb`)
  }
  for (const seat of SHOVE_SEATS) {
    t.true(
      rangeShare(nashFor({ seat, stack: 15 }).shove) <
        rangeShare(nashFor({ seat, stack: 3 }).shove),
      seat,
    )
  }
  // Aces always go in; seven-deuce never goes in from under the gun.
  for (const seat of SHOVE_SEATS) {
    for (const stack of STACKS) t.is(nashFor({ seat, stack }).shove[classIndex('AA')], 1)
  }
  t.is(nashFor({ seat: 'utg', stack: 10 }).shove[classIndex('72o')], 0)
})

test('the callers either side of Nash are a fifth fewer and a quarter more', (t) => {
  const spot = { seat: 'mp', stack: 9 } as const
  const models = callerModels(spot)
  models.nash.forEach((range, k) => {
    const n = rangeCombos(range)
    t.true(Math.abs(rangeCombos(models.tight[k]) - n * CALLER_SPREAD.tight) < 1e-9)
    t.true(Math.abs(rangeCombos(models.loose[k]) - Math.min(1_326, n * CALLER_SPREAD.loose)) < 1e-9)
    // The tight range is inside Nash's ordering: its best hands are Nash's too.
    t.true(models.tight[k][classIndex('AA')] === 1)
  })
})

test('a range survives its trip through the chart’s encoding', (t) => {
  const rng = mulberry32(3)
  const range = new Float64Array(CLASS_COUNT).map(() => (rng() < 0.4 ? 1 : 0))
  t.deepEqual([...decodeRange(encodeRange(range))], [...range])
  // A mixed hand keeps its weight to a 63rd.
  range[40] = 0.3
  range[168] = 0.77
  const back = decodeRange(encodeRange(range))
  t.true(Math.abs(back[40] - 0.3) <= 1 / 126 && Math.abs(back[168] - 0.77) <= 1 / 126)
})
