// Pure card primitives for Texas Hold'em. Framework-free and deterministic
// when given a seeded RNG, so the whole engine is unit-testable.

export type Suit = 'c' | 'd' | 'h' | 's'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  rank: Rank
  suit: Suit
}

export const RANKS: readonly Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'T',
  'J',
  'Q',
  'K',
  'A',
]
export const SUITS: readonly Suit[] = ['c', 'd', 'h', 's']

const RED_SUITS: ReadonlySet<Suit> = new Set<Suit>(['d', 'h'])
export const isRed = (suit: Suit): boolean => RED_SUITS.has(suit)

/** A deterministic PRNG (mulberry32). Returns a function yielding [0, 1). */
export type Rng = () => number
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fresh, ordered 52-card deck. */
export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

/** In-place Fisher–Yates shuffle using the supplied RNG. Returns the array. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

/** A shuffled deck. Pass a seeded RNG for reproducibility. */
export function shuffledDeck(rng: Rng): Card[] {
  return shuffle(createDeck(), rng)
}

/** Encode a card as the two-char string pokersolver expects, e.g. "Ah", "Td". */
export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`
}

export function cardsToStrings(cards: readonly Card[]): string[] {
  return cards.map(cardToString)
}

/** Parse a "Ah"/"Td" style string back into a Card. */
export function cardFromString(s: string): Card {
  const rank = s[0] as Rank
  const suit = s[1] as Suit
  return { rank, suit }
}

const RANK_WORD: Record<Rank, string> = {
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  T: 'ten',
  J: 'jack',
  Q: 'queen',
  K: 'king',
  A: 'ace',
}

/**
 * The card-face glyphs. Here rather than in the component that draws a card,
 * because the guides write cards out in prose from the same strings the tests
 * enumerate, and two copies of this map is one copy too many.
 */
export const SUIT_GLYPH: Record<Suit, string> = { c: '♣', d: '♦', h: '♥', s: '♠' }

const SUIT_WORD: Record<Suit, string> = {
  c: 'clubs',
  d: 'diamonds',
  h: 'hearts',
  s: 'spades',
}

/**
 * A card said out loud, e.g. "ace of spades". A card face renders as "A♠",
 * which a screen reader reads inconsistently and sometimes not at all, so
 * anywhere a card is the control rather than the decoration needs this.
 */
export function cardName(card: Card): string {
  return `${RANK_WORD[card.rank]} of ${SUIT_WORD[card.suit]}`
}
