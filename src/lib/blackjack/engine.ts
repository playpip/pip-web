// Blackjack, as a pure state machine. No React, no storage, no timers, and
// deterministic given a seeded Rng — the same contract `src/lib/poker/` works
// under, for the same reason: the rules have to be testable without a browser.
//
// **It is deliberately not in `src/lib/poker/`.** Nothing here is poker: there
// is no pot, no position, no opponent modelling and no hand ranking. Sharing a
// directory would invite sharing a type, and the first thing to be shared would
// be the `Card` — which is fine — and the second would be something that is
// not. It borrows the card primitives and nothing else.
//
// **Hit and stand, and nothing else** (Will, 2026-09-20). This shipped with
// doubling, splitting and surrender and they were taken back out on purpose:
// four or five buttons for a game whose whole decision is "another card or
// not" is a lot of interface for very little game. What it costs is written
// down rather than waved away — doubling is worth about 1.5% and splitting
// about 0.6% to a player using basic strategy, so every table here is around
// two points worse than the same table in a casino, and `rules.ts` states the
// new numbers rather than the old ones. A house edge you have to discover is
// the thing this app exists not to do.
//
// The code for the three removed actions is gone rather than hidden behind a
// flag. It was correct and it was tested, and it is in the history; leaving it
// unreachable would leave three code paths that nothing exercises and that the
// next person has to decide about.
//
// **The dealer has no strategy and this file contains none.** It draws to a
// number and stops. Everything that makes one table harder than another is in
// `rules.ts`, on the card, before you sit down.

import { type Card, type Rank, type Rng, createDeck, shuffle } from '@/lib/poker/cards'
import type { HouseRules } from './rules'

/** How a hand finished. `blackjack` is a natural, which pays more than a win. */
export type Outcome = 'blackjack' | 'win' | 'push' | 'lose'

export interface BlackjackHand {
  cards: Card[]
  /** Chips staked. Fixed at the deal — there is nothing here that raises it. */
  bet: number
  /** Finished acting, by standing or by having nowhere left to go. */
  done: boolean
  outcome?: Outcome
  /** Chips returned to the stack when it settled, stake included. */
  returned?: number
}

export type Phase = 'idle' | 'player' | 'dealer' | 'settled'

export interface BlackjackState {
  rules: HouseRules
  shoe: Card[]
  /** Cards already dealt this shoe — the shoe reshuffles when it runs low. */
  discards: Card[]
  dealer: Card[]
  /** The hand in front of you, or `null` between deals. One, always: no splits. */
  hand: BlackjackHand | null
  phase: Phase
  /** Chips in front of you at the table, the stake already deducted. */
  stack: number
  /** What the last hand was dealt for, so the sizer reopens where you left it. */
  lastBet: number
}

const VALUE: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 10,
  Q: 10,
  K: 10,
  A: 11,
}

export interface HandValue {
  /** The best total that is not a bust, or the bust total. */
  total: number
  /** An ace is still counted as eleven, so the total can fall by ten. */
  soft: boolean
  bust: boolean
}

/**
 * What a holding is worth.
 *
 * Aces count eleven until that busts, then one. Counting them all high and
 * demoting while over twenty-one is the whole algorithm — the loop matters
 * because A-A-A-8 has to demote twice.
 */
export function handValue(cards: readonly Card[]): HandValue {
  let total = 0
  let aces = 0
  for (const card of cards) {
    total += VALUE[card.rank]
    if (card.rank === 'A') aces++
  }
  let high = aces
  while (total > 21 && high > 0) {
    total -= 10
    high--
  }
  return { total, soft: high > 0, bust: total > 21 }
}

/** Two cards totalling twenty-one. With no splitting, that is all it takes. */
export function isNatural(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21
}

/** A fresh, shuffled shoe of `decks` ordinary 52-card decks. */
export function newShoe(rules: HouseRules, rng: Rng): Card[] {
  const cards: Card[] = []
  for (let i = 0; i < rules.decks; i++) cards.push(...createDeck())
  return shuffle(cards, rng)
}

/**
 * Reshuffle when the shoe is running low, the way a real one is cut.
 *
 * Not for atmosphere: without it a long session runs the shoe out mid-hand and
 * the draw has nothing to give. Folding the discards back in rather than
 * building a fresh shoe keeps the composition honest for anyone counting.
 */
function ensureCards(state: BlackjackState, rng: Rng, needed: number): void {
  if (state.shoe.length >= Math.max(needed, state.rules.decks * 13)) return
  state.shoe = shuffle([...state.shoe, ...state.discards], rng)
  state.discards = []
}

export function newGame(rules: HouseRules, stack: number, rng: Rng): BlackjackState {
  return {
    rules,
    shoe: newShoe(rules, rng),
    discards: [],
    dealer: [],
    hand: null,
    phase: 'idle',
    stack,
    lastBet: 0,
  }
}

const draw = (state: BlackjackState, rng: Rng): Card => {
  ensureCards(state, rng, 1)
  const card = state.shoe.pop()
  if (!card) throw new Error('the shoe is empty and the reshuffle did not fire')
  return card
}

/**
 * Deal a hand for `bet`.
 *
 * The stake leaves the stack here rather than at settlement, so the number on
 * screen is always chips you could stand up with. A bet you cannot cover is
 * refused rather than clamped: silently staking less than you asked for is the
 * kind of helpfulness that reads as the game taking liberties with your money.
 */
export function deal(state: BlackjackState, bet: number, rng: Rng): BlackjackState {
  if (bet <= 0) throw new Error('a hand needs a bet')
  if (bet > state.stack) throw new Error('bet is larger than the stack')

  const next: BlackjackState = {
    ...state,
    shoe: [...state.shoe],
    discards: [...state.discards],
    dealer: [],
    hand: null,
    stack: state.stack - bet,
    lastBet: bet,
    phase: 'player',
  }

  const hand: BlackjackHand = { cards: [], bet, done: false }
  // Dealt the way a table deals it: player, dealer, player, dealer.
  hand.cards.push(draw(next, rng))
  next.dealer.push(draw(next, rng))
  hand.cards.push(draw(next, rng))
  next.dealer.push(draw(next, rng))
  next.hand = hand

  // A natural on either side ends it immediately — there is nothing to decide
  // and no card to ask for.
  if (isNatural(hand.cards) || isNatural(next.dealer)) {
    hand.done = true
    return settle({ ...next, phase: 'dealer' }, rng)
  }
  return next
}

/** What the hand may legally do. Two things, which is rather the point. */
export interface BlackjackOptions {
  canHit: boolean
  canStand: boolean
}

export function options(state: BlackjackState): BlackjackOptions {
  const live = state.phase === 'player' && !!state.hand && !state.hand.done
  return { canHit: live, canStand: live }
}

export function hit(state: BlackjackState, rng: Rng): BlackjackState {
  if (!options(state).canHit || !state.hand) return state
  const next = { ...state, shoe: [...state.shoe] }
  const hand = { ...state.hand, cards: [...state.hand.cards] }
  hand.cards.push(draw(next, rng))
  // Twenty-one is not a decision, so the hand closes itself rather than
  // offering another card nobody would take.
  const value = handValue(hand.cards)
  if (value.bust || value.total === 21) hand.done = true
  next.hand = hand
  return hand.done ? settle({ ...next, phase: 'dealer' }, rng) : next
}

export function stand(state: BlackjackState, rng: Rng): BlackjackState {
  if (!options(state).canStand || !state.hand) return state
  const next = { ...state, hand: { ...state.hand, done: true }, phase: 'dealer' as const }
  return settle(next, rng)
}

/**
 * Play the dealer out and pay.
 *
 * The dealer draws to seventeen and stands, hitting a soft seventeen only where
 * the table says so. It does not draw at all when the player has busted: there
 * is nothing left to beat, and dealing cards to settle nothing is how a player
 * comes to believe the dealer "got lucky".
 */
export function settle(state: BlackjackState, rng: Rng): BlackjackState {
  const next: BlackjackState = {
    ...state,
    shoe: [...state.shoe],
    discards: [...state.discards],
    dealer: [...state.dealer],
    hand: state.hand ? { ...state.hand, cards: [...state.hand.cards] } : null,
  }
  const hand = next.hand
  if (!hand) return { ...next, phase: 'settled' }

  const value = handValue(hand.cards)
  const playerNatural = isNatural(hand.cards)
  const dealerNatural = isNatural(next.dealer)

  if (!value.bust && !dealerNatural && !playerNatural) {
    for (;;) {
      const { total, soft } = handValue(next.dealer)
      if (total > 17) break
      if (total === 17 && !(soft && next.rules.hitsSoft17)) break
      next.dealer.push(draw(next, rng))
    }
  }

  const dealerValue = handValue(next.dealer)
  if (value.bust) {
    hand.outcome = 'lose'
    hand.returned = 0
  } else if (playerNatural && dealerNatural) {
    hand.outcome = 'push'
    hand.returned = hand.bet
  } else if (playerNatural) {
    hand.outcome = 'blackjack'
    // Floored, so the house never pays a fraction of a chip it cannot show.
    hand.returned = hand.bet + Math.floor(hand.bet * next.rules.blackjackPays)
  } else if (dealerNatural) {
    hand.outcome = 'lose'
    hand.returned = 0
  } else if (dealerValue.bust || value.total > dealerValue.total) {
    hand.outcome = 'win'
    hand.returned = hand.bet * 2
  } else if (value.total === dealerValue.total) {
    hand.outcome = 'push'
    hand.returned = hand.bet
  } else {
    hand.outcome = 'lose'
    hand.returned = 0
  }
  next.stack += hand.returned ?? 0

  // Everything on the table goes to the discards, so the reshuffle folds a
  // complete shoe back together rather than one with hands missing from it.
  next.discards.push(...next.dealer, ...hand.cards)
  next.phase = 'settled'
  return next
}

/** Net chips on the hand just settled — what the result line reports. */
export function handNet(state: BlackjackState): number {
  if (!state.hand) return 0
  return (state.hand.returned ?? 0) - state.hand.bet
}
