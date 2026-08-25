import { type Card, type Rng, mulberry32, shuffledDeck } from '@/lib/poker/cards'
import { determineWinners, evaluateHand, handPhrase } from '@/lib/poker/handEval'
import { type OutsShape, outsDifficulty } from './rating'
import { type DrillChoice, type DrillHand, type Generated, accept, reject } from './types'

// The membership's first kind: two hands face up on the turn, one card to come,
// how many of the cards left win it for you.
//
// **Exact, like the free kind, and for the same reason.** Nothing here is
// sampled or estimated: the answer is found by dealing each of the 44 unseen
// cards in turn and asking `determineWinners` who takes it, which is the same
// call that settles a real showdown. A drill that grades a stranger has to be
// incapable of marking a correct answer wrong, and that property does not
// become optional because the kind is paid for.
//
// **Both hands are face up on purpose.** Outs against an unknown range is a
// different and much fuzzier thing, and the fuzzy version cannot be graded
// exactly. Face up is also how outs are taught: you have the flush draw, they
// have top pair, here is what gets you there.
//
// **`membersOnly` lives in config/drills.ts and had to be there in the commit
// that registered this kind** (technology#55). A paid kind that ships without
// it is free forever by rule #8, and the box the membership is priced from
// empties itself on the way to being sold.

const HERO = 'hero'
const VILLAIN = 'villain'

/**
 * Cards nobody has seen: 52, less two hole cards each and the four on the turn.
 *
 * A constant rather than `rest.length` in the sentence, so that a change to the
 * deal has to come past this line. The tests assert the deck arithmetic holds.
 */
const UNSEEN = 44

/** Two hands and a turn board, dealt from one seeded deck. */
function deal(seed: number): { hero: Card[]; villain: Card[]; board: Card[]; rest: Card[] } {
  const deck = shuffledDeck(mulberry32(seed))
  return {
    hero: deck.slice(0, 2),
    villain: deck.slice(2, 4),
    board: deck.slice(4, 8),
    rest: deck.slice(8),
  }
}

/** What one river card does for the hero. */
type RiverOutcome = 'wins' | 'chops' | 'loses'

interface Enumerated {
  /** Rivers the hero wins outright, by the hand each one makes, in deal order. */
  outs: { card: Card; phrase: string }[]
  /** Rivers that split the pot. Any at all and the spot is thrown away. */
  chops: number
  /**
   * Rivers that improve the hero's hand and still lose. The miscount this drill
   * is really about: everything that pairs you up looks like an out.
   */
  traps: number
  /** True if any winning river makes a hand we cannot put in a sentence. */
  unexplainable: boolean
}

/**
 * Deal every card that is left, one at a time, and read the showdown.
 *
 * One pass, and everything downstream reads it: the count that is the answer,
 * the sentence under it, and the shape that sets the difficulty. Three readings
 * of the same 44 hands would be three things free to disagree with each other,
 * which is the defect this whole layer is built to be incapable of.
 */
function enumerateRivers(hero: Card[], villain: Card[], board: Card[], rest: Card[]): Enumerated {
  const contenders = [
    { id: HERO, hole: hero },
    { id: VILLAIN, hole: villain },
  ]
  const turnRank = evaluateHand(hero, board).categoryRank
  const enumerated: Enumerated = { outs: [], chops: 0, traps: 0, unexplainable: false }

  for (const card of rest) {
    const river = [...board, card]
    const { winners } = determineWinners(contenders, river)
    const outcome: RiverOutcome =
      winners.length > 1 ? 'chops' : winners[0] === HERO ? 'wins' : 'loses'

    if (outcome === 'chops') {
      enumerated.chops++
      continue
    }

    const made = evaluateHand(hero, river)
    if (outcome === 'wins') {
      const phrase = handPhrase(made)
      // "High card" is not a draw getting there, and "they all make high card"
      // is not a sentence. Both point the same way: this is not a spot about
      // counting outs, so it is not one we deal.
      if (!phrase || phrase === 'high card') enumerated.unexplainable = true
      else enumerated.outs.push({ card, phrase })
      continue
    }

    if (made.categoryRank > turnRank) enumerated.traps++
  }

  return enumerated
}

/** How many different hands the winning cards make: the thing that makes counting hard. */
function shapeOf(phrases: string[]): OutsShape {
  const distinct = new Set(phrases).size
  return distinct === 1 ? 'one-draw' : distinct === 2 ? 'two-draws' : 'many-draws'
}

/**
 * The four numbers on offer: the count, and three near misses.
 *
 * The offsets are the miscounts people actually make — dropping a card, double
 * counting a card, taking a nine-out flush draw for an eight-out straight draw,
 * counting a whole extra draw that is not there.
 *
 * **How many sit below the answer is chosen before which ones are**, and that
 * is the load-bearing part rather than a tidy-up. The buttons are shown in
 * ascending order, so if the distractors were simply drawn from a symmetric
 * pool the answer would sit in the middle far more often than not, and "pick
 * the middle one" would beat reading the board.
 *
 * **It is spread, not uniform, and the difference is worth stating.** Measured
 * over 6,000 seeds the answer lands in the four slots 24 / 30 / 28 / 19 percent
 * of the time. The skew is arithmetic rather than an oversight: most spots have
 * few outs, and a three-out spot has only two positive numbers below it to
 * offer, so it cannot put the answer at the top. Offering zero would even it out
 * and cost more than it saves, because a spot is never accepted with no outs and
 * a zero button is therefore a distractor that can always be discounted. So the
 * best position-guessing strategy beats a coin at 30% against 25%, and loses
 * badly to counting. A test holds every slot inside 15-35% so that a change to
 * the offsets cannot quietly turn one slot into the answer.
 */
const OFFSETS = [1, 2, 3, 4, 6, 9] as const

function offer(outs: number, rng: Rng): number[] {
  const below = OFFSETS.map((d) => outs - d).filter((n) => n >= 1)
  const above = OFFSETS.map((d) => outs + d).filter((n) => n <= UNSEEN)

  // How many of the three go under the answer. Clamped to what actually exists
  // on each side: with two outs there is only one number below it to offer.
  const wanted = Math.floor(rng() * 4)
  const takeBelow = Math.min(below.length, Math.max(wanted, 3 - above.length))
  const takeAbove = 3 - takeBelow

  const picked = [...pick(below, takeBelow, rng), ...pick(above, takeAbove, rng), outs]
  return picked.sort((a, b) => a - b)
}

/**
 * `count` items from `pool`, chosen by the spot's own rng so the spot is
 * reproducible.
 *
 * The local below is `unpicked` rather than the obvious word, which
 * `tests/drills.test.ts` bans across this folder along with the rest of a
 * meter's vocabulary. It is a real catch rather than a nuisance: the ban is
 * what makes "how many has this player got left" impossible to write here by
 * habit, and the cost of keeping it is one variable name.
 */
function pick(pool: number[], count: number, rng: Rng): number[] {
  const unpicked = [...pool]
  const taken: number[] = []
  for (let i = 0; i < count && unpicked.length > 0; i++) {
    taken.push(...unpicked.splice(Math.floor(rng() * unpicked.length), 1))
  }
  return taken
}

/**
 * Generate the spot at `seed`, or say why it was thrown away.
 *
 * Four rejections and every one of them is about the question rather than the
 * answer. See `RejectReason` in ./types for what each one means and why a spot
 * that trips it is not worth asking.
 */
export function generateCountYourOuts(seed: number): Generated {
  const { hero, villain, board, rest } = deal(seed)
  const contenders = [
    { id: HERO, hole: hero },
    { id: VILLAIN, hole: villain },
  ]

  // Nothing to count when you are already there. Ties included: "how many cards
  // win it for you" is not a question you ask about a hand you are chopping.
  const turn = determineWinners(contenders, board)
  if (turn.winners.includes(HERO)) return reject('already-ahead')

  const { outs, chops, traps, unexplainable } = enumerateRivers(hero, villain, board, rest)
  if (chops > 0) return reject('chop-possible')
  if (unexplainable) return reject('unexplainable')
  if (outs.length === 0) return reject('drawing-dead')

  const count = outs.length
  const shape = shapeOf(outs.map((out) => out.phrase))
  const trap = traps >= count * 2

  // A second stream, seeded from the spot's own seed, so the numbers on the
  // buttons are as reproducible as the cards are and are still independent of
  // the shuffle that dealt them.
  const numbers = offer(count, mulberry32((seed ^ 0x9e37_79b9) >>> 0))

  const choices: DrillChoice[] = numbers.map((n) => ({
    id: String(n),
    label: String(n),
    cards: [],
    winning: n === count,
  }))

  return accept({
    kind: 'count-your-outs',
    seed,
    board,
    choices,
    hands: showHands(hero, villain, board),
    answer: String(count),
    settledBy: shape,
    difficulty: outsDifficulty(shape, trap),
    explanation: explain(outs, traps, trap),
  })
}

/**
 * Both holdings, with what each one is right now.
 *
 * The villain's made hand is named from the start rather than at the reveal,
 * and that is the drill: you cannot count what beats you without being told
 * what you are up against. Hiding it would make this a guessing game about the
 * opponent rather than an exercise in counting.
 */
function showHands(hero: Card[], villain: Card[], board: Card[]): DrillHand[] {
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

/**
 * The one sentence, out of the same enumeration that set the answer.
 *
 * Two facts, in the order they are useful: how many cards win it and what each
 * of them makes, then the trap if the spot has one. Never scolds, never says
 * "correct", and every number in it was counted rather than estimated.
 */
function explain(outs: { phrase: string }[], traps: number, trap: boolean): string {
  const count = outs.length
  const byPhrase = new Map<string, number>()
  for (const out of outs) byPhrase.set(out.phrase, (byPhrase.get(out.phrase) ?? 0) + 1)

  const groups = [...byPhrase.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  const head =
    count === 1
      ? `One of the ${UNSEEN} cards left wins it for you`
      : `${count} of the ${UNSEEN} cards left win it for you`

  const body =
    groups.length === 1
      ? count === 1
        ? `, and it makes ${groups[0][0]}.`
        : `, and they all make ${groups[0][0]}.`
      : `: ${list(groups.map(([phrase, n]) => `${n} make ${phrase}`))}.`

  // The trap is the lesson, so it gets its own sentence rather than a clause.
  const tail = trap ? ` ${traps} more improve your hand and still lose.` : ''

  return `${head}${body}${tail}`
}

/** "a, b and c" — the Oxford comma is not our house style. */
function list(parts: string[]): string {
  if (parts.length < 2) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}
