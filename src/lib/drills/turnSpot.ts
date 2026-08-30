import { type Card, mulberry32, shuffledDeck } from '@/lib/poker/cards'
import { evaluateHand, handPhrase } from '@/lib/poker/handEval'
import type { DrillHand } from './types'

// What the two turn kinds share: one deal, and one way of putting both
// holdings on the screen.
//
// Extracted when the second kind wanted them rather than in advance. The point
// is not the saved lines, it is that "count your outs" and "pot odds" deal the
// same spot and differ only in what they ask about it, so a change to the deal
// has to be a change to both or to neither. Two copies of this would drift the
// day one of them started dealing the flop.

/** The ids the two contenders are known by inside a turn spot. */
export const HERO = 'hero'
export const VILLAIN = 'villain'

/**
 * Cards nobody has seen: 52, less two hole cards each and the four on the turn.
 *
 * A constant rather than `rest.length` in the sentence a player reads, so that
 * a change to the deal has to come past this line. The tests assert the deck
 * arithmetic holds.
 */
export const UNSEEN = 44

/** Two hands and a turn board, dealt from one seeded deck. */
export function dealTurn(seed: number): {
  hero: Card[]
  villain: Card[]
  board: Card[]
  rest: Card[]
} {
  const deck = shuffledDeck(mulberry32(seed))
  return {
    hero: deck.slice(0, 2),
    villain: deck.slice(2, 4),
    board: deck.slice(4, 8),
    rest: deck.slice(8),
  }
}

/**
 * Both holdings, with what each one is right now.
 *
 * The villain's made hand is named from the start rather than at the reveal,
 * and that is the drill on both kinds: you cannot count what beats you, or
 * price a call against it, without being told what you are up against. Hiding
 * it would make either kind a guessing game about the opponent.
 */
export function faceUpHands(hero: Card[], villain: Card[], board: Card[]): DrillHand[] {
  const name = (hole: Card[]) => {
    const phrase = handPhrase(evaluateHand(hole, board))
    return phrase ? capitalise(phrase) : undefined
  }
  return [
    { label: 'You', cards: hero, ...withDetail(name(hero)) },
    { label: 'They have', cards: villain, ...withDetail(name(villain)) },
  ]
}

const withDetail = (detail?: string) => (detail ? { detail } : {})

const capitalise = (phrase: string): string => phrase[0].toUpperCase() + phrase.slice(1)
