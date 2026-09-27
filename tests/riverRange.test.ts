import test from 'ava'
import {
  BIG_BET,
  BLUFF_WEIGHTS,
  PLAYABLE,
  bettingRange,
  count,
  describe,
  facing,
  fastScore,
  handScore,
  hasSomething,
  riverRange,
  weigh,
} from '@/lib/drills/riverRange'
import {
  type Card,
  type Rank,
  SUITS,
  cardFromString,
  mulberry32,
  shuffle,
  shuffledDeck,
} from '@/lib/poker/cards'
import { determineWinners } from '@/lib/poker/handEval'
import { holeStrength } from '@/lib/poker/range'

// The river pack's range model. The claim this file holds it to is the one
// that makes the pack gradeable at a four-point margin: **the equity is a count,
// not an estimate.** So the tests check the count against the showdown code
// itself, hand by hand, and check that each of the model's stated rules does
// what the lesson says it does.

const cards = (text: string): Card[] => text.split(' ').map(cardFromString)
const key = (c: Card) => `${c.rank}${c.suit}`

test('a hand score orders hands exactly as the showdown does', (t) => {
  // `handScore` is `Hand.compare` written as a number. If the two ever
  // disagreed, the value cut and the equity would both be quietly wrong, so
  // they are held to each other over a few hundred random pairs of hands.
  const rng = mulberry32(7)
  for (let i = 0; i < 400; i++) {
    const deck = shuffledDeck(rng)
    const a = deck.slice(0, 2)
    const b = deck.slice(2, 4)
    const board = deck.slice(4, 9)
    const { winners } = determineWinners(
      [
        { id: 'a', hole: a },
        { id: 'b', hole: b },
      ],
      board,
    )
    const [sa, sb] = [handScore(a, board), handScore(b, board)]
    if (winners.length === 2) t.is(sa, sb, `seed ${i}: a split pot scored differently`)
    else if (winners[0] === 'a') t.true(sa > sb, `seed ${i}`)
    else t.true(sb > sa, `seed ${i}`)
  }
})

test('the fast score is the solver’s score, on every kind of hand', (t) => {
  // The fast path may only ever be a quicker route to the solver's answer. Random
  // deals almost never make quads or a straight flush, so the second half deals
  // from a handful of ranks, where the rare hands are common.
  const rng = mulberry32(11)
  let checked = 0
  for (let i = 0; i < 20_000; i++) {
    const deck = shuffledDeck(rng)
    t.is(fastScore(deck.slice(0, 7)), handScore(deck.slice(0, 2), deck.slice(2, 7)))
    t.is(fastScore(deck.slice(0, 5)), handScore([], deck.slice(0, 5)))
    checked++
  }
  const categories = new Set<number>()
  const narrow: Rank[][] = [
    ['A', '2', '3', '4', '5'],
    ['T', 'J', 'Q', 'K', 'A'],
    ['2', '3', '4'],
    ['5', '6', '7', '8', '9'],
    ['9', 'T', 'J', 'Q', 'K', 'A', '2'],
  ]
  for (const ranks of narrow) {
    for (let i = 0; i < 3_000; i++) {
      const deck = shuffle(
        ranks.flatMap((rank) => SUITS.map((suit) => ({ rank, suit }))),
        rng,
      ).slice(0, 7)
      const solver = handScore(deck.slice(0, 2), deck.slice(2))
      t.is(fastScore(deck), solver)
      categories.add(Math.floor(solver / 15 ** 5))
      checked++
    }
  }
  t.is(checked, 35_000)
  t.deepEqual(
    [...categories].sort(),
    [2, 3, 4, 5, 6, 7, 8, 9],
    'the narrow decks stopped reaching every category above high card',
  )
})

test('something worth betting is a pair of your own or a draw', (t) => {
  const flop = cards('Kh 7d 2c')
  t.true(hasSomething(cards('Ks 4c'), flop), 'top pair')
  t.true(hasSomething(cards('5s 5c'), flop), 'a pocket pair')
  t.true(hasSomething(cards('Ah 4h'), cards('Kh 7h 2c')), 'four to a flush')
  t.true(hasSomething(cards('8s 9c'), cards('Th 7d 2c')), 'four to a straight, open-ended')
  t.true(hasSomething(cards('Ac 5s'), cards('2h 3d Kc')), 'the wheel draw, ace playing low')
  t.false(hasSomething(cards('Qs Jc'), flop), 'two overcards is nothing')
  t.false(
    hasSomething(cards('2s 3d'), cards('Jh Th 9c 8c')),
    'four to a straight is only a draw if one of the four is yours',
  )
  t.false(hasSomething(cards('As 4d'), cards('Kh 7h 2h')), 'one heart is not a flush draw')
})

const HERO = cards('Ah Jd')
const BOARD = cards('Jc 8s 3h 2d Kc')

test('the range leaves out your cards, the board, and hands nobody plays', (t) => {
  const range = riverRange(HERO, BOARD, { flop: 'check', turn: 'check' })
  const dead = new Set([...HERO, ...BOARD].map(key))
  t.true(range.length > 100)
  for (const combo of range) {
    t.false(
      combo.hole.some((c) => dead.has(key(c))),
      'a card that is already out',
    )
    t.true(holeStrength(combo.hole, []) >= PLAYABLE, 'a hand below the preflop gate')
  }
})

test('a bet on a street keeps only hands that had something there; a check keeps all', (t) => {
  const checked = riverRange(HERO, BOARD, { flop: 'check', turn: 'check' })
  const flopBet = riverRange(HERO, BOARD, { flop: 'bet', turn: 'check' })
  const bothBet = riverRange(HERO, BOARD, { flop: 'bet', turn: 'bet' })
  t.true(flopBet.length < checked.length)
  t.true(bothBet.length <= flopBet.length)
  for (const combo of flopBet) t.true(hasSomething(combo.hole, BOARD.slice(0, 3)))
  for (const combo of bothBet) t.true(hasSomething(combo.hole, BOARD.slice(0, 4)))
  // And nothing a bet keeps was missing from the check: a filter, not a
  // different range.
  const all = new Set(checked.map((c) => c.hole.map(key).join()))
  for (const combo of bothBet) t.true(all.has(combo.hole.map(key).join()))
})

test('the value cut never splits a tie, and a bigger bet is a narrower range', (t) => {
  const range = riverRange(HERO, BOARD, { flop: 'check', turn: 'check' })
  const standard = bettingRange(range, 1 / 2)
  const big = bettingRange(range, 1)
  t.true(big.value.length < standard.value.length)
  const made = range.filter((c) => c.made)
  t.true(standard.value.length >= Math.ceil(made.length / 2))
  t.true(big.value.length >= Math.ceil(made.length / 3))
  for (const cut of [standard, big]) {
    const weakest = Math.min(...cut.value.map((c) => c.score))
    const outside = made.filter((c) => !cut.value.includes(c))
    t.true(
      outside.every((c) => c.score < weakest),
      'a hand tied with the weakest value hand was left out',
    )
  }
  // The misses are the same at any size: the bet changes how often they are
  // bet, never which hands they are.
  t.is(standard.missed.length, big.missed.length)
  t.true(standard.missed.every((c) => !c.made))
  t.is(BIG_BET, 2 / 3)
})

test('the equity is a count: every hand in the range, checked against the showdown', (t) => {
  // The load-bearing test. Rebuild the equity from `determineWinners`, hand by
  // hand, with the same weights, and it must be the same number — not close,
  // the same, because there is nothing sampled on either side.
  const rng = mulberry32(99)
  let checked = 0
  for (let i = 0; i < 12; i++) {
    const deck = shuffledDeck(rng)
    const hero = deck.slice(0, 2)
    const board = deck.slice(2, 7)
    const line = { flop: i % 2 ? 'bet' : 'check', turn: i % 3 ? 'check' : 'bet' } as const
    const range = riverRange(hero, board, line)
    const fraction = i % 4 === 0 ? 1 : 1 / 2
    const { value, missed } = bettingRange(range, fraction)
    for (const weight of Object.values(BLUFF_WEIGHTS)) {
      let won = 0
      let total = 0
      for (const [combos, w] of [
        [value, 1],
        [missed, weight],
      ] as const) {
        for (const combo of combos) {
          const { winners } = determineWinners(
            [
              { id: 'hero', hole: hero },
              { id: 'them', hole: combo.hole },
            ],
            board,
          )
          total += w
          if (winners.includes('hero')) won += w / winners.length
        }
      }
      const f = facing(hero, board, range, fraction, weight)
      t.true(Math.abs(f.equity - won / total) < 1e-12, `seed ${i} at ${weight}`)
      checked++
    }
  }
  t.is(checked, 36)
})

test('more bluffing never moves the equity past both ends, so checking the ends is enough', (t) => {
  // The generator only checks the lowest and highest bluffing rates. That is
  // sound because the equity is (a + w·b) / (c + w·d), which is monotone in w:
  // anything true at both ends is true everywhere between.
  const rng = mulberry32(5)
  for (let i = 0; i < 10; i++) {
    const deck = shuffledDeck(rng)
    const hero = deck.slice(0, 2)
    const board = deck.slice(2, 7)
    const counted = count(hero, board, riverRange(hero, board, { flop: 'bet', turn: 'check' }), 0.5)
    const at = (w: number) => weigh(counted, w).equity
    const [lo, hi] = [at(BLUFF_WEIGHTS.low), at(BLUFF_WEIGHTS.high)]
    for (let w = BLUFF_WEIGHTS.low; w <= BLUFF_WEIGHTS.high; w += 0.01) {
      const e = at(w)
      t.true(e >= Math.min(lo, hi) - 1e-12 && e <= Math.max(lo, hi) + 1e-12, `seed ${i} at ${w}`)
    }
  }
})

test('the three bluffing rates are in order and the typical one sits between', (t) => {
  t.true(BLUFF_WEIGHTS.low < BLUFF_WEIGHTS.typical)
  t.true(BLUFF_WEIGHTS.typical < BLUFF_WEIGHTS.high)
  t.true(BLUFF_WEIGHTS.high <= 1, 'a missed hand bet more often than a value hand')
})

test('a made hand is named the way a player would say it', (t) => {
  t.is(describe(cards('Qs 4d'), cards('Qh 9c 7s 3d 2c')), 'a pair of queens')
  t.is(describe(cards('Ks 7d'), cards('Kh 7c 2s 3d 9c')), 'two pair, kings and sevens')
  t.is(describe(cards('9s 9d'), cards('9h Kc 2s 3d 7c')), 'three nines')
  t.is(describe(cards('Qs Jd'), cards('Th 9c 8s 3d 2c')), 'a straight')
  t.is(describe(cards('Ks Kd'), cards('Kh 7c 7s 3d 2c')), 'a full house, kings full of sevens')
})
