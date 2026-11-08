import test from 'ava'
import { cardToString, mulberry32, shuffledDeck } from '@/lib/poker/cards'
import { scoreGrid, scoreHand } from '@/lib/quick/solitaire'
import {
  dailyPuzzle,
  dealPuzzle,
  encodeCards,
  linePoints,
  puzzleStars,
  starAt,
} from '@/lib/quick/solitairePuzzle'

// Poker Solitaire's Puzzle (lib/quick/solitairePuzzle): every puzzle can be
// solved, because its target is the score of a grid Pip made from its cards.

test('the fast line score agrees with scoreHand on every hand tried', (t) => {
  const rng = mulberry32(11)
  for (let i = 0; i < 20_000; i++) {
    const hand = shuffledDeck(rng).slice(0, 5)
    const [a, b, c, d, e] = encodeCards(hand)
    if (linePoints(a, b, c, d, e) !== scoreHand(hand).points) {
      t.fail(hand.map(cardToString).join(' '))
      return
    }
  }
  t.pass()
})

test('every puzzle can be solved: Pip made more than the target from the same 25 cards', (t) => {
  for (let seed = 1; seed <= 15; seed++) {
    const puzzle = dealPuzzle(mulberry32(seed))
    t.is(puzzle.cards.length, 25)
    t.deepEqual(
      puzzle.solution.map(cardToString).sort(),
      puzzle.cards.map(cardToString).sort(),
      `seed ${seed}: the same cards`,
    )
    t.is(scoreGrid(puzzle.solution).total, puzzle.pip, `seed ${seed}`)
    t.true(puzzle.target <= puzzle.pip, `seed ${seed}: the target is in reach`)
    t.is(puzzle.target, Math.floor((puzzle.pip * 0.9) / 5) * 5, `seed ${seed}: 90%, to a five`)
    t.true(puzzle.target > scoreGrid(puzzle.cards).total, `seed ${seed}: there is work to do`)
  }
})

test('the same deal always has the same target, and the Daily puzzle is the same all day', (t) => {
  t.deepEqual(dealPuzzle(mulberry32(3)), dealPuzzle(mulberry32(3)))
  const today = dailyPuzzle('2026-11-08')
  t.deepEqual(dailyPuzzle('2026-11-08'), today)
  t.notDeepEqual(dailyPuzzle('2026-11-09').cards, today.cards)
})

test('stars: one at 60% of the target, two at 80%, three at the target or over', (t) => {
  t.is(starAt(1, 200), 120)
  t.is(starAt(2, 200), 160)
  t.is(starAt(3, 200), 200)
  t.is(starAt(1, 187), 113, 'rounded up')
  t.is(puzzleStars(119, 200), 0)
  t.is(puzzleStars(120, 200), 1)
  t.is(puzzleStars(160, 200), 2)
  t.is(puzzleStars(199, 200), 2)
  t.is(puzzleStars(200, 200), 3)
  t.is(puzzleStars(240, 200), 3, 'beating the target')
})
