import test from 'ava'
import { SEVEN_CARD_HANDS } from '@/config/handFrequencies'
import {
  BOARD_SPOT,
  KICKER_SPOT,
  POCKET_PAIR_ROLES,
  POCKET_PAIR_SHAPES,
  RANK_SHAPES,
  SUIT_DEALS_PER_SHAPE,
  THIRD_PAIR_IS_THE_KICKER,
  THREE_PAIR_HANDS,
  THREE_PAIR_RANK_SHAPES,
  type WorkedSpot,
} from '@/config/threePair'
import { type Card, RANKS, type Rank, SUITS, type Suit, cardFromString } from '@/lib/poker/cards'
import { bestFive, determineWinners, evaluateHand } from '@/lib/poker/handEval'

// /learn/three-pair-in-texas-holdem says three pair is always two pair, that
// the third pair is worth one kicker and only sometimes, and that a quarter of
// the time the pocket pair you are so pleased with is not in your hand at all.
//
// Every one of those is checkable without sampling. There are 2,860 ways to
// choose three paired ranks and a spare, and 864 ways to deal any one of them
// in suits; enumerating both dimensions is 3,724 evaluations rather than their
// 2,471,040-hand product, and it is exhaustive in each because a rank shape's
// grade cannot depend on suits that cannot make a flush. The test proves that
// premise rather than assuming it.
//
// The counts live in the config as typed literals so this file can disagree
// with them. Derived from the evaluator they would agree with it by
// construction and prove nothing.

const cards = (strings: readonly string[]) => strings.map(cardFromString)
const card = (rank: Rank, suit: Suit): Card => ({ rank, suit })

/** The six ways to pick two suits for a pair, in a fixed order. */
const PAIR_SUITS: Suit[][] = SUITS.flatMap((a, i) => SUITS.slice(i + 1).map((b) => [a, b]))

// --- The shape counts -------------------------------------------------------

/** n choose k, exactly, for the small n this file uses. */
function choose(n: number, k: number): number {
  let result = 1
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1)
  return Math.round(result)
}

/** Every way seven cards can fall by rank: partitions of 7 into parts of 1-4. */
function rankPatterns(remaining: number, largest: number, so_far: number[]): number[][] {
  if (remaining === 0) return [so_far]
  const out: number[][] = []
  for (let part = Math.min(largest, remaining, 4); part >= 1; part--) {
    out.push(...rankPatterns(remaining - part, part, [...so_far, part]))
  }
  return out
}

/** Seven-card holdings with this rank pattern: ranks to assign x suits to pick. */
function handsWithPattern(pattern: number[]): number {
  const sizes = new Map<number, number>()
  for (const part of pattern) sizes.set(part, (sizes.get(part) ?? 0) + 1)
  let ranks = 1
  let unused = RANKS.length
  for (const [, howMany] of sizes) {
    ranks *= choose(unused, howMany)
    unused -= howMany
  }
  return pattern.reduce((suits, part) => suits * choose(4, part), 1) * ranks
}

test('the five rank shapes on the page account for every seven-card holding', (t) => {
  const patterns = rankPatterns(7, 4, [])
  const counted = new Map(patterns.map((p) => [p.join('-'), handsWithPattern(p)]))
  // The four named rows are one pattern each; the fifth is everything with a
  // rank appearing three or four times, which is what the page's wording says.
  const named = new Set(['2-1-1-1-1-1', '2-2-1-1-1', '1-1-1-1-1-1-1', '2-2-2-1'])
  const rest = [...counted]
    .filter(([pattern]) => !named.has(pattern))
    .reduce((sum, [, hands]) => sum + hands, 0)

  for (const row of RANK_SHAPES) {
    const expected = named.has(row.pattern) ? counted.get(row.pattern) : rest
    t.is(row.hands, expected ?? 0, row.shape)
  }
  t.is(
    RANK_SHAPES.reduce((sum, row) => sum + row.hands, 0),
    SEVEN_CARD_HANDS,
  )
  t.is(SEVEN_CARD_HANDS, choose(52, 7))
})

test('the three-pair counts are the product of the two dimensions enumerated below', (t) => {
  t.is(THREE_PAIR_HANDS, THREE_PAIR_RANK_SHAPES * SUIT_DEALS_PER_SHAPE)
  const row = RANK_SHAPES.find((shape) => shape.pattern === '2-2-2-1')
  t.is(THREE_PAIR_HANDS, row?.hands ?? 0)
})

// --- Every rank shape, graded ----------------------------------------------

/**
 * Seven cards: the three ranks paired and the spare, dealt in the `nth` of the
 * 864 suit deals so that a sweep of all 2,860 shapes walks the suits too.
 */
function sevenCards(pairs: Rank[], spare: Rank, nth: number): Card[] {
  const suits = [
    PAIR_SUITS[nth % 6],
    PAIR_SUITS[Math.floor(nth / 6) % 6],
    PAIR_SUITS[Math.floor(nth / 36) % 6],
  ]
  return [
    ...pairs.flatMap((rank, i) => suits[i].map((suit) => card(rank, suit))),
    card(spare, SUITS[Math.floor(nth / 216) % 4]),
  ]
}

/** Every choice of three paired ranks and a spare, high pair first. */
function everyRankShape(): { pairs: Rank[]; spare: Rank }[] {
  const shapes: { pairs: Rank[]; spare: Rank }[] = []
  for (let a = RANKS.length - 1; a >= 0; a--) {
    for (let b = a - 1; b >= 0; b--) {
      for (let c = b - 1; c >= 0; c--) {
        for (let spare = 0; spare < RANKS.length; spare++) {
          if (spare === a || spare === b || spare === c) continue
          shapes.push({ pairs: [RANKS[a], RANKS[b], RANKS[c]], spare: RANKS[spare] })
        }
      }
    }
  }
  return shapes
}

test('three pair is always two pair, and the third pair is only ever a kicker', (t) => {
  const shapes = everyRankShape()
  t.is(shapes.length, THREE_PAIR_RANK_SHAPES)

  let kickerFromThirdPair = 0
  shapes.forEach(({ pairs, spare }, nth) => {
    const seven = sevenCards(pairs, spare, nth % SUIT_DEALS_PER_SHAPE)
    const hand = evaluateHand(seven.slice(0, 2), seven.slice(2))
    t.is(hand.name, 'Two Pair', `${pairs.join('')} + ${spare}`)

    const five = bestFive(hand)
    // bestFive keeps the solver's order: the two pairs first, then the kicker.
    t.deepEqual(
      [...new Set(five.slice(0, 4).map((c) => c.rank))],
      [pairs[0], pairs[1]],
      'the two highest pairs play',
    )
    const [third] = pairs.slice(2)
    const higher = RANKS.indexOf(third) > RANKS.indexOf(spare) ? third : spare
    t.is(five[4].rank, higher, 'the kicker is the higher of the third pair and the spare')
    // The other card of the third pair is never in the hand, whatever it is.
    t.is(five.filter((c) => c.rank === third).length, higher === third ? 1 : 0)
    if (higher === third) kickerFromThirdPair++
  })

  t.is(kickerFromThirdPair, THIRD_PAIR_IS_THE_KICKER)
  t.is(kickerFromThirdPair * 4, shapes.length, 'one shape in four, exactly')
})

// The sweep above walks the suits but pairs each shape with one deal. This
// pins the premise that lets it: for a fixed rank shape, all 864 suit deals
// grade the same, because four distinct ranks cannot make a straight and three
// pairs plus a spare cannot put five cards in one suit.
test('suits cannot change the grade of a three-pair holding', (t) => {
  const grades = new Set<string>()
  let deals = 0
  for (let nth = 0; nth < SUIT_DEALS_PER_SHAPE; nth++) {
    const seven = sevenCards(['A', 'K', '9'], '5', nth)
    const bySuit = new Map<Suit, number>()
    for (const c of seven) bySuit.set(c.suit, (bySuit.get(c.suit) ?? 0) + 1)
    t.true(Math.max(...bySuit.values()) < 5, 'no five cards of one suit')
    grades.add(evaluateHand(seven.slice(0, 2), seven.slice(2)).description)
    deals++
  }
  t.is(deals, SUIT_DEALS_PER_SHAPE)
  t.deepEqual([...grades], ["Two Pair, A's & K's"])
})

// --- The view from the seat holding the pocket pair -------------------------

test('a quarter of the time your pocket pair is not in your hand at all', (t) => {
  const byCards = new Map<number, number>()
  let shapes = 0
  for (let pocket = 0; pocket < RANKS.length; pocket++) {
    for (let x = 0; x < RANKS.length; x++) {
      for (let y = 0; y < x; y++) {
        for (let spare = 0; spare < RANKS.length; spare++) {
          if (new Set([pocket, x, y, spare]).size !== 4) continue
          const hole = [card(RANKS[pocket], 's'), card(RANKS[pocket], 'd')]
          const board = [
            card(RANKS[x], 'c'),
            card(RANKS[x], 'h'),
            card(RANKS[y], 'c'),
            card(RANKS[y], 'h'),
            card(RANKS[spare], 's'),
          ]
          const five = bestFive(evaluateHand(hole, board))
          const mine = five.filter((c) => RANKS.indexOf(c.rank) === pocket).length
          byCards.set(mine, (byCards.get(mine) ?? 0) + 1)
          shapes++
        }
      }
    }
  }
  t.is(shapes, POCKET_PAIR_SHAPES)
  t.is(shapes, RANKS.length * choose(12, 2) * 10)
  for (const role of POCKET_PAIR_ROLES) t.is(byCards.get(role.cards), role.shapes, role.role)
  t.is(
    POCKET_PAIR_ROLES.reduce((sum, role) => sum + role.shapes, 0),
    POCKET_PAIR_SHAPES,
  )
})

// --- The two spots the page walks through -----------------------------------

/** The hero's grade and best five, and whether the villain's spare beats it. */
function settle(spot: WorkedSpot) {
  const hand = evaluateHand(cards(spot.hole), cards(spot.board))
  const { winners } = determineWinners(
    [
      { id: 'hero' as const, hole: cards(spot.hole) },
      { id: 'villain' as const, hole: cards(spot.villain) },
    ],
    cards(spot.board),
  )
  return { hand, five: bestFive(hand), winners }
}

test('the kicker spot: the eights play, and one pip settles the pot', (t) => {
  const { hand, five, winners } = settle(KICKER_SPOT)
  t.is(hand.name, 'Two Pair')
  t.is(hand.description, KICKER_SPOT.description)
  t.deepEqual(
    five.map((c) => `${c.rank}${c.suit}`),
    ['Ac', 'Ah', 'Kc', 'Kh', '8s'],
  )
  t.deepEqual(winners, ['hero'])
  // The villain has the same two pair off the board and a worse fifth card,
  // which is the whole of the difference.
  const villain = evaluateHand(cards(KICKER_SPOT.villain), cards(KICKER_SPOT.board))
  t.is(villain.description, KICKER_SPOT.description)
  t.is(bestFive(villain)[4].rank, '7')
})

test('the board spot: the threes do nothing, and the pot is split', (t) => {
  const { hand, five, winners } = settle(BOARD_SPOT)
  t.is(hand.description, BOARD_SPOT.description)
  t.deepEqual(
    five.map((c) => `${c.rank}${c.suit}`),
    BOARD_SPOT.board as string[],
    'the best five are the five on the table',
  )
  t.deepEqual(winners, ['hero', 'villain'])
})

test('neither worked spot deals a card twice', (t) => {
  for (const spot of [KICKER_SPOT, BOARD_SPOT]) {
    const all = [...spot.hole, ...spot.board, ...spot.villain]
    t.is(new Set(all).size, all.length)
  }
})
