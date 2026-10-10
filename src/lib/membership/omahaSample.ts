import { type Card, cardFromString, type Rank, rankName } from '@/lib/poker/cards'
import { bestFive, type EvaluatedHand, determineWinners, evaluateHand } from '@/lib/poker/handEval'

/**
 * The showdown `/membership?for=omaha` deals (playpip/cmo#180).
 *
 * The Big Pot's blurb says "use exactly two", which is the rule nobody believes
 * until they lose to it. This is the hand from the exactly-two guide
 * (`/blog/omaha-exactly-two`): four hearts on the board and one in your hand,
 * which is a flush in Hold'em and ace high in Omaha.
 *
 * **The cards are typed; nothing else is.** Who wins, what each hand is and
 * which five cards play all come from the same evaluator that settles a pot at
 * The Big Pot, so the page cannot say something the table would not.
 * `tests/omahaSample.test.ts` holds the lesson to the evaluator: if a change to
 * the rules ever made this a flush, the build fails rather than the page lying.
 */
const BOARD = ['Ah', '9h', '6h', '3h', 'Kc']
const HERO = ['Qh', '7s', '4d', '2c']
const THEM = ['Kd', 'Td', '8s', '5c']

interface ShowdownHolding {
  cards: Card[]
  /** The five that play, two of these and three of the board. */
  plays: Card[]
  /** The hand in words, ready to sit in a sentence: "ace high", "a pair of kings". */
  phrase: string
}

interface OmahaShowdown {
  board: Card[]
  hero: ShowdownHolding
  them: ShowdownHolding
  winner: 'hero' | 'them' | 'split'
  /** What the same nine cards make under Hold'em's rule, best five of any. */
  holdemPhrase: string
}

const plural = (rank: Rank): string => (rank === '6' ? 'sixes' : `${rankName(rank)}s`)

/** Only the categories this hand can reach are worded; the test fails on any other. */
function phrase(hand: EvaluatedHand): string {
  const top = bestFive(hand)[0]
  if (hand.name === 'High Card') return `${rankName(top.rank)} high`
  if (hand.name === 'Pair') return `a pair of ${plural(top.rank)}`
  if (hand.name === 'Flush') return 'a flush'
  return hand.name.toLowerCase()
}

export function omahaSample(): OmahaShowdown {
  const board = BOARD.map(cardFromString)
  const hero = HERO.map(cardFromString)
  const them = THEM.map(cardFromString)
  const { winners, evaluations } = determineWinners(
    [
      { id: 'hero' as const, hole: hero },
      { id: 'them' as const, hole: them },
    ],
    board,
    'omaha',
  )
  const holding = (id: 'hero' | 'them', cards: Card[]): ShowdownHolding => {
    const hand = evaluations.get(id)!
    return { cards, plays: bestFive(hand), phrase: phrase(hand) }
  }
  return {
    board,
    hero: holding('hero', hero),
    them: holding('them', them),
    winner: winners.length > 1 ? 'split' : winners[0],
    holdemPhrase: phrase(evaluateHand(hero, board, 'holdem')),
  }
}
