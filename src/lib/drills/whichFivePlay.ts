import {
  SUIT_GLYPH,
  type Card,
  type Rank,
  cardName,
  cardToString,
  mulberry32,
  rankName,
  shuffledDeck,
} from '@/lib/poker/cards'
import { type EvaluatedHand, bestFive, determineWinners, handPhrase } from '@/lib/poker/handEval'
import { type FiveShape, fiveDifficulty } from './rating'
import { type DrillChoice, type Generated, accept, reject } from './types'

// Seven cards, and the five that actually play.
//
// The read the kind below this one asks for, said exactly. "Two pair" is a
// name; *which* two pair, and what the fifth card is, is the hand — and the
// gap between the two is where a beginner's money goes. Keeping an ace that
// plays no part, counting a fourth heart, playing both hole cards when one of
// them is dead: every one of those is a player who could name the hand and
// could not pick it out.
//
// **Exact by enumeration, like every other paid kind.** All twenty-one ways to
// take five from seven are evaluated at generation time and compared by the
// solver, so the answer is counted rather than asserted — and every set that
// ties the best hand is accepted, which matters more here than anywhere else in
// this folder. With two kings on the board and a king in your hand, which king
// you keep does not change what you have, and a drill that marked one of two
// identical hands wrong would be disagreeing with the engine it is teaching.
//
// The interaction is the lesson: you tap the five, rather than picking a
// sentence about them off a list. See components/drills/PickFive.tsx.

const HERO = 'hero'
const BOARD = 'board'

/** How many of the seven play. The whole question, in one number. */
export const PLAYS = 5

/**
 * How many of the twenty-one sets may tie for best before the spot stops being
 * a question.
 *
 * Three, measured rather than chosen: over 4,000 seeds a spot has a median of
 * one correct set and 87% have three or fewer, so the cut keeps nearly
 * everything and throws away the boards where several cards are interchangeable
 * and tapping at random gets you there a third of the time. See `free-guess` in
 * ./types.
 */
export const MOST_ANSWERS = 3

/** Two cards and a finished board, dealt from one seeded deck. */
function deal(seed: number): { hole: Card[]; board: Card[] } {
  const deck = shuffledDeck(mulberry32(seed))
  return { hole: deck.slice(0, 2), board: deck.slice(2, 7) }
}

/**
 * A set of cards as one string, in a fixed order.
 *
 * The id a selection is graded against, and the reason it is sorted is that the
 * player taps in whatever order they like: the same five cards have to come to
 * the same id whether the board was read left to right or the ace was spotted
 * first. `cardToString` is the engine's own spelling, so nothing here invents a
 * second way to write a card down.
 */
export function selectionId(cards: readonly Card[]): string {
  return cards.map(cardToString).sort().join(' ')
}

/** Every way to take five from seven. Twenty-one of them, in a fixed order. */
function fives(cards: readonly Card[]): Card[][] {
  const sets: Card[][] = []
  for (let a = 0; a < cards.length; a++) {
    for (let b = a + 1; b < cards.length; b++) {
      // The two left out are `a` and `b`; the five kept are the rest.
      sets.push(cards.filter((_, i) => i !== a && i !== b))
    }
  }
  return sets
}

/**
 * What kind of choosing this spot asks for, read off the hand the solver made.
 *
 * `board-plays` is asked of the engine rather than counted off the cards, for
 * the reason the reading kind asks the same question the same way: whether
 * "your" king plays when two more are on the board is a fact about which of two
 * identical hands got built, and comparing hands never has to decide it.
 */
function shapeOf(made: EvaluatedHand, hole: Card[], board: Card[]): FiveShape {
  const { winners } = determineWinners(
    [
      { id: HERO, hole },
      { id: BOARD, hole: [] },
    ],
    board,
  )
  if (winners.includes(BOARD)) return 'board-plays'
  return MADE_CARDS[made.name] === PLAYS ? 'made-five' : 'kickers-matter'
}

/**
 * How many of the five a category actually makes, the rest being kickers.
 *
 * Nearly the map `whichHandWins.ts` keeps, and deliberately not shared, because
 * one row differs and the difference is the point. There, high card is 0: the
 * question is where two hands first part, and a hand that makes nothing is
 * kickers all the way down. Here it is 1: the question is how many of the five
 * are forced, and the highest card is forced. Folding those into one map would
 * mean one of the two callers reading a number that is wrong for it.
 */
const MADE_CARDS: Record<string, number> = {
  'High Card': 1,
  Pair: 2,
  'Two Pair': 4,
  'Three of a Kind': 3,
  Straight: 5,
  Flush: 5,
  'Full House': 5,
  'Four of a Kind': 4,
  'Straight Flush': 5,
}

/**
 * Generate the spot at `seed`, or say why it was thrown away.
 *
 * Two rejections. A spot where guessing does the work is not a question, and a
 * spot whose answer cannot be put in a sentence is not a drill.
 */
export function generateWhichFivePlay(seed: number): Generated {
  const { hole, board } = deal(seed)
  const seven = [...hole, ...board]

  const { evaluations } = determineWinners([{ id: HERO, hole }], board)
  const made = evaluations.get(HERO)
  if (!made) return reject('unexplainable')
  const phrase = handPhrase(made)
  if (!phrase) return reject('unexplainable')

  // Every five, compared against every other five by the solver. Each set is
  // handed over as a contender with no board, because five cards *are* the
  // hand: there is nothing left to add to them.
  const sets = fives(seven)
  const { winners } = determineWinners(
    sets.map((cards, i) => ({ id: i, hole: cards })),
    [],
  )
  if (winners.length === 0) return reject('unexplainable')
  if (winners.length > MOST_ANSWERS) return reject('free-guess')

  const answers = winners.map((i) => selectionId(sets[i]))
  const best = bestFive(made)
  const canonical = selectionId(best)
  // The solver's own five has to be one of the twenty-one it just ranked best.
  // If it is not, two readings of one hand have disagreed and the spot goes in
  // the bin rather than being graded by the one that happens to be wrong.
  if (!answers.includes(canonical)) return reject('unexplainable')

  const shape = shapeOf(made, hole, board)
  const plays = new Set(best.map(cardToString))

  // The choices are the cards themselves: this kind's answer is a selection, so
  // what a choice means here is "this card is tappable", and `winning` marks the
  // five that play for the reveal. Which *combinations* are correct is
  // `answers` — see the note on it in ./types.
  const choices: DrillChoice[] = seven.map((card) => ({
    id: cardToString(card),
    // The card face, the way a card face is written: the label is what the
    // screen shows on the chip beside it, and "10♥" is the card. `spoken` is
    // the sentence, because "10♥" is read out inconsistently or not at all.
    label: `${card.rank === 'T' ? '10' : card.rank}${SUIT_GLYPH[card.suit]}`,
    spoken: cardName(card),
    cards: [card],
    winning: plays.has(cardToString(card)),
  }))

  return accept({
    kind: 'which-five-play',
    seed,
    board,
    choices,
    hands: [{ label: 'You', cards: hole }],
    answer: canonical,
    answers,
    settledBy: shape,
    difficulty: fiveDifficulty(shape),
    explanation: explain(made, phrase, shape, best, answers.length),
  })
}

/**
 * The hand, with the cards that make it named — because on this kind *which
 * cards* is the whole question and "two pair" on its own does not answer it.
 *
 * Three shapes, because English will not take one: a pair is "of" its rank, a
 * hand made of all five needs no ranks after it, and everything else is the
 * phrase with its ranks behind a comma, which is how the game says them.
 */
function handSaid(
  made: EvaluatedHand,
  phrase: string,
  best: readonly Card[],
  makes: number,
  kickers: number,
): string {
  const named = `${phrase[0].toUpperCase()}${phrase.slice(1)}`
  if (kickers === 0) return named
  if (made.name === 'High Card') return `${capitalise(rankName(best[0].rank))} high`
  const ranks = madeRanks(best, makes)
  return made.name === 'Pair' ? `A pair of ${ranks}` : `${named}, ${ranks}`
}

const capitalise = (word: string): string => word[0].toUpperCase() + word.slice(1)

/** Small numbers as words, which is how a sentence says them. */
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five'] as const
const count = (n: number): string => WORDS[n] ?? String(n)

/**
 * The cards that make the hand, said out loud: "nines", "aces and kings",
 * "the ace".
 *
 * Read off the first cards of the solver's own five, which it puts in that
 * order for exactly this reason — the made cards first, then the kickers. The
 * alternative is parsing `description` ("Three of a Kind, 9's"), which is a
 * library's display string and not a contract.
 */
function madeRanks(best: readonly Card[], makes: number): string {
  const ranks: Rank[] = []
  for (const card of best.slice(0, makes)) {
    if (!ranks.includes(card.rank)) ranks.push(card.rank)
  }
  const said = ranks.map((rank) => (makes > 1 ? plural(rank) : `the ${rankName(rank)}`))
  return said.length > 1 ? `${said.slice(0, -1).join(', ')} and ${said.at(-1)}` : said[0]
}

/** "nine" -> "nines", "six" -> "sixes". */
function plural(rank: Rank): string {
  const word = rankName(rank)
  return word.endsWith('x') ? `${word}es` : `${word}s`
}

/**
 * The one sentence, out of the same evaluation that set the answer.
 *
 * What the hand is, what makes it, and what the rest of the five are doing
 * there — because on this kind the kickers are the part nobody is taught. Then
 * the second correct set, where there was one, said plainly: a player who found
 * the other one should be told it was not luck.
 */
function explain(
  made: EvaluatedHand,
  phrase: string,
  shape: FiveShape,
  best: readonly Card[],
  correct: number,
): string {
  const makes = MADE_CARDS[made.name] ?? PLAYS
  const kickers = PLAYS - makes
  const full = handSaid(made, phrase, best, makes, kickers)

  const body =
    shape === 'board-plays'
      ? `${full}, and it is the five on the board — neither of your cards gets into the hand, so keeping one of them only leaves a better card out.`
      : kickers === 0
        ? `${full}, and it uses all five cards: there is nothing left to choose.`
        : // "in" rather than the obvious phrase, which `tests/drills.test.ts`
          // bans across this folder along with the rest of a meter's
          // vocabulary. The ban is what makes an allowance impossible to write
          // here by habit, and the cost of keeping it is one word of copy.
          `${full}. ${makes === 1 ? 'That card is' : `Those ${count(makes)} are`} in, and the ${
            kickers === 1
              ? 'last place goes to the highest card left'
              : `other ${count(kickers)} places go to the highest cards left`
          } — nothing else can go in ${kickers === 1 ? 'its' : 'their'} place.`

  const tail =
    correct > 1
      ? ` ${correct === 2 ? 'Two sets' : `${correct} sets`} of five make exactly this hand, and every one of them is right.`
      : ''

  return `${body}${tail}`
}
