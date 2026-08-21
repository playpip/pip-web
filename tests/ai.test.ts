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

/** Preflop VPIP and PFR for a profile, as fractions of preflop seats seen. */
function measurePreflop(
  profile: AiProfile,
  seats: number,
  hands = 18,
): { vpip: number; pfr: number } {
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
    while (!isHandComplete(s) && guard++ < 2000) {
      const p = s.players[s.toActIndex]
      const a = decideAction(s, profile, rng)
      if (s.street === 'preflop') {
        seatsSeen.add(p.id)
        if (a.type === 'call' || a.type === 'bet' || a.type === 'raise') put.add(p.id)
        if (a.type === 'bet' || a.type === 'raise') opened.add(p.id)
      }
      s = applyAction(s, a)
    }
    seen += seatsSeen.size
    voluntary += put.size
    raised += opened.size
  }
  return { vpip: voluntary / seen, pfr: raised / seen }
}

// The shipped ladder's tightness/aggression, with iterations cut to keep the
// suite quick. Preflop raising now keys off holding quality rather than the
// Monte-Carlo estimate, so the sample size does not move these numbers much.
const LADDER: ReadonlyArray<{ name: string; seats: number; ai: AiProfile }> = [
  {
    name: 'garage',
    seats: 3,
    ai: { tightness: 0.15, aggression: 0.25, bluff: 0.05, iterations: 90, skill: 0.28 },
  },
  {
    name: 'cardroom',
    seats: 6,
    ai: { tightness: 0.38, aggression: 0.5, bluff: 0.11, iterations: 90, skill: 0.54 },
  },
  {
    name: 'penthouse',
    seats: 6,
    ai: { tightness: 0.52, aggression: 0.66, bluff: 0.16, iterations: 90, skill: 0.84 },
  },
]

test('every rung of the ladder opens pots instead of limping its whole range', (t) => {
  for (const rung of LADDER) {
    const { vpip, pfr } = measurePreflop(rung.ai, rung.seats)
    const seen = `${rung.name}: VPIP ${(vpip * 100).toFixed(1)} PFR ${(pfr * 100).toFixed(1)}`
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
  // Both at six seats on purpose: table size moves PFR more than personality
  // does, so the shipped garage at three seats against the penthouse at six
  // would measure the seat count.
  //
  // And the measure is PFR as a share of VPIP, not raw PFR. A loose-passive
  // seat enters more pots than a tight-aggressive one and so can out-raise it
  // in absolute terms while still being the passive player at the table. What
  // separates them is what they do *when they come in*: the garage limps, the
  // penthouse raises.
  const garage = measurePreflop(LADDER[0].ai, 6)
  const penthouse = measurePreflop(LADDER[2].ai, 6)
  const ratio = (m: { vpip: number; pfr: number }): number => m.pfr / m.vpip
  t.true(
    ratio(penthouse) > ratio(garage),
    `garage ${(ratio(garage) * 100).toFixed(0)}% of entries raised vs penthouse ${(ratio(penthouse) * 100).toFixed(0)}%`,
  )
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
