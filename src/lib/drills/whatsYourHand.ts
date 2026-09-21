import {
  RANKS,
  SUIT_GLYPH,
  type Card,
  type Rank,
  type Rng,
  mulberry32,
  rankName,
  shuffledDeck,
} from '@/lib/poker/cards'
import {
  HAND_CATEGORIES,
  type EvaluatedHand,
  bestFive,
  determineWinners,
  handPhrase,
} from '@/lib/poker/handEval'
import { type ReadShape, readDifficulty } from './rating'
import { type DrillChoice, type Generated, accept, reject } from './types'

// The bottom of the ladder: your two cards, a finished board, and what you have
// got.
//
// **Every other kind in this folder assumes this one** (Will, 2026-09-21).
// Counting the cards that win it for you, pricing a call, picking the favourite
// on a flop — each of them starts from a read of a made hand, and until this
// kind shipped the easiest spot in the app was still the whole ranking table
// applied to two seven-card hands. A beginner who cannot yet say "that is two
// pair" has nowhere to start, which is what this fixes.
//
// Graded by `evaluateHand`, which is the solver reading a finished hand. Exact,
// nothing sampled, no tolerance — the same property that made `which-hand-wins`
// the kind that is free forever, and the reason this one is free too.
//
// **The wrong answers are the misreads, not noise.** Three distractors drawn
// from the categories next to the real one, with the hand the board is pointing
// at preferred where there is one: four hearts showing and no flush, four to a
// straight and no straight. A spot whose wrong answers are absurd teaches
// nothing, because eliminating them is not reading.

const HERO = 'hero'
const BOARD = 'board'
const LEFT = 'left'
const RIGHT = 'right'

/** Two cards and a finished board, dealt from one seeded deck. */
function deal(seed: number): { hole: Card[]; board: Card[] } {
  const deck = shuffledDeck(mulberry32(seed))
  return { hole: deck.slice(0, 2), board: deck.slice(2, 7) }
}

/** Rank order as a number, 0 (deuce) to 12 (ace). */
const rankValue = (rank: Rank): number => RANKS.indexOf(rank)

/**
 * How much of this hand is actually yours, asked of the engine rather than
 * worked out from the cards.
 *
 * Both questions are showdowns: your seven against the board's own five, and
 * then each of your cards on its own against the pair of them. The solver
 * answers both, so the shape cannot disagree with the grade, and the awkward
 * case comes out right for free — holding a king with two kings on the board,
 * whether "your" king plays is not a fact about the cards, it is a fact about
 * which of two identical hands the solver happened to build. Comparing hands
 * instead of cards never has to decide that.
 */
function readShape(hole: Card[], board: Card[]): ReadShape {
  const yours = determineWinners(
    [
      { id: HERO, hole },
      { id: BOARD, hole: [] },
    ],
    board,
  )
  if (yours.winners.includes(BOARD)) return 'plays-the-board'

  const alone = determineWinners(
    [
      { id: HERO, hole },
      { id: LEFT, hole: [hole[0]] },
      { id: RIGHT, hole: [hole[1]] },
    ],
    board,
  )
  return alone.winners.length > 1 ? 'uses-one' : 'uses-both'
}

/** The card of yours that is doing the work, for a spot where only one is. */
function workingCard(hole: Card[], board: Card[]): Card | null {
  const { winners } = determineWinners(
    [
      { id: LEFT, hole: [hole[0]] },
      { id: RIGHT, hole: [hole[1]] },
    ],
    board,
  )
  if (winners.length !== 1) return null
  return winners[0] === LEFT ? hole[0] : hole[1]
}

/**
 * Four of one suit, or four running in sequence, without the hand being the
 * flush or the straight that nearly arrived.
 *
 * The misread this kind exists to catch, and it is computed rather than
 * asserted: four hearts on the screen is what makes a beginner say "flush"
 * before counting to five. Sequences are checked on distinct ranks with the ace
 * allowed at both ends, which is the same allowance the solver makes.
 */
function mirage(cards: Card[], made: EvaluatedHand): boolean {
  const suited = made.name !== 'Flush' && made.name !== 'Straight Flush'
  if (suited) {
    const bySuit = new Map<string, number>()
    for (const card of cards) bySuit.set(card.suit, (bySuit.get(card.suit) ?? 0) + 1)
    if ([...bySuit.values()].some((n) => n === 4)) return true
  }

  if (made.name === 'Straight' || made.name === 'Straight Flush') return false
  const values = new Set(cards.map((card) => rankValue(card.rank)))
  // The wheel: an ace sits below the deuce as well as above the king.
  if (values.has(rankValue('A'))) values.add(-1)
  for (let low = -1; low + 4 <= rankValue('A'); low++) {
    let run = 0
    for (let i = low; i < low + 5; i++) if (values.has(i)) run++
    if (run === 4) return true
  }
  return false
}

/** "a flush" -> "Flush", "two pair" -> "Two pair". What a button says. */
function label(phrase: string): string {
  const bare = phrase.replace(/^an? /, '')
  return bare[0].toUpperCase() + bare.slice(1)
}

/**
 * The three wrong answers, and which they are is the teaching.
 *
 * Categories are offered by how near they are to the real one, because a read
 * that is one category out is a read somebody actually made: two pair seen as a
 * pair, a straight seen as three of a kind. The category the board is pointing
 * at — the flush that is four cards away, the straight that is missing a link —
 * is pulled to the front of that queue when the spot has one, since that is the
 * answer a beginner is most likely to give and the one worth being shown was
 * wrong.
 *
 * Shuffled by the spot's own rng afterwards, so the real answer does not sit in
 * a predictable slot. They are drawn in ranking order for display by the caller.
 */
function offer(made: EvaluatedHand, tempted: string | null, rng: Rng): string[] {
  const here = HAND_CATEGORIES.indexOf(made.name)
  const others = HAND_CATEGORIES.filter((name) => name !== made.name)
  const queue = others.sort((a, b) => {
    if (a === tempted) return -1
    if (b === tempted) return 1
    const byDistance =
      Math.abs(HAND_CATEGORIES.indexOf(a) - here) - Math.abs(HAND_CATEGORIES.indexOf(b) - here)
    if (byDistance !== 0) return byDistance
    // Below the real hand rather than above it, on a tie. Claiming a hand you
    // have not got is the commoner mistake, so the commoner distractor is the
    // one that lets you make it.
    return HAND_CATEGORIES.indexOf(a) - HAND_CATEGORIES.indexOf(b)
  })

  // Four near neighbours, then three of them at random: a fixed top three would
  // make the same board always offer the same wrong answers.
  const pool = queue.slice(0, 4)
  const taken: string[] = []
  while (taken.length < 3 && pool.length > 0) {
    taken.push(...pool.splice(Math.floor(rng() * pool.length), 1))
  }
  return taken
}

/** The category the board is pointing at, where it is pointing at one. */
function temptation(cards: Card[], made: EvaluatedHand): string | null {
  if (!mirage(cards, made)) return null
  const bySuit = new Map<string, number>()
  for (const card of cards) bySuit.set(card.suit, (bySuit.get(card.suit) ?? 0) + 1)
  if ([...bySuit.values()].some((n) => n === 4) && made.name !== 'Flush') return 'Flush'
  return made.name === 'Straight' ? null : 'Straight'
}

/**
 * Generate the spot at `seed`, or say why it was thrown away.
 *
 * One rejection, and it is the same one every kind here has: a spot whose
 * answer cannot be put in a sentence out of the evaluation that graded it is
 * not a drill we ship.
 */
export function generateWhatsYourHand(seed: number): Generated {
  const { hole, board } = deal(seed)
  const seven = [...hole, ...board]
  const { winners, evaluations } = determineWinners([{ id: HERO, hole }], board)
  const made = evaluations.get(HERO)
  if (!made || winners.length === 0) return reject('unexplainable')

  const phrase = handPhrase(made)
  if (!phrase) return reject('unexplainable')

  const shape = readShape(hole, board)
  const tempted = temptation(seven, made)
  const rng = mulberry32((seed ^ 0x85eb_ca6b) >>> 0)

  // Offered in ranking order, weakest first, so the buttons read as the ladder
  // of hands rather than as four unrelated words. The ladder is the thing being
  // learned, and a shuffled one would be four flashcards.
  const names = [made.name, ...offer(made, tempted, rng)].sort(
    (a, b) => HAND_CATEGORIES.indexOf(a) - HAND_CATEGORIES.indexOf(b),
  )

  const choices: DrillChoice[] = names.map((name) => {
    const text = handPhrase({ name, description: name })
    const winning = name === made.name
    return {
      id: name,
      label: text ? label(text) : name,
      cards: [],
      winning,
      // The five that play, carried on the right answer so the screen can ring
      // them on the felt when it turns over. **The cards are the lesson here**,
      // and a sentence listing them under a board that does not show which they
      // are makes the reader do the matching twice.
      ...(winning ? { plays: bestFive(made) } : {}),
    }
  })

  return accept({
    kind: 'whats-your-hand',
    seed,
    board,
    choices,
    hands: [
      {
        label: 'You',
        cards: hole,
        // No `detail` — naming the hand is the question, so a panel that named
        // it would be printing the answer above the buttons.
      },
    ],
    answer: made.name,
    settledBy: shape,
    difficulty: readDifficulty(shape, tempted !== null),
    explanation: explain(made, phrase, shape, hole, board, tempted),
  })
}

/**
 * The one sentence, out of the same evaluation that set the answer.
 *
 * Two facts, in the order they are useful: what the hand is, and which cards
 * made it — because on this kind *which cards* is the lesson and the name is
 * only the score. Then the temptation, if the spot had one, said as the thing
 * it was rather than as a scolding.
 */
function explain(
  made: EvaluatedHand,
  phrase: string,
  shape: ReadShape,
  hole: Card[],
  board: Card[],
  tempted: string | null,
): string {
  const named = `${phrase[0].toUpperCase()}${phrase.slice(1)}`
  const five = bestFive(made)

  let body: string
  if (shape === 'plays-the-board') {
    body = `${named}, and it is all on the board — neither of your cards improves it, so everybody at this table has the same hand.`
  } else if (shape === 'uses-one') {
    const working = workingCard(hole, board)
    const dead = working ? hole.find((card) => card !== working) : null
    body =
      working && dead
        ? `${named}, using the ${rankName(working.rank)} from your hand. The ${rankName(dead.rank)} does nothing here.`
        : `${named}, and only one of your two cards is doing any work.`
  } else {
    body = `${named}, using both your cards.`
  }

  const tail = tempted
    ? tempted === 'Flush'
      ? ' There are four of one suit out there, which is one short.'
      : ' There are four to a straight out there, which is one short.'
    : ''

  // The five that play, spelled out, because the name of a hand and the cards
  // that make it are two different things to learn and this kind teaches both.
  // Ten renders as "10" here for the same reason it does on a card face.
  const cards = ` The five that play: ${five
    .map((card) => `${card.rank === 'T' ? '10' : card.rank}${SUIT_GLYPH[card.suit]}`)
    .join(' ')}.`

  return `${body}${tail}${cards}`
}
