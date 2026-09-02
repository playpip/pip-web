import { type Card, mulberry32, shuffledDeck } from '@/lib/poker/cards'
import { type EvaluatedHand, determineWinners, handPhrase } from '@/lib/poker/handEval'
import { type StrengthShape, strengthDifficulty } from './rating'
import { type DrillChoice, type Generated, accept, reject } from './types'

// The membership's third kind: two hands face up on the flop, two cards to
// come, which one is the favourite.
//
// **Exact, like the other three, and by the same method.** The answer is found
// by dealing every pair of cards that could still come and asking
// `determineWinners` who takes each one. Nothing is sampled and nothing is
// estimated, so this kind cannot mark a correct answer wrong. That property is
// not optional because a kind is paid for; if anything it is the reverse.
//
// **This is the kind the other three set up.** "Which hand wins" reads a
// finished board, and both turn kinds ask about one card. Here two cards are
// still to come, and the hand that is winning on the flop is often not the one
// that wins the pot. Naming which is which is the whole drill, and it is the
// reading a player has to do on every flop they ever see.
//
// **`membersOnly` lives in config/drills.ts and had to be there in the commit
// that registered this kind** (technology#55). A paid kind that ships without
// it is free forever by rule #8.

const HAND_A = 'a'
const HAND_B = 'b'

/** Cards nobody has seen: 52, less two hole cards each and the three on the flop. */
export const UNSEEN_AFTER_FLOP = 45

/**
 * Pairs of cards that could still come: 45 choose 2.
 *
 * Computed rather than written down, because 990 is a number the explanation
 * puts in front of a player and the only honest source for it is the deck
 * arithmetic on the line above.
 */
export const RUNOUTS = (UNSEEN_AFTER_FLOP * (UNSEEN_AFTER_FLOP - 1)) / 2

/**
 * How close to a coin flip a spot may be and still be asked.
 *
 * The same four points as the pricing kind's margin, for the same reason: a
 * player who reads a 52/48 spot the other way is not wrong, and a drill that
 * marks them wrong is a drill that has stopped being about poker. Four points
 * is a judgement and it wants play-testing, not theory.
 */
export const COIN_FLIP_MARGIN = 0.04

/**
 * Above this the spot is a look rather than a question.
 *
 * A hand drawing this thin has nothing on the screen deciding anything, which
 * is what `one-sided` means on the free kind too. It is a real spot at a table
 * and a bad multiple-choice question.
 *
 * **Two random hands on a random flop are usually a long way apart**, which is
 * the thing that makes this cut load-bearing rather than tidy: measured over
 * 1,000 seeds with no cut at all, the favourite's share has a median of 76% and
 * three spots in four sit above 70%. Without this line the kind would mostly
 * deal blowouts.
 */
export const ONE_SIDED = 0.85

/**
 * Below this the hand that is behind is live enough that you have to see it.
 *
 * A quarter of the runouts to the underdog, which is more than a gutshot and
 * less than a flush draw: enough of the deck that a player who read the made
 * hands and stopped has missed something real, even though they picked the
 * right side anyway.
 *
 * **The line is the median rather than a round number**, and that is the same
 * call the pricing kind's boundaries made. Over 600 seeds the favourite's share
 * of an accepted spot has a median of 75%, so this cuts them about 40 / 58, and
 * the two thirds it started at put five spots in six in one band. A shape
 * almost every spot has is not a difficulty, it is a constant.
 */
export const LIVE = 0.75

/**
 * Above this share of runouts splitting the pot, the spot is not a contest.
 *
 * A third. Some chops are normal on a flop, because two hands often end up
 * playing the same five cards by the river, and counting them as a half each is
 * what equity means. But a spot that splits more often than it does anything
 * else is not asking which hand is the favourite, and the sentence under it
 * ends up quoting a percentage nothing on the screen explains.
 */
export const CHOP_CEILING = 1 / 3

/** Two hands and a flop, dealt from one seeded deck. */
function dealFlop(seed: number): { a: Card[]; b: Card[]; board: Card[]; rest: Card[] } {
  const deck = shuffledDeck(mulberry32(seed))
  return { a: deck.slice(0, 2), b: deck.slice(2, 4), board: deck.slice(4, 7), rest: deck.slice(7) }
}

interface Enumerated {
  /** Runouts hand A takes outright. */
  aWins: number
  /** Runouts hand B takes outright. */
  bWins: number
  /** Runouts that split the pot. Counted as a half to each side, as equity is. */
  chops: number
}

/**
 * Deal every pair of cards that is left and read the showdown.
 *
 * One pass, and everything downstream reads it: which hand is the answer, the
 * sentence under it, and the shape that sets the difficulty. Three readings of
 * the same 990 hands would be three things free to disagree with each other.
 */
function enumerateRunouts(a: Card[], b: Card[], board: Card[], rest: Card[]): Enumerated {
  const contenders = [
    { id: HAND_A, hole: a },
    { id: HAND_B, hole: b },
  ]
  const tally: Enumerated = { aWins: 0, bWins: 0, chops: 0 }

  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      const turn = rest[i]
      const river = rest[j]
      if (!turn || !river) continue
      const { winners } = determineWinners(contenders, [...board, turn, river])
      if (winners.length > 1) tally.chops++
      else if (winners[0] === HAND_A) tally.aWins++
      else tally.bWins++
    }
  }

  return tally
}

/**
 * What makes one of these hard to read, easiest first.
 *
 * Both facts are counted rather than asserted: who is ahead on the flop comes
 * from the same evaluator that settles a showdown, and who is the favourite
 * comes from the enumeration. The hardest shape is the one where they disagree,
 * which is the lesson the kind exists for.
 */
function shapeOf(equity: number, flopLeader: string | null, favourite: string): StrengthShape {
  if (flopLeader && flopLeader !== favourite) return 'draw-is-favourite'
  return equity < LIVE ? 'live-underdog' : 'clear-favourite'
}

/**
 * Generate the spot at `seed`, or say why it was thrown away.
 *
 * Four rejections, and every one of them is about the question rather than the
 * answer. The answer is always computable here: it is 990 showdowns.
 */
export function generateHandStrength(seed: number): Generated {
  const { a, b, board, rest } = dealFlop(seed)
  const contenders = [
    { id: HAND_A, hole: a },
    { id: HAND_B, hole: b },
  ]

  const flop = determineWinners(contenders, board)
  const evalA = flop.evaluations.get(HAND_A)
  const evalB = flop.evaluations.get(HAND_B)
  const phraseA = evalA ? handPhrase(evalA) : undefined
  const phraseB = evalB ? handPhrase(evalB) : undefined
  // The sentence names what each hand holds on the flop, so a spot we cannot
  // put into words is not a spot we deal. Silence over noise, at generation
  // time, which is the same call every other kind makes.
  if (!evalA || !evalB || !phraseA || !phraseB) return reject('unexplainable')

  const { aWins, bWins, chops } = enumerateRunouts(a, b, board, rest)
  const equityA = (aWins + chops / 2) / RUNOUTS
  const favourite = equityA >= 0.5 ? HAND_A : HAND_B
  const equity = favourite === HAND_A ? equityA : 1 - equityA

  if (chops / RUNOUTS > CHOP_CEILING) return reject('chop-possible')
  if (equity - 0.5 < COIN_FLIP_MARGIN) return reject('ambiguous')
  if (equity > ONE_SIDED) return reject('one-sided')

  // A flop both hands play to the same five cards has no leader, which is a
  // real state and not a rejection: it just means nothing separates them yet.
  const flopLeader = flop.winners.length > 1 ? null : (flop.winners[0] ?? null)
  const shape = shapeOf(equity, flopLeader, favourite)

  const choices: DrillChoice[] = [
    hand(HAND_A, 'Hand A', a, evalA, favourite === HAND_A),
    hand(HAND_B, 'Hand B', b, evalB, favourite === HAND_B),
  ]

  return accept({
    kind: 'hand-strength',
    seed,
    board,
    choices,
    answer: favourite,
    settledBy: shape,
    difficulty: strengthDifficulty(shape),
    explanation: explain({
      favourite,
      equity,
      takes: favourite === HAND_A ? aWins : bWins,
      chops,
      flopLeader,
      phraseA,
      phraseB,
    }),
  })
}

function hand(
  id: string,
  label: string,
  cards: Card[],
  evaluated: EvaluatedHand,
  winning: boolean,
): DrillChoice {
  // The made hand as it stands on the flop, shown from the start rather than at
  // the reveal. You cannot decide which hand gets there more often without
  // being told what each one is now, and hiding it would make this a guess.
  //
  // **No `plays`.** On a flop the five cards a hand plays are usually all five
  // on the screen, so highlighting them says nothing and looks like it does.
  const phrase = handPhrase(evaluated)?.replace(/^an? /, '')
  return {
    id,
    label,
    cards,
    winning,
    ...(phrase ? { detail: capitalise(phrase) } : {}),
  }
}

/** For a label or the start of a sentence: "a flush" -> "A flush". */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * The one sentence, out of the same enumeration that set the answer.
 *
 * Two facts, in the order they are useful: how often the favourite gets there,
 * then what the flop says, which is the half a reader got wrong if they got it
 * wrong. Never scolds, and every number in it was counted.
 */
function explain(spot: {
  favourite: string
  equity: number
  takes: number
  chops: number
  flopLeader: string | null
  phraseA: string
  phraseB: string
}): string {
  const label = (id: string) => (id === HAND_A ? 'Hand A' : 'Hand B')
  const phrase = (id: string) => (id === HAND_A ? spot.phraseA : spot.phraseB)
  const other = spot.favourite === HAND_A ? HAND_B : HAND_A
  const pct = Math.round(spot.equity * 100)

  const head = spot.chops
    ? `${label(spot.favourite)} is the favourite: it takes ${spot.takes} of the ${RUNOUTS} runouts and chops ${spot.chops}, which is ${pct}%.`
    : `${label(spot.favourite)} is the favourite: it takes ${spot.takes} of the ${RUNOUTS} runouts, ${pct}%.`

  if (!spot.flopLeader) return `${head} Nothing separates them on the flop.`
  if (spot.flopLeader === spot.favourite) {
    return `${head} It is ahead on the flop as well, ${holding(phrase(spot.favourite))}.`
  }
  return `${head} ${label(other)} is ahead on the flop ${holding(phrase(other))} and does not stay there.`
}

/**
 * "with a pair", or "on high card alone".
 *
 * A flop is three cards, so one hand in two has nothing, and "with high card"
 * is not a sentence. The counting kind throws those spots away because a river
 * that makes high card is not a draw getting there; here it is the commonest
 * true thing you can say about a flop, so it gets said properly instead.
 */
function holding(phrase: string): string {
  return phrase === 'high card' ? 'on high card alone' : `with ${phrase}`
}
