// The worked cases behind /blog/pokersolver-undocumented.
//
// Pip's hand evaluation is a thin wrapper over pokersolver (see
// ../lib/poker/handEval.ts). Five of that library's behaviours are not in its
// README, and one of them contradicts it. The post documents them, and every
// row it prints comes from here.
//
// The outputs below are typed out by hand on purpose, the same rule as
// dailyProof.ts: a value read out of the library at render time can never
// disagree with the library and therefore proves nothing. tests/pokersolverQuirks.test.ts
// runs each case against the installed pokersolver and fails if a published
// row stops being true. It is also the guard the wrapper has been missing,
// since bestFive() asserts three of these in a comment and nothing checked it.

/** The version every case below was produced against. Pinned in package.json as ^2.1.4. */
export const SOLVER_VERSION = '2.1.4'

export interface SolverCase {
  /** Stable key, used by the page to pull a case into its prose. */
  id: string
  /** The exact array handed to Hand.solve. */
  input: string[]
  /** hand.cards, each card's toString(), in the library's own order. */
  cards: string[]
  /** hand.name, the category label. */
  name: string
  /** hand.descr, the long form. */
  descr: string
}

/**
 * Every case the post prints. Ordered as the post reads, not by interest.
 *
 * Seven cards in, because that is a hold'em showdown and it is the shape that
 * produces the overflow. Three-card and five-card inputs behave too; they just
 * cannot demonstrate anything here.
 */
export const SOLVER_CASES: SolverCase[] = [
  {
    id: 'flush-six',
    input: ['Ah', 'Kh', '9h', '7h', '5h', '3h', '2c'],
    cards: ['Ah', 'Kh', '9h', '7h', '5h', '3h'],
    name: 'Flush',
    descr: 'Flush, Ah High',
  },
  {
    id: 'flush-seven',
    input: ['Ah', 'Kh', '9h', '7h', '5h', '3h', '2h'],
    cards: ['Ah', 'Kh', '9h', '7h', '5h', '3h', '2h'],
    name: 'Flush',
    descr: 'Flush, Ah High',
  },
  {
    id: 'boat-six',
    input: ['As', 'Ah', 'Ad', 'Ks', 'Kh', 'Kd', '2c'],
    cards: ['As', 'Ah', 'Ad', 'Ks', 'Kh', 'Kd'],
    name: 'Full House',
    descr: "Full House, A's over K's",
  },
  {
    id: 'wheel',
    input: ['5h', '4c', '3d', '2s', 'Ah', 'Kd', 'Qc'],
    cards: ['5h', '4c', '3d', '2s', '1h'],
    name: 'Straight',
    descr: 'Straight, 5 High',
  },
  {
    id: 'boat-low-trips',
    input: ['3s', '3h', '3d', 'As', 'Ah', '7c', '2d'],
    cards: ['3s', '3h', '3d', 'As', 'Ah'],
    name: 'Full House',
    descr: "Full House, 3's over A's",
  },
  {
    id: 'royal',
    input: ['Ah', 'Kh', 'Qh', 'Jh', 'Th', '9h', '2c'],
    cards: ['Ah', 'Kh', 'Qh', 'Jh', '10h'],
    name: 'Straight Flush',
    descr: 'Royal Flush',
  },
  {
    id: 'straight-flush-long',
    input: ['9h', '8h', '7h', '6h', '5h', '4h', '2c'],
    cards: ['9h', '8h', '7h', '6h', '5h'],
    name: 'Straight Flush',
    descr: 'Straight Flush, 9h High',
  },
]

/** Look a case up by id. Throws rather than returning undefined: a missing id is a typo, not a state. */
export function solverCase(id: string): SolverCase {
  const found = SOLVER_CASES.find((c) => c.id === id)
  if (!found) throw new Error(`no solver case "${id}"`)
  return found
}

/**
 * What the README promises about toString(), quoted so the test can check the
 * quote is still what the installed package says. This is the only one of the
 * five that is a contradiction rather than an omission, and the quote is the
 * whole of the claim.
 */
export const README_TOSTRING_QUOTE =
  'Returns a formatted string of all cards involved in the identified hand type (maximum of 5 cards).'

/** How the post writes a case's input and output, so prose and test agree on the format. */
export const formatCards = (cards: string[]) => cards.join(' ')
