// The two landing-page feature cards that show product output nobody can see
// from the marketing page: a hand permalink and the ambient equity read.
//
// Both were hand-typed until 2026-09-17 and both had drifted from the thing
// they were pictures of. The hand link was six characters, the shape of a
// server-side short link, on the card whose whole claim is that there is no
// server. The equity read was labelled "Top pair, good kicker", a phrase the
// game has never emitted, over a percentage that disagreed with the sentence
// under it.
//
// So the inputs live here and `tests/landingMocks.test.ts` runs the real
// functions against them. The link is encoded at render time by the encoder the
// game shares with; the equity figures cannot be, because pulling the evaluator
// and a Monte-Carlo run into the marketing bundle to draw one card is a bad
// trade, so they are constants the test recomputes and fails on.

import { cardFromString } from '@/lib/poker/cards'
import type { HandRecord } from '@/store/game'

const cards = (...spec: string[]) => spec.map(cardFromString)

/**
 * A six-handed hand that reaches showdown, for `HandLinkMock`.
 *
 * Deliberately not the shortest hand we could write: the card claims the whole
 * hand is in the URL, so the picture should be of a hand worth sharing.
 */
export const HAND_LINK_SAMPLE: HandRecord = {
  handNo: 42,
  smallBlind: 25,
  bigBlind: 50,
  events: [
    { kind: 'action', playerId: 'ai0', playerName: 'Vivienne', type: 'raise', amount: 150 },
    { kind: 'action', playerId: 'ai1', playerName: 'Marcus', type: 'fold' },
    { kind: 'action', playerId: 'ai2', playerName: 'Delia', type: 'call', amount: 150 },
    { kind: 'action', playerId: 'hero', playerName: 'You', type: 'call', amount: 150 },
    { kind: 'board', label: 'Flop', cards: cards('Kh', 'Ks', '7d') },
    { kind: 'action', playerId: 'hero', playerName: 'You', type: 'check' },
    { kind: 'action', playerId: 'ai0', playerName: 'Vivienne', type: 'bet', amount: 200 },
    { kind: 'action', playerId: 'ai2', playerName: 'Delia', type: 'fold' },
    { kind: 'action', playerId: 'hero', playerName: 'You', type: 'raise', amount: 600 },
    { kind: 'action', playerId: 'ai0', playerName: 'Vivienne', type: 'call', amount: 600 },
    { kind: 'board', label: 'Turn', cards: cards('2c') },
    { kind: 'action', playerId: 'hero', playerName: 'You', type: 'bet', amount: 900 },
    { kind: 'action', playerId: 'ai0', playerName: 'Vivienne', type: 'call', amount: 900 },
    { kind: 'board', label: 'River', cards: cards('7h') },
    { kind: 'action', playerId: 'hero', playerName: 'You', type: 'bet', amount: 1400 },
    { kind: 'action', playerId: 'ai0', playerName: 'Vivienne', type: 'raise', amount: 4200 },
    { kind: 'action', playerId: 'hero', playerName: 'You', type: 'call', amount: 4200 },
  ],
  community: cards('Kh', 'Ks', '7d', '2c', '7h'),
  reveals: [
    { playerId: 'hero', playerName: 'You', cards: cards('Kd', 'Kc'), handName: 'Four of a Kind' },
    {
      playerId: 'ai0',
      playerName: 'Vivienne',
      cards: cards('7s', '7c'),
      handName: 'Four of a Kind',
    },
  ],
  summary: 'Vivienne wins with four sevens',
}

/** How much of the token the card shows before the ellipsis. */
export const HAND_LINK_VISIBLE_CHARS = 12

/**
 * The spot behind `EquityReadout`: ace-king on an ace-high flop, three players
 * still in. `label` is what `evaluateHand` calls it, which is not what a person
 * would call it, and `winPct` is the raw equity rounded the way the table
 * rounds it.
 */
export const EQUITY_SAMPLE = {
  hole: ['Ah', 'Kd'],
  community: ['As', '9c', '4d'],
  opponents: 3,
  /** `evaluateHand(hole, community).name` — pinned by the test, not chosen. */
  label: 'Pair',
  /** Mean of 20 runs of 20,000 hands, 2026-09-17: 70.20%, sd 0.39. */
  winPct: 70,
} as const
