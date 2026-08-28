import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'ava'
import {
  README_TOSTRING_QUOTE,
  SOLVER_CASES,
  SOLVER_VERSION,
  solverCase,
} from '@/config/pokersolverQuirks'
import { cardFromString, cardToString, type Card } from '@/lib/poker/cards'
import { bestFive, evaluateHand } from '@/lib/poker/handEval'

// /blog/pokersolver-undocumented publishes seven worked cases and says they are
// what a named version of somebody else's library does. That is two claims
// nothing else in this build looks at: the outputs, and the README sentence one
// of them contradicts.
//
// It is also the guard the wrapper never had. bestFive() asserts three of these
// behaviours in a doc comment (the overflow, the low ace, the ordering) and a
// comment about a dependency is checked by nobody. A minor version that changed
// any of them would break the wrapper silently and leave the post wrong at a
// permanent URL. So the post and the guard are the same file.

const require = createRequire(import.meta.url)
const { Hand } = require('pokersolver')
const solverPackage = require('pokersolver/package.json')

const h = (...s: string[]): Card[] => s.map(cardFromString)

for (const c of SOLVER_CASES) {
  test(`the post's "${c.id}" case is what pokersolver still does`, (t) => {
    const solved = Hand.solve(c.input)
    t.deepEqual(
      solved.cards.map((card: { toString(): string }) => card.toString()),
      c.cards,
      `${c.id}: hand.cards changed`,
    )
    t.is(solved.name, c.name, `${c.id}: hand.name changed`)
    t.is(solved.descr, c.descr, `${c.id}: hand.descr changed`)
  })
}

test('the post names the version that is actually installed', (t) => {
  t.is(solverPackage.version, SOLVER_VERSION)
})

test('the README still promises the five-card maximum the post says it breaks', (t) => {
  const readme = readFileSync(require.resolve('pokersolver/README.md'), 'utf-8')
  t.true(
    readme.includes(README_TOSTRING_QUOTE),
    'the README sentence the post quotes is gone: re-read it before the post says it is there',
  )
  const solved = Hand.solve(solverCase('flush-seven').input)
  t.is(
    solved.toString().split(', ').length,
    7,
    'toString() no longer overflows, so the post’s one contradiction claim would be false',
  )
})

// The three claims bestFive()'s comment makes, each exercised through our own
// wrapper rather than through the library, because the wrapper is what breaks.
test('bestFive takes five from an overflowing hand, hand-making cards first', (t) => {
  const flush = bestFive(evaluateHand(h('Ah', 'Kh'), h('9h', '7h', '5h', '3h', '2c')))
  t.is(flush.map(cardToString).join(' '), 'Ah Kh 9h 7h 5h')

  const boat = bestFive(evaluateHand(h('As', 'Ah'), h('Ad', 'Ks', 'Kh', 'Kd', '2c')))
  t.is(boat.map(cardToString).join(' '), 'As Ah Ad Ks Kh')

  // The ordering that would break if the solver sorted the overflow by rank
  // rather than leaving the hand-making cards first: trips lower than the pair.
  const lowTrips = bestFive(evaluateHand(h('3s', '3h'), h('3d', 'As', 'Ah', '7c', '2d')))
  t.is(lowTrips.map(cardToString).join(' '), '3s 3h 3d As Ah')
})

test('bestFive turns the low ace back into an ace', (t) => {
  const wheel = bestFive(evaluateHand(h('5h', '4c'), h('3d', '2s', 'Ah', 'Kd', 'Qc')))
  t.is(wheel.map(cardToString).join(' '), '5h 4c 3d 2s Ah')
})

// The post says our determineWinners identifies winners by object identity, and
// that this works because Hand.winners hands back the objects it was given. If
// that ever stopped being true every showdown in the game would misreport, so it
// is worth one test on the library directly rather than through a hand.
test('Hand.winners returns the same objects it was passed', (t) => {
  const a = Hand.solve(['As', 'Ks', 'Qs', 'Js', 'Ts'])
  const b = Hand.solve(['Ah', 'Kh', 'Qh', 'Jh', 'Th'])
  const winners = Hand.winners([a, b])
  t.is(winners.length, 2)
  t.true(winners.includes(a) && winners.includes(b))
})
