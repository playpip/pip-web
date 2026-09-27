import test from 'ava'
import { showdownOdds } from '@/lib/poker/equity'
import { cardFromString } from '@/lib/poker/cards'
import { handStateAt, liveHands } from '@/lib/review/handState'
import type { HandEvent, HandRecord } from '@/store/game'

// Replaying a finished hand on the table it was played at.
//
// Two properties, and they are the ones that make the screen worth looking at:
//
// 1. **It shows what was recorded, and nothing it worked out for itself.** The
//    pot and the stacks ride on the events; a hand that never carried them
//    shows none rather than a plausible reconstruction.
// 2. **The odds are exact wherever exact is affordable.** Every hole card is
//    known, so the board can be dealt out rather than sampled — and the screen
//    only says "about" when it had to guess.

const cards = (...s: string[]) => s.map(cardFromString)

function record(over: Partial<HandRecord> = {}): HandRecord {
  const events: HandEvent[] = [
    {
      kind: 'action',
      playerId: 'ai1',
      playerName: 'Benny',
      type: 'fold',
      pot: 30,
      stacks: { hero: 990, ai1: 980, ai2: 970 },
    },
    {
      kind: 'action',
      playerId: 'hero',
      playerName: 'Will',
      type: 'call',
      amount: 20,
      pot: 60,
      stacks: { hero: 970, ai1: 980, ai2: 970 },
    },
    { kind: 'board', label: 'Flop', cards: cards('Ah', 'Kd', '7c') },
    {
      kind: 'action',
      playerId: 'ai2',
      playerName: 'Astrid',
      type: 'bet',
      amount: 40,
      pot: 100,
      stacks: { hero: 970, ai1: 980, ai2: 930 },
    },
  ]
  return {
    handNo: 3,
    smallBlind: 10,
    bigBlind: 20,
    events,
    community: cards('Ah', 'Kd', '7c'),
    reveals: [{ playerId: 'hero', playerName: 'Will', cards: cards('As', 'Kc') }],
    seats: [
      { id: 'hero', name: 'Will', avatar: { seed: 'w', backgroundColor: 'b6e3f4' } },
      { id: 'ai1', name: 'Benny', avatar: { seed: 'b', backgroundColor: 'c0aede' } },
      { id: 'ai2', name: 'Astrid', avatar: { seed: 'a', backgroundColor: 'd1f4d0' } },
    ],
    hole: [
      { playerId: 'hero', cards: cards('As', 'Kc') },
      { playerId: 'ai1', cards: cards('2d', '7h') },
      { playerId: 'ai2', cards: cards('Qs', 'Qh') },
    ],
    summary: 'Will wins 100',
    ...over,
  }
}

// --- the table at a step ----------------------------------------------------

test('a fold takes a seat out and leaves its cards on the table', (t) => {
  // Keeping the cards is the point: half of what a review teaches is what the
  // hand you threw away would have made.
  const { hand } = handStateAt(record(), 2)
  const benny = hand.players.find((p) => p.id === 'ai1')
  t.is(benny?.status, 'folded')
  t.is(benny?.hole.length, 2)
  t.deepEqual(
    liveHands(hand).map((h) => h.id),
    ['hero', 'ai2'],
  )
})

test('the pot and the stacks are the ones that were recorded', (t) => {
  t.is(handStateAt(record(), 1).pot, 30)
  t.is(handStateAt(record(), 2).pot, 60)
  t.is(handStateAt(record(), 4).pot, 100)
  t.is(handStateAt(record(), 4).hand.players.find((p) => p.id === 'ai2')?.stack, 930)
})

test('a hand that kept neither shows neither, rather than a guess', (t) => {
  // A hand recorded before the review shipped, or decoded from a /hand link.
  const bare = record({
    events: [{ kind: 'action', playerId: 'hero', playerName: 'Will', type: 'call', amount: 20 }],
    seats: undefined,
    hole: undefined,
    buttonId: undefined,
  })
  const frame = handStateAt(bare, 1)
  t.is(frame.pot, null)
  t.is(frame.hand.players[0].stack, 0)
  t.is(frame.hand.buttonIndex, -1, 'a hand with no button must not draw one on a seat')
  // The seats come back off the events instead, so it still replays.
  t.deepEqual(
    frame.seats.map((s) => s.name),
    ['Will'],
  )
})

test('the board and the street follow the step', (t) => {
  t.is(handStateAt(record(), 2).hand.street, 'preflop')
  t.is(handStateAt(record(), 2).hand.community.length, 0)
  t.is(handStateAt(record(), 3).hand.street, 'flop')
  t.is(handStateAt(record(), 3).hand.community.length, 3)
  t.true(handStateAt(record(), 99).done)
})

test('the step points at the event it landed on, and at who last acted', (t) => {
  // The board landing does not clear who acted: the felt still highlights
  // them, and the commentary reads the event itself.
  const onBoard = handStateAt(record(), 3)
  t.is(onBoard.lastEvent?.kind, 'board')
  t.is(onBoard.last?.playerId, 'hero')

  const onAction = handStateAt(record(), 4)
  t.is(onAction.lastEvent?.kind, 'action')
  t.is(onAction.last?.playerId, 'ai2')
  t.is(onAction.lastIndex, 3)
})

test('chips in front clear when the board moves on', (t) => {
  // They are per street. The pills standing through a flop would show money in
  // front of a player who has not bet since the last card.
  const withBets = record({
    events: [
      {
        kind: 'action',
        playerId: 'hero',
        playerName: 'Will',
        type: 'call',
        amount: 20,
        committed: { hero: 20, ai1: 20, ai2: 20 },
      },
      { kind: 'board', label: 'Flop', cards: cards('Ah', 'Kd', '7c') },
    ],
  })
  t.is(handStateAt(withBets, 1).hand.players.find((p) => p.id === 'hero')?.committedThisStreet, 20)
  t.is(handStateAt(withBets, 2).hand.players.find((p) => p.id === 'hero')?.committedThisStreet, 0)
})

// --- the odds ---------------------------------------------------------------

test('with every card known the river is one runout, not an estimate', (t) => {
  // Aces up against queens on a finished board. There is nothing left to deal,
  // so the answer is the showdown itself.
  const odds = showdownOdds(
    [
      { id: 'hero', hole: cards('As', 'Kc') },
      { id: 'ai2', hole: cards('Qs', 'Qh') },
    ],
    cards('Ah', 'Kd', '7c', '2d', '3s'),
  )
  t.true(odds.exact)
  t.is(odds.runouts, 1)
  t.is(odds.share.hero, 1)
  t.is(odds.share.ai2, 0)
})

test('the turn deals every last card, and the shares are a share of one', (t) => {
  const odds = showdownOdds(
    [
      { id: 'hero', hole: cards('As', 'Kc') },
      { id: 'ai2', hole: cards('Qs', 'Qh') },
    ],
    cards('Ah', 'Kd', '7c', '2d'),
  )
  t.true(odds.exact)
  t.is(odds.runouts, 44, 'the turn has forty-four cards left in the deck')
  t.is(Math.round((odds.share.hero + odds.share.ai2) * 1000), 1000)
  t.true(odds.share.hero > 0.9, 'two pair with an ace kicker is not a coin flip')
})

test('a chop splits the pot rather than picking a winner', (t) => {
  // The board plays: both hands are the same, and neither is ahead.
  const odds = showdownOdds(
    [
      { id: 'a', hole: cards('2c', '3d') },
      { id: 'b', hole: cards('2h', '3s') },
    ],
    cards('Ah', 'Kd', 'Qc', 'Js', 'Td'),
  )
  t.is(odds.share.a, 0.5)
  t.is(odds.share.b, 0.5)
})

test('preflop it samples, and it says so', (t) => {
  // Five cards to come off a forty-eight card deck is nearly two million
  // boards. The screen prints "about" off this flag.
  const odds = showdownOdds(
    [
      { id: 'a', hole: cards('As', 'Ad') },
      { id: 'b', hole: cards('7c', '2h') },
    ],
    [],
    { samples: 400 },
  )
  t.false(odds.exact)
  t.is(odds.runouts, 400)
  t.true(odds.share.a > 0.7, 'aces against seven-deuce is not close')
})

test('one player left has all of it, and no player has none of it', (t) => {
  t.deepEqual(showdownOdds([{ id: 'solo', hole: cards('As', 'Kc') }], []).share, { solo: 1 })
  t.deepEqual(showdownOdds([], []).share, {})
})
