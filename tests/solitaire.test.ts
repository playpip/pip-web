import test from 'ava'
import { cardFromString, cardToString, mulberry32 } from '@/lib/poker/cards'
import {
  CELLS,
  dailySolitaire,
  dealSolitaire,
  emptyGrid,
  LINES,
  linesThrough,
  place,
  SOLITAIRE_POINTS,
  scoreGrid,
  scoreHand,
} from '@/lib/quick/solitaire'

// Poker Solitaire's rules and score (lib/quick/solitaire). The score table is
// what the "How it scores" sheet shows, so every hand on it is checked here
// against the engine's own evaluator, and a better hand always scores more.

const hand = (s: string) => s.split(' ').map(cardFromString)

test('every hand on the table scores what the table says', (t) => {
  const cases: [string, string, number][] = [
    ['As Ks Qs Js Ts', 'Royal Flush', 100],
    ['9h Th Jh Qh Kh', 'Straight Flush', 75],
    ['Ah 2h 3h 4h 5h', 'Straight Flush', 75],
    ['7c 7d 7h 7s 2c', 'Four of a Kind', 50],
    ['Kc Kd Kh 4s 4c', 'Full House', 25],
    ['2d 7d 9d Jd Kd', 'Flush', 20],
    ['Ac 2d 3h 4s 5c', 'Straight', 15],
    ['Tc Jd Qh Ks Ac', 'Straight', 15],
    ['8c 8d 8h Ks 2c', 'Three of a Kind', 10],
    ['8c 8d Kh Ks 2c', 'Two Pair', 5],
    ['8c 8d Qh Ks 2c', 'Pair', 2],
  ]
  for (const [cards, name, points] of cases) {
    t.deepEqual(scoreHand(hand(cards)), { hand: name, points }, cards)
  }
  t.deepEqual(
    scoreHand(hand('2c 5d 9h Js Kc')),
    { hand: null, points: 0 },
    'a high card is no hand',
  )
  t.deepEqual(scoreHand(hand('Qc Kd Ah 2s 3c')), { hand: null, points: 0 }, 'no wrapping straight')
})

test('a better hand always scores more', (t) => {
  for (let i = 1; i < SOLITAIRE_POINTS.length; i++) {
    t.true(SOLITAIRE_POINTS[i - 1].points > SOLITAIRE_POINTS[i].points, SOLITAIRE_POINTS[i].hand)
  }
})

test('the ten lines are the five rows and the five columns, each cell on exactly two', (t) => {
  t.is(LINES.length, 10)
  for (let cell = 0; cell < CELLS; cell++) {
    const through = linesThrough(cell)
    t.is(through.length, 2, `cell ${cell}`)
    t.deepEqual(through.map((l) => l.kind).sort(), ['column', 'row'])
  }
  t.deepEqual(LINES[0].cells, [0, 1, 2, 3, 4])
  t.deepEqual(LINES[5].cells, [0, 5, 10, 15, 20])
})

test('a card goes in an empty cell and never moves', (t) => {
  const g = place(emptyGrid(), 12, cardFromString('As'))
  t.truthy(g)
  t.is(place(g ?? [], 12, cardFromString('Kd')), null, 'a taken cell')
  t.is(place(emptyGrid(), 25, cardFromString('Kd')), null, 'off the grid')
  t.is(place(emptyGrid(), -1, cardFromString('Kd')), null)
})

test('only full lines score, and the total is their sum', (t) => {
  // Row 0 a royal flush, column 0 then four more cards under the ace.
  let grid = emptyGrid()
  for (const [cell, card] of [
    [0, 'As'],
    [1, 'Ks'],
    [2, 'Qs'],
    [3, 'Js'],
    [4, 'Ts'],
    [5, 'Ad'],
    [10, 'Ac'],
    [15, 'Ah'],
    [20, '2c'],
  ] as const) {
    grid = place(grid, cell, cardFromString(card)) ?? grid
  }
  const { lines, total } = scoreGrid(grid)
  t.is(lines.length, 2)
  t.deepEqual(
    lines.map((l) => [l.line.kind, l.hand, l.points]),
    [
      ['row', 'Royal Flush', 100],
      ['column', 'Four of a Kind', 50],
    ],
  )
  t.is(total, 150)
})

test('a full grid scores all ten lines', (t) => {
  let grid = emptyGrid()
  const deal = dealSolitaire(mulberry32(7))
  deal.forEach((card, i) => {
    grid = place(grid, i, card) ?? grid
  })
  const { lines, total } = scoreGrid(grid)
  t.is(lines.length, 10)
  t.is(
    total,
    lines.reduce((s, l) => s + l.points, 0),
  )
})

test('a deal is 25 different cards, and the Daily deal is the same for everyone that day', (t) => {
  const deal = dealSolitaire(mulberry32(42))
  t.is(deal.length, 25)
  t.is(new Set(deal.map(cardToString)).size, 25)
  const today = dailySolitaire('2026-11-04').map(cardToString)
  t.deepEqual(dailySolitaire('2026-11-04').map(cardToString), today)
  t.notDeepEqual(dailySolitaire('2026-11-05').map(cardToString), today)
})
