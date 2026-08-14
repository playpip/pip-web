// The ten hands on /learn/hand-rankings: what they are, and how often each one
// turns up.
//
// The frequencies are typed as combination counts rather than as the
// percentages the page prints, for one reason. Ten percentages are ten
// independent chances to be wrong and nothing in the repo can check any of
// them; ten counts have to add up to C(52,5) and C(52,7) exactly, and
// tests/guideClaims.test.ts makes them. The percentages are computed here at
// render time, so the table cannot disagree with the sentence under it.
//
// Both columns are here because the page's central claim needs both. The
// ranking order is five-card rarity, and on five cards it holds exactly, top to
// bottom. Deal seven and it breaks in one place, at the bottom. The page
// shipped for nine days claiming it held "exactly, all the way down the list"
// immediately above a seven-card table showing that it does not.

/** C(52,5): every five-card hand. */
export const FIVE_CARD_HANDS = 2_598_960

/** C(52,7): every seven-card holding, which is what a Hold'em player has. */
export const SEVEN_CARD_HANDS = 133_784_560

export interface HandFrequency {
  /** Place in the ranking, 1 being the royal flush. */
  n: number
  hand: string
  /** What it is, for the first table. */
  what: string
  /** An example, in the page's own glyphs. */
  example: string
  /** Five-card hands of this category, out of FIVE_CARD_HANDS. */
  five: number
  /** Seven-card holdings whose best five are this, out of SEVEN_CARD_HANDS. */
  seven: number
}

/**
 * Strongest first, which is the order both tables on the page are drawn in, so
 * the order is written down once. Counts are the standard enumerations; the
 * only thing worth saying about them is that each column sums to its total,
 * which is the check the tests run rather than a claim made here.
 */
export const HAND_FREQUENCIES: readonly HandFrequency[] = [
  {
    n: 1,
    hand: 'Royal flush',
    what: 'Ace to ten, all one suit. The best hand in poker, and it’s just the top straight flush with a nicer name.',
    example: 'A♠ K♠ Q♠ J♠ 10♠',
    five: 4,
    seven: 4_324,
  },
  {
    n: 2,
    hand: 'Straight flush',
    what: 'Five cards in sequence, all one suit.',
    example: '9♥ 8♥ 7♥ 6♥ 5♥',
    five: 36,
    seven: 37_260,
  },
  {
    n: 3,
    hand: 'Four of a kind',
    what: 'All four cards of one rank.',
    example: 'Q♣ Q♦ Q♥ Q♠ 4♦',
    five: 624,
    seven: 224_848,
  },
  {
    n: 4,
    hand: 'Full house',
    what: 'Three of one rank, two of another.',
    example: '7♠ 7♦ 7♣ K♥ K♠',
    five: 3_744,
    seven: 3_473_184,
  },
  {
    n: 5,
    hand: 'Flush',
    what: 'Five cards of one suit, in any order.',
    example: 'A♦ J♦ 8♦ 5♦ 2♦',
    five: 5_108,
    seven: 4_047_644,
  },
  {
    n: 6,
    hand: 'Straight',
    what: 'Five cards in sequence, any suits.',
    example: '10♣ 9♦ 8♠ 7♥ 6♣',
    five: 10_200,
    seven: 6_180_020,
  },
  {
    n: 7,
    hand: 'Three of a kind',
    what: 'Three cards of one rank.',
    example: '5♥ 5♠ 5♦ K♣ 2♥',
    five: 54_912,
    seven: 6_461_620,
  },
  {
    n: 8,
    hand: 'Two pair',
    what: 'Two cards of one rank, two of another.',
    example: 'J♦ J♣ 4♠ 4♥ 9♦',
    five: 123_552,
    seven: 31_433_400,
  },
  {
    n: 9,
    hand: 'One pair',
    what: 'Two cards of the same rank.',
    example: '10♠ 10♦ A♣ 7♥ 3♠',
    five: 1_098_240,
    seven: 58_627_800,
  },
  {
    n: 10,
    hand: 'High card',
    what: 'None of the above. Your highest card plays.',
    example: 'A♥ Q♦ 9♠ 6♣ 3♦',
    five: 1_302_540,
    seven: 23_294_460,
  },
]

const byName = (hand: string): HandFrequency => {
  const row = HAND_FREQUENCIES.find((entry) => entry.hand === hand)
  if (!row) throw new Error(`no such hand: ${hand}`)
  return row
}

/** The share of seven-card holdings that make `hand`, as a percentage. */
export function sevenCardShare(hand: string): number {
  return (byName(hand).seven / SEVEN_CARD_HANDS) * 100
}

/**
 * The page's own formatting. A decimal place reads right for everything down to
 * a full house and turns the three rare hands into 0.0%, so those get two
 * significant figures instead.
 */
export function formatShare(share: number): string {
  return share >= 1 ? share.toFixed(1) : share.toPrecision(2)
}
