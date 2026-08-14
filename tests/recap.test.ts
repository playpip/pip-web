// The post-tournament recap (lib/recap). Pure, so all of it is testable, which
// is the point: the recap makes claims about how you played, and a claim about
// a player that the arithmetic does not support is worse than no claim at all.
//
// What these pin, in order of how much they'd cost to get wrong:
//   1. Noise floors: a short run says less rather than saying nonsense.
//   2. The comparison against "your usual" is the run against the *lifetime
//      before it*, never the lifetime that already contains it.
//   3. Nothing progress-shaped leaks in (the membership boundary).

import test from 'ava'
import { buildRecap, ordinal, type RunSummary } from '@/lib/recap'
import { STYLE_MIN_HANDS } from '@/lib/playStyle'
import { emptySeatStats, type SeatStats } from '@/lib/reads'

const stats = (over: Partial<SeatStats> = {}): SeatStats => ({ ...emptySeatStats(), ...over })

/** A run long enough to clear every floor, with nothing remarkable in it. */
function summary(over: Partial<RunSummary> = {}): RunSummary {
  const runStats = stats({ handsDealt: 30, vpipHands: 12, raises: 10, calls: 10, betsFaced: 20 })
  const lifetimeBefore = stats({
    handsDealt: 300,
    vpipHands: 120,
    raises: 100,
    calls: 100,
    betsFaced: 200,
  })
  return {
    venueName: 'The Basement',
    place: 3,
    seats: 6,
    hands: 30,
    rollDelta: -200,
    runStats,
    lifetimeBefore,
    lifetimeAfter: stats({
      handsDealt: 330,
      vpipHands: 132,
      raises: 110,
      calls: 110,
      betsFaced: 220,
    }),
    biggestPot: 0,
    bigPotHand: null,
    bigPotKos: [],
    newPeak: false,
    peakRoll: 5000,
    bestFinishBefore: null,
    ...over,
  }
}

const line = (s: RunSummary, id: string) => buildRecap(s).lines.find((l) => l.id === id)
const stat = (s: RunSummary, label: string) =>
  buildRecap(s).stats.find((x) => x.label === label)?.value

// --- the result, which is always true --------------------------------------

test('the result reads as a finish, a hand count and a signed Roll change', (t) => {
  const s = summary({ place: 3, seats: 6, hands: 30, rollDelta: -200 })
  t.is(stat(s, 'Finish'), '3rd of 6')
  t.is(stat(s, 'Hands'), '30')
  t.is(stat(s, 'Roll'), '-200')
  t.is(stat(summary({ rollDelta: 1200 }), 'Roll'), '+1,200')
  t.is(stat(summary({ rollDelta: 0 }), 'Roll'), '0')
})

test('winning it says so rather than "1st of 6"', (t) => {
  t.is(stat(summary({ place: 1 }), 'Finish'), 'Won it')
})

// --- noise floors ----------------------------------------------------------

test('a short run gets no style read at all', (t) => {
  // Three hands cannot support a sentence about how somebody plays poker.
  const short = stats({ handsDealt: 3, vpipHands: 3, raises: 2, calls: 1, betsFaced: 2 })
  t.is(line(summary({ runStats: short, hands: 3 }), 'style'), undefined)
  // And the floor is the one /stats already uses, not a second opinion on it.
  const atFloor = stats({ handsDealt: STYLE_MIN_HANDS, vpipHands: 8 })
  const under = stats({ handsDealt: STYLE_MIN_HANDS - 1, vpipHands: 8 })
  t.truthy(line(summary({ runStats: atFloor }), 'style'))
  t.is(line(summary({ runStats: under }), 'style'), undefined)
})

test('with no history to compare against, the run reports its own number only', (t) => {
  const s = summary({ lifetimeBefore: stats({ handsDealt: 4, vpipHands: 2 }) })
  t.is(line(s, 'style')?.text, 'You played 40% of your hands this run.')
})

test('a difference inside the noise is not called a difference', (t) => {
  // 44% this run against 40% lifetime is four points on thirty hands.
  const s = summary({
    runStats: stats({ handsDealt: 25, vpipHands: 11, raises: 10, calls: 10, betsFaced: 20 }),
  })
  t.is(line(s, 'style')?.text, 'You played 44% of your hands this run.')
})

test('the aggression axis needs actions, not just hands', (t) => {
  // Thirty hands, but the player folded almost all of them: two actions is no
  // basis for "more aggressive than usual", however far off their usual it is.
  const s = summary({
    runStats: stats({ handsDealt: 30, vpipHands: 12, raises: 2, calls: 0, betsFaced: 25 }),
  })
  t.is(line(s, 'style')?.text, 'You played 40% of your hands this run.')
})

// --- the read itself -------------------------------------------------------

test('a looser run is called looser, against the lifetime before it', (t) => {
  const s = summary({
    runStats: stats({ handsDealt: 30, vpipHands: 21, raises: 10, calls: 10, betsFaced: 20 }),
  })
  t.is(line(s, 'style')?.text, 'You played 70% of your hands this run, looser than your usual 40%.')
})

test('a tighter run is called tighter', (t) => {
  const s = summary({
    runStats: stats({ handsDealt: 40, vpipHands: 4, raises: 10, calls: 10, betsFaced: 20 }),
  })
  t.is(
    line(s, 'style')?.text,
    'You played 10% of your hands this run, tighter than your usual 40%.',
  )
})

test('whichever axis moved further is the one reported', (t) => {
  // Looseness bang on the usual 40%; aggression up from 50% to 80%.
  const s = summary({
    runStats: stats({ handsDealt: 30, vpipHands: 12, raises: 16, calls: 4, betsFaced: 20 }),
  })
  t.is(
    line(s, 'style')?.text,
    'You raised rather than called 80% of the time this run, more aggressive than your usual 50%.',
  )
})

// --- the highlight ---------------------------------------------------------

test('no pot won, no highlight, and the recap does not reach for one', (t) => {
  t.is(line(summary({ biggestPot: 0 }), 'highlight'), undefined)
})

test('the highlight is one moment: the pot, what you showed, who it busted', (t) => {
  const s = summary({
    biggestPot: 1240,
    bigPotHand: { name: 'Full House', description: 'Full House, A’s over 9’s' },
    bigPotKos: ['Frank'],
  })
  t.is(
    line(s, 'highlight')?.text,
    'Your biggest pot was 1,240 chips, won with a full house. It took Frank out.',
  )
})

test('a pot won without a showdown names no hand', (t) => {
  const s = summary({ biggestPot: 800, bigPotHand: null, bigPotKos: [] })
  t.is(line(s, 'highlight')?.text, 'Your biggest pot was 800 chips.')
})

test('two players busted in one pot read as a list', (t) => {
  const s = summary({ biggestPot: 900, bigPotKos: ['Frank', 'Vivienne'] })
  t.is(
    line(s, 'highlight')?.text,
    'Your biggest pot was 900 chips. It took Frank and Vivienne out.',
  )
})

test('a royal is a royal, not the straight flush the evaluator calls it', (t) => {
  const s = summary({
    biggestPot: 600,
    bigPotHand: { name: 'Straight Flush', description: 'Royal Flush' },
  })
  t.is(line(s, 'highlight')?.text, 'Your biggest pot was 600 chips, won with a royal flush.')
})

test('an evaluator name we do not recognise drops the clause instead of guessing', (t) => {
  const s = summary({
    biggestPot: 600,
    bigPotHand: { name: 'Five of a Kind', description: 'Five of a Kind, A’s' },
  })
  t.is(line(s, 'highlight')?.text, 'Your biggest pot was 600 chips.')
})

// --- career context, only where it moved ------------------------------------

test('career lines are absent unless the run actually moved them', (t) => {
  const r = buildRecap(summary())
  t.is(r.lines.filter((l) => l.id === 'peak' || l.id === 'venue' || l.id === 'archetype').length, 0)
})

test('a new peak Roll is reported once, with the number', (t) => {
  t.is(
    line(summary({ newPeak: true, peakRoll: 12400 }), 'peak')?.text,
    'A new best Roll: 12,400 chips.',
  )
})

test('a venue best needs a previous best to beat', (t) => {
  // First visit: there is no record to improve on, so nothing is claimed.
  t.is(line(summary({ place: 2, bestFinishBefore: null }), 'venue'), undefined)
  t.is(line(summary({ place: 2, bestFinishBefore: 2 }), 'venue'), undefined)
  t.is(
    line(summary({ place: 2, bestFinishBefore: 4 }), 'venue')?.text,
    'Your best finish at The Basement yet.',
  )
})

test('an archetype change needs both sides of it to clear the floor', (t) => {
  const tight = stats({ handsDealt: 300, vpipHands: 60, raises: 100, calls: 100, betsFaced: 200 })
  const loose = stats({ handsDealt: 330, vpipHands: 200, raises: 110, calls: 110, betsFaced: 220 })
  t.is(
    line(summary({ lifetimeBefore: tight, lifetimeAfter: loose }), 'archetype')?.text,
    'Across everything you’ve played, you now read as The Maniac.',
  )
  // A brand-new player has no "before" to have changed from.
  const green = stats({ handsDealt: 5, vpipHands: 1 })
  t.is(line(summary({ lifetimeBefore: green, lifetimeAfter: loose }), 'archetype'), undefined)
})

// --- the membership boundary ------------------------------------------------

test('the recap can only ever describe one run', (t) => {
  // Not a style assertion: `RunSummary` has nowhere to put a second run, which
  // is what stops this growing into "your last ten sessions" by accident. If
  // this test has to change, the change is a monetisation decision (see #53
  // and drafts/build-membership.md), not a copy tweak.
  const r = buildRecap(summary({ biggestPot: 500, newPeak: true }))
  t.true(r.lines.length <= 5)
  for (const l of r.lines) {
    t.false(/session|streak|last \d|trend|tomorrow/i.test(l.text))
  }
})

test('ordinals', (t) => {
  t.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal), [
    '1st',
    '2nd',
    '3rd',
    '4th',
    '11th',
    '12th',
    '13th',
    '21st',
    '22nd',
    '23rd',
    '101st',
    '111th',
  ])
})
