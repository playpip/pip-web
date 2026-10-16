// rankHoldem orders Hold'em hands for the Monte-Carlo loop, so the one thing
// it has to get right is who wins. pokersolver (through determineWinners) is
// the reference: the same winners on random showdowns, chops included, and the
// edges a bitmask evaluator is likeliest to get wrong written out by hand.

import test from 'ava'
import { cardFromString, mulberry32, shuffledDeck } from '@/lib/poker/cards'
import { determineWinners } from '@/lib/poker/handEval'
import { CATEGORY, categoryOf, rankHoldem } from '@/lib/poker/rank7'

const cards = (s: string) => s.split(' ').map(cardFromString)
const rank = (hole: string, board: string) => rankHoldem(cards(hole), cards(board))

test('the same winners as pokersolver on random showdowns, ties included', (t) => {
  const rng = mulberry32(2026)
  let ties = 0
  for (let i = 0; i < 6000; i++) {
    const deck = shuffledDeck(rng)
    const players = i % 2 === 0 ? 2 : 4
    const holes = Array.from({ length: players }, (_, p) => deck.slice(p * 2, p * 2 + 2))
    const board = deck.slice(players * 2, players * 2 + 5)
    const ranks = holes.map((h) => rankHoldem(h, board))
    const best = Math.max(...ranks)
    const mine = ranks.flatMap((r, p) => (r === best ? [p] : []))
    const theirs = determineWinners(
      holes.map((hole, p) => ({ id: p, hole })),
      board,
    ).winners.sort((a, b) => a - b)
    if (mine.length > 1) ties++
    if (mine.join() !== theirs.join()) {
      t.fail(`showdown ${i}: rankHoldem ${mine} vs pokersolver ${theirs}`)
      return
    }
  }
  t.true(ties > 50, 'the sample should include chops')
})

test('categories come out in poker order', (t) => {
  const board = '2c 7d 9h Js Kc'
  t.is(categoryOf(rank('3d 4h', board)), CATEGORY.highCard)
  t.is(categoryOf(rank('Kd 4h', board)), CATEGORY.pair)
  t.is(categoryOf(rank('Kd 9c', board)), CATEGORY.twoPair)
  t.is(categoryOf(rank('Kd Kh', board)), CATEGORY.trips)
  t.is(categoryOf(rank('Qd Th', board)), CATEGORY.straight)
  t.is(categoryOf(rank('Ac 5c', '2c 7c 9h Js Kc')), CATEGORY.flush)
  t.is(categoryOf(rank('Kd Ks', '2c 7d 7h Js Kc')), CATEGORY.fullHouse)
  t.is(categoryOf(rank('7c 7s', '2c 7d 7h Js Kc')), CATEGORY.quads)
  t.is(categoryOf(rank('Tc 8c', '9c Jc Qc 2d 3h')), CATEGORY.straightFlush)
})

test('the edges: wheels, a third pair, two sets, kickers that play and ones that do not', (t) => {
  // The wheel is the lowest straight, and the steel wheel the lowest straight flush.
  t.true(rank('Ad 2c', '3h 4s 5d Kc Qh') < rank('6d 2c', '3h 4s 5d Kc Qh'))
  t.true(rank('Ac 2c', '3c 4c 5c Kd Qh') < rank('6c 2c', '3c 4c 5c Kd Qh'))
  // With three pairs the best two play and the third pair's rank is only a kicker.
  t.true(rank('Qd Qh', 'Kc Kd 3s 3h 2c') > rank('Jd Jh', 'Kc Kd 3s 3h 2c'))
  t.is(rank('2d 2h', 'Kc Kd 9s 9h Ac'), rank('4d 4h', 'Kc Kd 9s 9h Ac'))
  // Two sets make a full house of the higher set over the lower.
  t.true(rank('9d 9h', '9c 4d 4s 4h Kc') > rank('8d 8h', '8c 4d 4s 4h Kc'))
  // A kicker that plays decides it; one outside the best five chops.
  t.true(rank('Ad 3h', 'Kc Kd 9s 7h 5c') > rank('Qd 3h', 'Kc Kd 9s 7h 5c'))
  t.is(rank('2d 3h', 'Ac Kd Qs Jh 9c'), rank('2s 4h', 'Ac Kd Qs Jh 9c'))
  // Quads with the board's top card as kicker chop.
  t.is(rank('2d 3h', '9c 9d 9s 9h Kc'), rank('4d 5h', '9c 9d 9s 9h Kc'))
})

test('five and six cards rank too, for the flop and the turn', (t) => {
  t.is(categoryOf(rankHoldem(cards('Ah Kh'), cards('Qh Jh Th'))), CATEGORY.straightFlush)
  t.is(categoryOf(rankHoldem(cards('Ah Ad'), cards('As 7c 7d 2h'))), CATEGORY.fullHouse)
})
