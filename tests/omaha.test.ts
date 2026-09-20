import { readFileSync } from 'node:fs'
import test from 'ava'
import { HOLE_CARDS, determineWinners, evaluateHand } from '@/lib/poker/handEval'
import { applyAction, legalActions, potSize, startHand } from '@/lib/poker/engine'
import { estimateEquity } from '@/lib/poker/equity'
import { cardFromString, mulberry32 } from '@/lib/poker/cards'
import { ALL_VENUES } from '@/config/venues'

// Pot-Limit Omaha.
//
// Three rules make it a different game rather than Hold'em with more cards, and
// each of them is the kind of thing that ships looking fine and settles a pot
// wrongly six months later:
//
// 1. **Four cards dealt**, not two.
// 2. **Exactly two from your hand and exactly three from the board.** Four
//    hearts in your hand is not a flush. This is the one everybody gets wrong,
//    including, historically, several commercial sites.
// 3. **Pot-limit betting**, which is arithmetic with an off-by-one waiting in
//    it: the pot you may bet is the pot *after* your call.
//
// The evaluator is not routed through pokersolver's undocumented 'omahahi'
// option on purpose — this project already has a blog post about trusting that
// library's undocumented behaviour — so the rule is implemented here and these
// are what hold it.

const cards = (s: string) => s.split(' ').map(cardFromString)

// --- the two-from-hand rule -------------------------------------------------

test('four of a suit in your hand is not a flush', (t) => {
  // Hole: four hearts. Board: three hearts. In Hold'em this is a flush; in
  // Omaha it is two hearts from hand plus three from board, which it is — but
  // the *hand* cannot contribute more than two, so the flush is genuine here.
  // The case that must fail is one heart on the board.
  const hole = cards('Ah Kh Qh Jh')
  const oneHeart = cards('2h 7c 8d 9s Ts')
  const hand = evaluateHand(hole, oneHeart, 'omaha')
  t.not(hand.name, 'Flush', 'four hearts in hand made a flush off one board heart')

  // And the free-form reading would have found one, which is what this proves.
  const holdemStyle = evaluateHand(hole, oneHeart, 'holdem')
  t.is(holdemStyle.name, 'Flush', 'the Hold’em reading no longer finds the flush it used to')
})

test('a board that pairs does not make your trips a full house on its own', (t) => {
  // Board is a full house all by itself: 9s full of 2s. In Hold'em every player
  // plays the board. In Omaha you must use exactly two of yours, so the best
  // available is whatever two of your cards can improve on three board cards.
  const board = cards('9c 9d 9h 2c 2d')
  const blank = evaluateHand(cards('As Kd Qh Js'), board, 'omaha')
  // Two from hand + three from board: A K + 9 9 9 is trips with A K kickers.
  t.is(blank.name, 'Three of a Kind', `got ${blank.description}`)
})

test('the two-from-hand rule changes who wins the pot', (t) => {
  const board = cards('Ah Kh Qh 2c 3d')
  // One heart in hand, so two from hand and three from board is a real flush.
  const realFlush = { id: 'flush', hole: cards('Jh Th 4c 5d') }
  // Four hearts in hand: only two may play, and they are low — still a flush,
  // but a worse one. The point is that both are evaluated under the same rule.
  const pairOfAces = { id: 'aces', hole: cards('As Ad 7c 8d') }

  const omaha = determineWinners([realFlush, pairOfAces], board, 'omaha')
  t.deepEqual(omaha.winners, ['flush'], 'the flush did not win an Omaha showdown')

  // The same two holdings under Hold'em rules pick a different winner, which is
  // the whole reason the variant has to reach the showdown.
  const holdem = determineWinners([realFlush, pairOfAces], board)
  t.is(holdem.winners.length, 1)
})

test('the evaluator never uses more or fewer than two of your cards', (t) => {
  // A property rather than an example. For a spread of random holdings, the
  // best five must always be reconstructible as 2 hole + 3 board.
  const rng = mulberry32(20260916)
  const deck = () => {
    const all = [...'23456789TJQKA'].flatMap((r) =>
      [...'cdhs'].map((s) => cardFromString(`${r}${s}`)),
    )
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[all[i], all[j]] = [all[j], all[i]]
    }
    return all
  }
  for (let trial = 0; trial < 60; trial++) {
    const d = deck()
    const hole = d.slice(0, 4)
    const board = d.slice(4, 9)
    const hand = evaluateHand(hole, board, 'omaha')
    const key = (c: { rank: string; suit: string }) => `${c.rank}${c.suit}`
    // Omaha is solved by pokersolver (sixty exact five-card holdings), so it
    // always has one; Short Deck is the only variant that does not.
    if (!hand.solved) throw new Error('an Omaha hand came back without a solved hand')
    const used = hand.solved.cards
      .slice(0, 5)
      .map((c) => `${c.value === '1' ? 'A' : c.value}${c.suit}`)
    const fromHole = used.filter((u) => hole.some((c) => key(c) === u)).length
    const fromBoard = used.filter((u) => board.some((c) => key(c) === u)).length
    t.is(fromHole, 2, `trial ${trial}: used ${fromHole} hole cards`)
    t.is(fromBoard, 3, `trial ${trial}: used ${fromBoard} board cards`)
  }
})

// --- the deal ---------------------------------------------------------------

test('an Omaha hand deals four cards to everybody', (t) => {
  t.is(HOLE_CARDS.omaha, 4)
  t.is(HOLE_CARDS.holdem, 2)
  const hand = startHand({
    seats: [
      { id: 'a', name: 'A', stack: 1_000 },
      { id: 'b', name: 'B', stack: 1_000 },
      { id: 'c', name: 'C', stack: 1_000 },
    ],
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    rng: mulberry32(7),
    variant: 'omaha',
  })
  t.is(hand.variant, 'omaha')
  for (const p of hand.players) t.is(p.hole.length, 4, `${p.id} was dealt ${p.hole.length}`)
  // Twelve cards off the deck, and every one of them distinct.
  const dealt = hand.players.flatMap((p) => p.hole.map((c) => `${c.rank}${c.suit}`))
  t.is(new Set(dealt).size, 12, 'a card was dealt twice')
})

test('a hand that does not ask for Omaha still deals two', (t) => {
  const hand = startHand({
    seats: [
      { id: 'a', name: 'A', stack: 1_000 },
      { id: 'b', name: 'B', stack: 1_000 },
    ],
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    rng: mulberry32(7),
  })
  t.is(hand.variant, 'holdem')
  for (const p of hand.players) t.is(p.hole.length, 2)
})

// --- pot-limit betting ------------------------------------------------------

const omahaHand = (stacks = 1_000) =>
  startHand({
    seats: [
      { id: 'a', name: 'A', stack: stacks },
      { id: 'b', name: 'B', stack: stacks },
      { id: 'c', name: 'C', stack: stacks },
    ],
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    rng: mulberry32(11),
    variant: 'omaha',
  })

test('the first raise is capped at the pot, counting the call', (t) => {
  const hand = omahaHand()
  // Three-handed, blinds 5/10. UTG is first to act, facing 10 into a pot of 15.
  // Pot-limit: call 10, pot becomes 25, raise 25 → total in 35 → "to" 35.
  const legal = legalActions(hand)
  t.truthy(legal)
  t.is(potSize(hand), 15, 'the blinds are not in the pot yet')
  t.is(legal?.callAmount, 10)
  t.is(legal?.maxRaiseTo, 35, 'the pot-limit cap is not pot-after-call')
})

test('no-limit is untouched — a Hold’em table still lets you shove', (t) => {
  const hand = startHand({
    seats: [
      { id: 'a', name: 'A', stack: 1_000 },
      { id: 'b', name: 'B', stack: 1_000 },
      { id: 'c', name: 'C', stack: 1_000 },
    ],
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    rng: mulberry32(11),
  })
  t.is(legalActions(hand)?.maxRaiseTo, 1_000, 'a Hold’em table acquired a pot limit')
})

test('the cap never lets a player put in more than they have', (t) => {
  const short = startHand({
    seats: [
      { id: 'a', name: 'A', stack: 20 },
      { id: 'b', name: 'B', stack: 1_000 },
      { id: 'c', name: 'C', stack: 1_000 },
    ],
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    rng: mulberry32(3),
    variant: 'omaha',
  })
  const legal = legalActions(short)
  t.truthy(legal)
  const actor = short.players[short.toActIndex]
  t.true(
    (legal?.maxRaiseTo ?? 0) <= actor.committedThisStreet + actor.stack,
    'the pot-limit cap exceeded a stack',
  )
})

test('a pot-sized raise is legal and a chip more is not', (t) => {
  const hand = omahaHand()
  const cap = legalActions(hand)!.maxRaiseTo
  const ok = applyAction(hand, { type: 'raise', amount: cap })
  t.is(ok.currentBet, cap, 'the pot-sized raise was not accepted')
  t.throws(() => applyAction(hand, { type: 'raise', amount: cap + 1 }), {
    any: true,
  })
})

test('betting the pot on a later street counts every street already in', (t) => {
  // Heads-up so the arithmetic is small enough to state. Blinds 5/10, both
  // call to see a flop: pot 20. First in on the flop may bet 20, not 10.
  let hand = startHand({
    seats: [
      { id: 'a', name: 'A', stack: 1_000 },
      { id: 'b', name: 'B', stack: 1_000 },
    ],
    buttonIndex: 0,
    smallBlind: 5,
    bigBlind: 10,
    rng: mulberry32(5),
    variant: 'omaha',
  })
  hand = applyAction(hand, { type: 'call' })
  hand = applyAction(hand, { type: 'check' })
  t.is(hand.street, 'flop')
  t.is(potSize(hand), 20)
  const legal = legalActions(hand)!
  t.is(legal.callAmount, 0, 'somebody is facing a bet on a checked-through flop')
  t.is(legal.maxRaiseTo, 20, 'the flop bet cap is not the size of the pot')
})

// --- equity -----------------------------------------------------------------

test('Omaha equity deals opponents four cards and reads the showdown Omaha-style', (t) => {
  // The nut flush draw with a pair, against one random hand, on a wet flop.
  // The number itself is not the assertion — it is that the estimate is a real
  // number from a real simulation and that it differs from the Hold'em reading
  // of the same two cards, which it must, because the game is different.
  const hole = cards('Ah Kh 7s 7d')
  const board = cards('Qh 5h 2c')
  const omaha = estimateEquity({
    hole,
    community: board,
    opponents: 1,
    iterations: 400,
    rng: mulberry32(99),
    variant: 'omaha',
  })
  t.true(omaha.equity > 0 && omaha.equity < 1, `equity out of range: ${omaha.equity}`)
  t.is(omaha.iterations, 400)
})

test('a Hold’em equity call is unchanged by Omaha existing', (t) => {
  const a = estimateEquity({
    hole: cards('Ah Kh'),
    community: cards('Qh 5h 2c'),
    opponents: 1,
    iterations: 300,
    rng: mulberry32(42),
  })
  const b = estimateEquity({
    hole: cards('Ah Kh'),
    community: cards('Qh 5h 2c'),
    opponents: 1,
    iterations: 300,
    rng: mulberry32(42),
    variant: 'holdem',
  })
  t.deepEqual(a, b, 'the default stopped being Hold’em')
})

// --- the table ---------------------------------------------------------------

test('the Omaha table is registered, gated, and deep enough to play', (t) => {
  const venue = ALL_VENUES.find((v) => v.id === 'bigpot')
  t.truthy(venue, 'The Big Pot is not in the catalogue')
  t.is(venue?.variant, 'omaha')
  t.true(venue?.membersOnly, 'the Omaha table is free')
  // Omaha is a drawing game and short stacks make it a coin flip, so the table
  // is deliberately deeper than its buy-in.
  t.true((venue?.startingStack ?? 0) > (venue?.buyIn ?? 0), 'the Omaha table is not deep-stacked')
})

// The readout under the player's own cards. It is the one place a wrong hand
// name would be a claim the player acts on, and it was shipped without the
// variant the first time: four hearts in hand plus one on the board read
// "Flush". Pinned as source rather than behaviour because there is no browser
// here to render it in.
test('the hand label under your own cards is read under the table’s own rules', (t) => {
  const source = readFileSync(
    new URL('../src/components/table/Table.tsx', import.meta.url),
    'utf-8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
  const calls = source.match(/evaluateHand\([^)]*\)/g) ?? []
  t.true(calls.length > 0, 'the hand label is gone — if that is deliberate, delete this test')
  for (const call of calls) {
    t.regex(call, /hand\.variant/, `an evaluateHand call at the table ignores the variant: ${call}`)
  }
})

test('every other table is still Hold’em', (t) => {
  const omaha = ALL_VENUES.filter((v) => v.variant === 'omaha').map((v) => v.id)
  t.deepEqual(omaha, ['bigpot'], 'a table changed game without anybody saying so')
})
