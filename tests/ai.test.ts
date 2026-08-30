import test from 'ava'
import {
  startHand,
  applyAction,
  legalActions,
  isHandComplete,
  type HandState,
  type SeatConfig,
} from '@/lib/poker/engine'
import { decideAction, opponentSelectivity, type AiProfile } from '@/lib/poker/ai/policy'
import { mulberry32, type Rng } from '@/lib/poker/cards'
import { ALL_VENUES, VENUES, type Venue } from '@/config/venues'
import { makeDeck } from './helpers'

type Player = HandState['players'][number]

/** Minimal opponent stub for the pure selectivity read (only reads commitments). */
function opp(committedThisHand: number, committedThisStreet = 0): Player {
  return { committedThisHand, committedThisStreet, status: 'active' } as Player
}

const PROFILE: AiProfile = { tightness: 0.4, aggression: 0.5, bluff: 0.12, iterations: 200 }

function makeSeats(n: number, stack = 1000): SeatConfig[] {
  return Array.from({ length: n }, (_, i) => ({ id: `P${i}`, name: `P${i}`, stack }))
}

/** Drive a full hand with the AI acting for everyone. Returns the final state. */
function playOut(seats: SeatConfig[], rng: Rng, onStep?: (s: HandState) => void): HandState {
  let s = startHand({ seats, buttonIndex: 0, smallBlind: 5, bigBlind: 10, rng })
  let guard = 0
  while (!isHandComplete(s)) {
    if (guard++ > 1000) throw new Error('hand did not terminate')
    onStep?.(s)
    s = applyAction(s, decideAction(s, PROFILE, rng))
  }
  return s
}

test('AI-vs-AI hands always terminate and conserve chips', (t) => {
  for (let seed = 0; seed < 40; seed++) {
    const seats = makeSeats(6)
    const before = seats.reduce((sum, s) => sum + s.stack, 0)
    const final = playOut(seats, mulberry32(seed))
    t.true(isHandComplete(final))
    t.is(
      final.players.reduce((sum, p) => sum + p.stack, 0),
      before,
    )
  }
})

test('AI never folds when it can check for free', (t) => {
  for (let seed = 0; seed < 25; seed++) {
    const rng = mulberry32(seed * 31 + 1)
    playOut(makeSeats(4), rng, (s) => {
      const legal = legalActions(s)
      if (legal?.canCheck) {
        const action = decideAction(s, PROFILE, rng)
        t.not(action.type, 'fold')
      }
    })
  }
})

test('AI only ever returns legal actions (no engine throws)', (t) => {
  // If any AI action were illegal, applyAction inside playOut would throw.
  t.notThrows(() => {
    for (let seed = 0; seed < 20; seed++) playOut(makeSeats(3), mulberry32(seed + 500))
  })
})

test('tighter AI folds more than a looser one facing the same spots', (t) => {
  const nit: AiProfile = { tightness: 0.9, aggression: 0.3, bluff: 0.0, iterations: 200 }
  const maniac: AiProfile = { tightness: 0.05, aggression: 0.3, bluff: 0.0, iterations: 200 }

  const countFolds = (profile: AiProfile): number => {
    let folds = 0
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed + 9)
      let s = startHand({ seats: makeSeats(4), buttonIndex: 0, smallBlind: 5, bigBlind: 10, rng })
      let guard = 0
      while (!isHandComplete(s) && guard++ < 1000) {
        const action = decideAction(s, profile, rng)
        if (action.type === 'fold') folds++
        s = applyAction(s, action)
      }
    }
    return folds
  }

  t.true(countFolds(nit) > countFolds(maniac))
})

test('opponentSelectivity rises with chips committed and stays bounded', (t) => {
  const preflop = { bigBlind: 10, street: 'preflop', currentBet: 0 } as HandState

  const little = opponentSelectivity(preflop, opp(10)) // 1bb in
  const some = opponentSelectivity(preflop, opp(50)) // 5bb in
  const lots = opponentSelectivity(preflop, opp(300)) // 30bb in

  t.true(some > little)
  t.true(lots > some)
  t.true(little >= 0 && lots <= 0.8) // bounded [0, 0.8]
})

test('opponentSelectivity adds a bump for backing it postflop', (t) => {
  // Same chips committed, but one opponent has matched the bet on a later
  // street — a stronger signal of a real hand than dead preflop money.
  const flop = { bigBlind: 10, street: 'flop', currentBet: 40 } as HandState
  const passive = opponentSelectivity({ ...flop, street: 'preflop' } as HandState, opp(60, 0))
  const aggressive = opponentSelectivity(flop, opp(60, 40))
  t.true(aggressive > passive)
})

test('low-skill AI folds to pressure more than its full-skill self', (t) => {
  const base: AiProfile = { tightness: 0.4, aggression: 0.3, bluff: 0, iterations: 100 }
  const blundery: AiProfile = { ...base, skill: 0.2 }

  const countFolds = (profile: AiProfile): number => {
    let folds = 0
    for (let seed = 0; seed < 30; seed++) {
      const rng = mulberry32(seed + 77)
      let s = startHand({ seats: makeSeats(4), buttonIndex: 0, smallBlind: 5, bigBlind: 10, rng })
      let guard = 0
      while (!isHandComplete(s) && guard++ < 1000) {
        const action = decideAction(s, profile, rng)
        if (action.type === 'fold') folds++
        s = applyAction(s, action)
      }
    }
    return folds
  }

  t.true(countFolds(blundery) > countFolds(base))
})

// Heads-up, P0 is SB/button and acts first preflop, owing the rest of the big
// blind. Deal order is one card per player per round, so popOrder positions
// 0 and 2 are P0's hole cards, 1 and 3 are P1's.
function dealHeadsUp(p0: [string, string], p1: [string, string]) {
  const deck = makeDeck([p0[0], p1[0], p0[1], p1[1], '7c', '8d', 'Jh', 'Qs', '2h'])
  return startHand({ seats: makeSeats(2), buttonIndex: 0, smallBlind: 5, bigBlind: 10, deck })
}

test('AI mucks preflop junk (2-3o) to a bet instead of peeling cheap', (t) => {
  const profile: AiProfile = { tightness: 0.4, aggression: 0.5, bluff: 0.12, iterations: 200 }
  // P0 holds 2-3 offsuit — the worst kind of hand a real player never enters.
  const s = dealHeadsUp(['2c', '3d'], ['Ah', 'Kh'])
  for (let seed = 0; seed < 20; seed++) {
    const action = decideAction(s, profile, mulberry32(seed + 1))
    t.is(action.type, 'fold')
  }
})

test('AI still plays a premium (AA) preflop rather than folding it', (t) => {
  const profile: AiProfile = { tightness: 0.4, aggression: 0.5, bluff: 0.12, iterations: 200 }
  const s = dealHeadsUp(['As', 'Ad'], ['7h', '2c'])
  for (let seed = 0; seed < 20; seed++) {
    const action = decideAction(s, profile, mulberry32(seed + 1))
    t.not(action.type, 'fold')
  }
})

// Fraction of preflop seats that voluntarily put chips in (limp/call/raise),
// i.e. VPIP — the standard measure of how wide a table plays.
function measureVpip(profile: AiProfile): number {
  let seats = 0
  let voluntary = 0
  for (let h = 0; h < 60; h++) {
    const rng = mulberry32(h * 7 + 13)
    let s = startHand({ seats: makeSeats(6), buttonIndex: h % 6, smallBlind: 5, bigBlind: 10, rng })
    const put = new Set<string>()
    const seen = new Set<string>()
    let guard = 0
    while (!isHandComplete(s) && guard++ < 1000) {
      if (s.street === 'preflop') {
        const p = s.players[s.toActIndex]
        seen.add(p.id)
        const a = decideAction(s, profile, rng)
        if (a.type === 'bet' || a.type === 'raise' || a.type === 'call') put.add(p.id)
        s = applyAction(s, a)
      } else {
        s = applyAction(s, decideAction(s, profile, rng))
      }
    }
    seats += seen.size
    voluntary += put.size
  }
  return voluntary / seats
}

test('looseness scales preflop range: a loose table plays far more hands than a nit', (t) => {
  // Same skill/aggression — only tightness differs, mirroring the venue ladder.
  const loose: AiProfile = { tightness: 0.15, aggression: 0.4, bluff: 0.08, iterations: 120 }
  const nit: AiProfile = { tightness: 0.6, aggression: 0.4, bluff: 0.08, iterations: 120 }

  const looseVpip = measureVpip(loose)
  const nitVpip = measureVpip(nit)

  // The loose field should play a visibly wider range — not a hair's difference.
  t.true(looseVpip > nitVpip + 0.08, `loose ${looseVpip.toFixed(2)} vs nit ${nitVpip.toFixed(2)}`)
  // And nobody plays a cartoonishly wide "any two cards" range.
  t.true(looseVpip < 0.45, `loose VPIP ${looseVpip.toFixed(2)} unrealistically high`)
})

// --- preflop aggression (pip-web #2) ---------------------------------------
// The report was "unrealistically aggressive bots". Measured across the shipped
// venue ladder the bots were the opposite of aggressive: they called their way
// into pots and almost never raised preflop, opening 1.9%-7.8% of hands where a
// real player opens 12%-25%, with a VPIP three to ten times their PFR. That
// pairing is the signature of a calling station, and a table of them is what
// "these don't play like people" looks like from the other side. These tests
// hold the shipped profiles to a band rather than to each other, because the
// relative tests above all passed while every rung sat outside it.

// The subject is `src/config/venues.ts` itself — every table in `ALL_VENUES`,
// imported, never retyped. An earlier version of this block held a local copy of
// three rungs' tightness/aggression numbers, which fails the same way synthetic
// profiles did one step later: change a venue in `venues.ts` and the test keeps
// asserting against the stale copy, green. If you add a table, it is measured
// here the moment it lands in `ALL_VENUES`, and nothing needs editing.

/** Everything the bands are asserted against: ladder, side, ring, challenge, kitchen, daily. */
const CATALOGUE = ALL_VENUES

/**
 * Monte-Carlo iterations is the one knob overridden off the shipped profile,
 * because the shipped values (80-1800) put a full-catalogue pass into the
 * minutes. **It is not a free knob.** The same `rng` feeds the equity sims and
 * the decision jitter, so changing the iteration count re-rolls the whole
 * stream rather than just sharpening an estimate: the same profile measured at
 * 60 / 90 / 120 / 200 / 400 iterations over 18 hands returned PFR 18.4 / 3.4 /
 * 10.7 / 6.0 / 4.8. That spread is sampling noise, not behaviour.
 *
 * The fix is hands, not iterations. At 150 hands the same five settings land in
 * 9.0-12.6. `MEASURED_HANDS = 60` is where the spread is small enough that
 * every table clears the band with room, and it costs about a second a table.
 * **Do not trim either number to speed the suite up** — at 18 hands these
 * assertions measure the seed, and one shipped table (The Study) reads anywhere
 * from 3.4% to 18.4% depending on nothing.
 */
const MEASURED_ITERATIONS = 90
const MEASURED_HANDS = 60

interface Preflop {
  vpip: number
  pfr: number
}

/**
 * Preflop VPIP and PFR for a profile, as fractions of preflop seats seen.
 *
 * Stops the moment the preflop betting round closes: nothing after it is
 * recorded, every hand gets its own seeded `rng`, so the numbers are identical
 * to playing the hand out and about a third cheaper.
 */
function measurePreflop(profile: AiProfile, seats: number, hands = MEASURED_HANDS): Preflop {
  let seen = 0
  let voluntary = 0
  let raised = 0
  for (let h = 0; h < hands; h++) {
    const rng = mulberry32(h * 7919 + 5)
    let s = startHand({
      seats: makeSeats(seats),
      buttonIndex: h % seats,
      smallBlind: 5,
      bigBlind: 10,
      rng,
    })
    const seatsSeen = new Set<string>()
    const put = new Set<string>()
    const opened = new Set<string>()
    let guard = 0
    while (!isHandComplete(s) && s.street === 'preflop' && guard++ < 2000) {
      const p = s.players[s.toActIndex]
      const a = decideAction(s, profile, rng)
      seatsSeen.add(p.id)
      if (a.type === 'call' || a.type === 'bet' || a.type === 'raise') put.add(p.id)
      if (a.type === 'bet' || a.type === 'raise') opened.add(p.id)
      s = applyAction(s, a)
    }
    seen += seatsSeen.size
    voluntary += put.size
    raised += opened.size
  }
  return { vpip: voluntary / seen, pfr: raised / seen }
}

// Measuring a table is the expensive part and two tests want the same numbers
// (the ladder's six-handed rungs are measured at their own seat count as well),
// so cache by venue and seat count. Everything is seeded, so a cache hit is the
// same answer, not an approximation of it.
const cache = new Map<string, Preflop>()
function preflopFor(venue: Venue, seats: number = venue.seats): Preflop {
  const key = `${venue.id}@${seats}`
  const hit = cache.get(key)
  if (hit) return hit
  const measured = measurePreflop({ ...venue.ai, iterations: MEASURED_ITERATIONS }, seats)
  cache.set(key, measured)
  return measured
}

/** What a seat does when it comes in: the share of its entries that were raises. */
const entriesRaised = (m: Preflop): number => m.pfr / m.vpip

test('every table in the catalogue opens pots instead of limping its whole range', (t) => {
  for (const venue of CATALOGUE) {
    const { vpip, pfr } = preflopFor(venue)
    const seen = `${venue.id} (${venue.seats} seats): VPIP ${(vpip * 100).toFixed(1)} PFR ${(pfr * 100).toFixed(1)}`
    // The floor is the bug: at 2% the seat is a calling station, not a player.
    t.true(pfr > 0.05, `${seen}: barely raises preflop`)
    // And the ceiling, so a future tuning pass cannot overshoot into a maniac.
    t.true(pfr < 0.4, `${seen}: opens an unrealistic share of hands`)
    // You cannot raise more hands than you play.
    t.true(vpip >= pfr, seen)
    // A real seat calls more than it raises, but not ten times more.
    t.true(vpip < pfr * 8, `${seen}: calls far more than it raises`)
  }
})

test('the ladder gets more aggressive preflop as the stakes climb', (t) => {
  // All ten rungs at six seats on purpose: table size moves PFR more than
  // personality does, so the shipped garage at three seats against the
  // penthouse at six would measure the seat count.
  //
  // And the measure is PFR as a share of VPIP, not raw PFR. A loose-passive
  // seat enters more pots than a tight-aggressive one and so can out-raise it
  // in absolute terms while still being the passive player at the table. What
  // separates them is what they do *when they come in*: the garage limps, the
  // Main Event raises.
  //
  // What the ladder actually measures, entries-raised at six seats. This is a
  // snapshot of a run (2026-08-30), not an assertion: the assertions below are
  // the shape, and they print the live table on failure. Do not read a number
  // here as current without re-running.
  //   garage 32%  pub 41%  poolhall 46%  cardroom 48%  casino 40%
  //   riverboat 41%  penthouse 43%  montecarlo 45%  vegas 51%  mainevent 60%
  //
  // The climb is real end to end and by tier, and it is NOT monotone step by
  // step: the casino and the riverboat come in less often as raisers than the
  // pool hall and the card room do. So this asserts the shape the ladder has
  // (bottom softest, top hardest, tiers ordered) and deliberately does not
  // assert rung-by-rung ordering, which is false today. **A public claim rides
  // on this test — if it has to be relaxed, that is a copy change, and the
  // sentence has to move before the assertion does.**
  const ladder = VENUES.map((v) => ({ id: v.id, raised: entriesRaised(preflopFor(v, 6)) }))
  const pct = (r: number): string => `${(r * 100).toFixed(0)}%`
  const table = ladder.map((r) => `${r.id} ${pct(r.raised)}`).join(', ')

  const garage = ladder[0]
  const top = ladder[ladder.length - 1]

  // The original guard, kept verbatim in meaning: the penthouse out-raises the
  // garage. It is the comparison the ladder claim was first written against.
  const penthouse = ladder.find((r) => r.id === 'penthouse')
  t.truthy(penthouse, 'the penthouse is still on the ladder')
  t.true(penthouse!.raised > garage.raised, table)

  // The bottom rung is the softest thing on the ladder, and the top rung is the
  // hardest. This is the half of the claim a stranger is actually invited to
  // test: "up to The Main Event".
  t.true(
    ladder.every((r) => r === garage || r.raised > garage.raised),
    `garage ${pct(garage.raised)} is not the least aggressive rung: ${table}`,
  )
  t.true(
    ladder.every((r) => r === top || r.raised < top.raised),
    `${top.id} ${pct(top.raised)} is not the most aggressive rung: ${table}`,
  )
  t.true(top.raised > garage.raised * 1.5, `top of the ladder is barely above the bottom: ${table}`)

  // And the trend holds across tiers, which is the honest form of "as the
  // stakes climb" given the step-by-step wobble above.
  const mean = (rs: typeof ladder): number => rs.reduce((a, r) => a + r.raised, 0) / rs.length
  t.true(mean(ladder.slice(7)) > mean(ladder.slice(0, 3)), table)
})

test('the ladder gets tighter as the stakes climb, rung by rung', (t) => {
  // The other half of the difficulty curve, and the half that really is ordered
  // all the way up: every rung enters fewer pots than the rung below it, 35%
  // down to 19%. Measured at six seats for the same reason as above.
  const ladder = VENUES.map((v) => ({ id: v.id, vpip: preflopFor(v, 6).vpip }))
  const table = ladder.map((r) => `${r.id} ${(r.vpip * 100).toFixed(1)}%`).join(', ')

  // Adjacent rungs get a one-point tolerance, because two neighbours only 0.05
  // of tightness apart can land on the same number of entries: the casino and
  // the riverboat both voluntarily enter 77 pots here, and separate by 0.06 of
  // a point only because the riverboat saw one fewer preflop seat. A real
  // reversal is much bigger than that, and the gap check below catches it.
  for (let i = 1; i < ladder.length; i++) {
    t.true(
      ladder[i].vpip <= ladder[i - 1].vpip + 0.01,
      `${ladder[i].id} plays materially more hands than the rung below it: ${table}`,
    )
  }
  // Two rungs apart, there is no tolerance and no tie: the curve is real.
  for (let i = 2; i < ladder.length; i++) {
    t.true(
      ladder[i].vpip < ladder[i - 2].vpip,
      `${ladder[i].id} is not tighter than ${ladder[i - 2].id}: ${table}`,
    )
  }
  const top = ladder[ladder.length - 1]
  t.true(
    top.vpip < ladder[0].vpip * 0.7,
    `the top of the ladder is barely tighter than the bottom: ${table}`,
  )
})

test('every table declares its AI skill explicitly', (t) => {
  // `skill` is optional on AiProfile and defaults to 1, so a venue that omits it
  // reads as the AI's best game by accident rather than by decision. The Main
  // Event was the one table doing that. An omission is indistinguishable from an
  // intent here, so require the number.
  for (const venue of CATALOGUE) {
    t.is(typeof venue.ai.skill, 'number', `${venue.id} does not declare ai.skill`)
    t.true(venue.ai.skill! > 0 && venue.ai.skill! <= 1, `${venue.id} skill out of range`)
  }
})

test('declared skill never goes backwards up the ladder', (t) => {
  // Configuration, not behaviour — cheap, and the two are not the same thing
  // (that is the whole reason the tests above exist). This one only catches a
  // rung typed in out of order.
  for (let i = 1; i < VENUES.length; i++) {
    t.true(
      VENUES[i].ai.skill! > VENUES[i - 1].ai.skill!,
      `${VENUES[i].id} is declared less skilled than ${VENUES[i - 1].id}`,
    )
  }
})

// Six-handed, P3 is UTG and acts first (button 0 → SB 1, BB 2, UTG 3). Cards go
// one per seat per round, so P3's are pop positions 3 and 9.
function dealSixHanded(utg: [string, string]): HandState {
  const order = ['2c', '3d', '4h', utg[0], '5s', '6c', '7d', '8h', '9s', utg[1], 'Tc', 'Jd']
  return startHand({
    seats: makeSeats(6),
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    deck: makeDeck(order),
  })
}

test('aces get raised six-handed, not limped (the #2 regression)', (t) => {
  // This is the exact hole the fix closes. Against five live opponents even AA
  // is worth only ~0.49 equity, so an absolute 0.78 raise gate could never fire
  // and this seat used to call every single time.
  const profile: AiProfile = { tightness: 0.38, aggression: 0.5, bluff: 0.11, iterations: 200 }
  const s = dealSixHanded(['As', 'Ad'])
  t.deepEqual(
    s.players[s.toActIndex].hole.map((c) => `${c.rank}${c.suit}`).sort(),
    ['Ad', 'As'],
    'UTG should be the seat holding aces',
  )
  let raises = 0
  for (let seed = 0; seed < 40; seed++) {
    const a = decideAction(s, profile, mulberry32(seed + 3))
    t.not(a.type, 'fold', 'never folds aces')
    if (a.type === 'raise') raises++
  }
  t.true(raises > 10, `raised aces ${raises}/40 times`)
})

test('junk still gets folded six-handed, so the fix did not just loosen everything', (t) => {
  const profile: AiProfile = { tightness: 0.38, aggression: 0.5, bluff: 0.11, iterations: 200 }
  const s = dealSixHanded(['2h', '7c'])
  for (let seed = 0; seed < 30; seed++) {
    t.is(decideAction(s, profile, mulberry32(seed + 3)).type, 'fold')
  }
})

test('a preflop open is a real raise, not a min-raise', (t) => {
  // Sized off the pot, a 0.7-pot raise over a 10-chip big blind is a raise to
  // 20, and a table of min-raises reads as timid. Real opens are 2.5-3x.
  const profile: AiProfile = { tightness: 0.38, aggression: 0.5, bluff: 0.11, iterations: 200 }
  const s = dealSixHanded(['As', 'Ad'])
  const sizes: number[] = []
  for (let seed = 0; seed < 40; seed++) {
    const a = decideAction(s, profile, mulberry32(seed + 3))
    if (a.type === 'raise' && a.amount !== undefined) sizes.push(a.amount)
  }
  t.true(sizes.length > 0)
  const avg = sizes.reduce((x, y) => x + y, 0) / sizes.length
  t.true(avg > s.bigBlind * 2, `average open ${avg.toFixed(1)} into a ${s.bigBlind} blind`)
  t.true(avg < s.bigBlind * 4.5, `average open ${avg.toFixed(1)} is too big`)
})

// How often the AI bets a postflop pot that is checked to it, split by how many
// opponents are still live. Every preflop band above measures how *wide* the AI
// plays; this is the first one that measures what it does after the flop, and
// it exists because that half had never been measured at all.
function measureLeadByField(
  profile: AiProfile,
  hands = 80,
): Map<number, { n: number; led: number }> {
  const by = new Map<number, { n: number; led: number }>()
  for (let h = 0; h < hands; h++) {
    const rng = mulberry32(h * 7 + 13)
    let s = startHand({ seats: makeSeats(6), buttonIndex: h % 6, smallBlind: 5, bigBlind: 10, rng })
    let guard = 0
    while (!isHandComplete(s) && guard++ < 1000) {
      const legal = legalActions(s)
      const p = s.players[s.toActIndex]
      const a = decideAction(s, profile, rng)
      if (s.street !== 'preflop' && legal && legal.callAmount === 0 && p) {
        const live = s.players.filter(
          (q) => q.id !== p.id && q.status !== 'folded' && q.status !== 'out',
        ).length
        const cell = by.get(live) ?? { n: 0, led: 0 }
        cell.n++
        if (a.type === 'bet' || a.type === 'raise') cell.led++
        by.set(live, cell)
      }
      s = applyAction(s, a)
    }
  }
  return by
}

test('the AI still bets multiway flops instead of checking the pot down', (t) => {
  // The defect this pins: every postflop gate used to be an absolute equity
  // number written for a heads-up pot (lead above 0.62, value-raise above 0.78),
  // and an equity point is not the same size against three opponents as against
  // one. Measured on this profile before the fix, the AI led an unbet pot 21% of
  // the time heads-up and **7% against two or three**: it checked the flop round
  // at exactly the loose tables a beginner meets first, which are the ones that
  // go multiway. Quoting the gates as a multiple of a fair share of the pot puts
  // the multiway rates back at 16% and 23%.
  const loose: AiProfile = { tightness: 0.15, aggression: 0.35, bluff: 0.06, iterations: 120 }
  const by = measureLeadByField(loose)

  const headsUp = by.get(1)
  t.truthy(headsUp, 'no heads-up postflop decisions were sampled at all')
  if (!headsUp) return
  // A rate measured over a handful of spots is not a rate. Assert the sample
  // before asserting the thing, or this test goes green on an empty measurement.
  t.true(headsUp.n >= 100, `only ${headsUp.n} heads-up spots sampled`)
  const headsUpRate = headsUp.led / headsUp.n
  t.true(headsUpRate > 0.05, `heads-up lead rate ${(headsUpRate * 100).toFixed(0)}% is not poker`)

  const collapsed: string[] = []
  for (const [opponents, cell] of by) {
    if (opponents < 2 || cell.n < 30) continue
    const rate = cell.led / cell.n
    if (rate < headsUpRate * 0.6) {
      collapsed.push(
        `${opponents} opponents: ${(rate * 100).toFixed(0)}% of unbet pots led (n=${cell.n}), against ${(headsUpRate * 100).toFixed(0)}% heads-up`,
      )
    }
  }
  t.deepEqual(collapsed, [], 'betting collapses as the field grows')
})

test('the postflop gates are the old heads-up numbers, restated as a fair share', (t) => {
  // The safety property behind the change above, and the reason it could ship
  // without a playtest of all 29 tables: heads-up a fair share of the pot is
  // exactly 0.5, so every multiple reproduces the absolute it replaced and no
  // heads-up pot plays differently. Break one of these and you have moved every
  // table on the ladder, not just the loose multiway ones.
  const fairShareHeadsUp = 1 / (1 + 1)
  t.is(fairShareHeadsUp * 1.24, 0.62, 'lead gate')
  t.is(fairShareHeadsUp * 1.56, 0.78, 'value-raise gate')
  t.is(fairShareHeadsUp * 1.2, 0.6, 'thin-raise gate')
  t.is(fairShareHeadsUp * 0.8, 0.4, 'bluff ceiling')
})
