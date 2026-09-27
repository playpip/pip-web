import { holeKey } from '@/config/handNames'
import {
  SEATS,
  opensHand,
  SEATS_AT_A_TABLE,
  type SeatId,
  postflopPlace,
  preflopPlace,
  seatById,
} from '@/config/positions'
import { OPENING_SEATS, type OpeningSeat, openAnswer, openVerdict } from '@/lib/drills/openOrFold'
import { requiredEquity } from '@/config/potOdds'
import { characterById } from '@/config/cast'
import { RIVER_MARGIN } from '@/lib/drills/callingTheRiver'
import { BLUFF_WEIGHTS, count, riverRange, weigh } from '@/lib/drills/riverRange'
import { UNSEEN } from '@/lib/drills/turnSpot'
import { type Card, SUIT_GLYPH, cardFromString } from '@/lib/poker/cards'
import { type HandState, potSize } from '@/lib/poker/engine'
import {
  bigBlinds,
  bluffChoices,
  countChoices,
  pairsTheBoard,
  percent,
  priceChoices,
  priceOf,
  rangeVerdict,
  riverOuts,
  showdownShare,
  stackChoices,
} from './reckon'
import { type Trait, mostOf, playsAt, roomById, traitBecause } from './regulars'
import { LESSON_BLINDS, OPEN_TO, type Scene, type SceneAction, lineOf } from './scene'

// A lesson is beats, and a beat is a moment at the table: Webb sets the scene,
// sometimes asks you something, you answer with a real button, and he answers
// with the cards still in front of you.
//
// **No beat carries its own answer.** A question is one of three kinds, and the
// right answer to each is computed here from the same place the rest of the app
// gets it: raise or fold from the starting-hand chart (the Open or fold pack's
// `openAnswer`), who acts last from the seat order the position guide prints
// (and tests/positions.test.ts plays through the engine), and who acts first
// from the engine's own `toActIndex`. So the lesson cannot teach an answer that
// the guide, the pack or the table disagrees with, and a test walks every
// question in every lesson to prove it.

/** What a beat asks, if it asks anything. The answer is never written down. */
export type Ask =
  /** It is your turn with the scene's hand in the scene's seat: raise or fold? */
  | { kind: 'open-or-fold'; prompt: string }
  /** Which of the six seats acts last, before the flop or after it? */
  | { kind: 'acts-last'; street: 'preflop' | 'postflop'; prompt: string }
  /** Of the players still in, whose turn is it? Read off the engine. */
  | { kind: 'acts-first'; prompt: string }
  /** The first seat the chart opens your hand from, or never. `opensHand`, seat by seat. */
  | { kind: 'first-seat'; prompt: string }
  /** How many rivers win it for you against a hand you can see? Every river dealt. */
  | { kind: 'count-outs'; against: SeatId; prompt: string }
  /** What share of the pot does the call cost? `requiredEquity`. */
  | { kind: 'price'; prompt: string }
  /** Facing a bet with one card to come against a hand you can see: call or fold? */
  | { kind: 'call-or-fold'; against: SeatId; prompt: string }
  /**
   * A stack in big blinds: yours, or the effective stack between you and
   * `against` — the smaller of the two, the most either of you can win.
   */
  | { kind: 'big-blinds'; against?: SeatId; prompt: string }
  /** A standard raise (two and a half blinds) as a share of your stack. */
  | { kind: 'raise-share'; prompt: string }
  /**
   * Which of these hands is still in their range, after what they have done?
   * The calling-the-river pack's model (`riverRange`), filter by filter.
   */
  | {
      kind: 'in-range'
      seat: SeatId
      hands: readonly (readonly [string, string])[]
      prompt: string
    }
  /** They have bet the river into you: call or fold, against their range. The pack's grade. */
  | { kind: 'river-call'; seat: SeatId; prompt: string }
  /** You are thinking of betting `bet`: how often must they fold for it to pay? */
  | { kind: 'bluff-price'; bet: number; prompt: string }
  /** Which of two hands is the better bluff here: the one that cannot win a showdown. */
  | {
      kind: 'better-bluff'
      seat: SeatId
      hands: readonly [readonly [string, string], readonly [string, string]]
      prompt: string
    }
  /** Of these regulars, who has the most of this trait at this room? Their dials, compared. */
  | { kind: 'which-regular'; trait: Trait; among: readonly string[]; room: string; prompt: string }

/** The asks answered with a seat, which the felt lets you tap. */
export const SEAT_ASKS: ReadonlySet<Ask['kind']> = new Set(['acts-last', 'acts-first'])

/** The asks answered with a count, set large on their buttons like a drill's. */
export const NUMERIC_ASKS: ReadonlySet<Ask['kind']> = new Set([
  'count-outs',
  'price',
  'big-blinds',
  'raise-share',
  'bluff-price',
])

export interface Beat {
  /** Stable within a lesson. */
  id: string
  /**
   * Whose register the line is in. Webb's own dry voice is for the way in and
   * the way out (docs/brand.md: the dry line belongs to the chrome); the
   * teaching in between is plain, because a joke in the middle of an idea is a
   * second idea.
   */
  voice: 'webb' | 'plain'
  /** What Webb says as the beat opens. */
  say: string
  /** The table, as the engine deals and plays it. */
  scene: Scene
  /** Where Webb sits. Never your seat. */
  webb: SeatId
  /** Name every seat by its position, for the beats that are about the seats. */
  labels?: boolean
  ask?: Ask
  /** Played on the felt once you have answered: what happens next at the table. */
  playOn?: readonly SceneAction[]
  /** Said after the answer, under it: what the table just showed. */
  aside?: string
  /** Seats whose cards are face up: a hand Webb plays open so you can count against it. */
  reveal?: readonly SeatId[]
  /** Who sits where, by character id, where the beat is about who they are. */
  cast?: Partial<Record<SeatId, string>>
}

/** One answer on offer. Seats are ids, so the screen names them its own way. */
export interface Choice {
  id: string
  label: string
  /** What a screen reader says, where the label is a bare number. */
  spoken?: string
}

/** A beat's question, worked out: the choices, the right one, and why. */
export interface Question {
  prompt: string
  choices: Choice[]
  answer: string
  because: string
}

/** The six seats in the order they act before the flop, for a row of buttons. */
const SEAT_CHOICES: Choice[] = [...SEATS]
  .sort((a, b) => preflopPlace(a) - preflopPlace(b))
  .map((seat) => ({ id: seat.id, label: seat.short }))

const isOpeningSeat = (seat: SeatId): seat is OpeningSeat =>
  (OPENING_SEATS as readonly SeatId[]).includes(seat)

/**
 * The question a beat asks, worked out against the table as it stands, or null
 * for a beat that only talks. Throws for a question the table cannot answer —
 * raise-or-fold from a blind, or "whose turn" when nobody's it is — because that
 * is a lesson written wrong, and the tests should be what finds it.
 */
export function questionFor(beat: Beat, state: HandState): Question | null {
  const ask = beat.ask
  if (!ask) return null

  if (ask.kind === 'open-or-fold') {
    const seat = beat.scene.heroSeat
    const hand = holeKey(state.players[0]?.hole ?? [])
    if (!hand || !isOpeningSeat(seat)) {
      throw new Error(`${beat.id}: raise or fold is only asked from a seat that opens`)
    }
    return {
      prompt: ask.prompt,
      choices: [
        { id: 'fold', label: 'Fold' },
        { id: 'raise', label: `Raise to ${OPEN_TO}` },
      ],
      answer: openAnswer(seatById(seat), hand),
      because: openVerdict(seat, hand),
    }
  }

  if (ask.kind === 'acts-last') {
    const place = ask.street === 'preflop' ? preflopPlace : postflopPlace
    const last = SEATS.find((seat) => place(seat) === SEATS_AT_A_TABLE)
    if (!last) throw new Error('No seat acts last')
    return {
      prompt: ask.prompt,
      choices: SEAT_CHOICES,
      answer: last.id,
      because:
        ask.street === 'preflop'
          ? `The ${last.name.toLowerCase()}. The blinds have chips in already, so before the flop they get the last word. From the flop on they speak first, every street.`
          : `The ${last.name.toLowerCase()}. From the flop on it acts last on every street: the flop, the turn and the river, which is where the big pots are.`,
    }
  }

  if (ask.kind === 'acts-first') {
    const actor = state.players[state.toActIndex]
    if (!actor) throw new Error(`${beat.id}: nobody is to act`)
    return {
      prompt: ask.prompt,
      choices: state.players
        .filter((p) => p.status === 'active')
        .map((p) => ({ id: p.id, label: seatById(p.id as SeatId).short })),
      answer: actor.id,
      because: `The ${seatById(actor.id as SeatId).name.toLowerCase()}. The first seat still in after the button speaks first, and it will on the turn and the river too.`,
    }
  }

  return reckoned(beat, ask, state)
}

// --- the lessons after Position ----------------------------------------------
//
// Every branch below is the same contract as the three above: the answer is
// worked out from the table as the engine dealt it, by a function the rest of
// the app already grades with (see ./reckon and ./regulars), and a question the
// table cannot answer cleanly throws, so the tests find a lesson written wrong
// before a player does.

/** The chart's bands, as the buttons of a "first seat" question. */
const FIRST_SEAT_CHOICES: Choice[] = [
  { id: 'any', label: 'Any seat' },
  { id: 'middle', label: 'Middle on' },
  { id: 'late', label: 'Late only' },
  { id: 'never', label: 'Never' },
]

const FIRST_SEAT_BECAUSE: Record<string, string> = {
  any: 'opens from every seat, under the gun included.',
  middle:
    'opens from the middle seat onwards. Under the gun, with five still to act, it is a fold.',
  late: 'opens from the cutoff and the button only, when there are just the blinds, or one more, left to get past.',
  never: 'is not on the chart from any seat, the button included. It is a fold everywhere.',
}

/** Cards the way the lessons write them: "J♥ 9♥". */
const cardText = (card: Card) => `${card.rank === 'T' ? '10' : card.rank}${SUIT_GLYPH[card.suit]}`
const holeText = (hole: readonly Card[]) => hole.map(cardText).join(' ')

/** "a, b and c", the house style. */
function list(parts: readonly string[]): string {
  if (parts.length < 2) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

function holeOf(state: HandState, seat: SeatId, beat: Beat): Card[] {
  const hole = state.players.find((p) => p.id === seat)?.hole ?? []
  if (hole.length !== 2) throw new Error(`${beat.id}: nobody in ${seat}`)
  return hole
}

/** What you owe and what is in the middle, when it is your turn facing a bet. */
function facingBet(state: HandState, beat: Beat): { toCall: number; pot: number } {
  const hero = state.players[0]
  if (state.toActIndex !== 0) throw new Error(`${beat.id}: it is not your turn`)
  const toCall = state.currentBet - hero.committedThisStreet
  if (toCall <= 0 || hero.committedThisStreet > 0) {
    throw new Error(`${beat.id}: you are not facing a single bet`)
  }
  return { toCall, pot: potSize(state) }
}

/** A stack before the hand began: what is behind plus what went in. */
const startingStack = (player: HandState['players'][number]) =>
  player.stack + player.committedThisHand

function reckoned(beat: Beat, ask: Ask, state: HandState): Question {
  const hero = state.players[0]
  const board = state.community

  if (ask.kind === 'first-seat') {
    const hand = holeKey(hero.hole)
    if (!hand) throw new Error(`${beat.id}: no hand`)
    // Seat by seat through the chart, earliest first, exactly as a player
    // would ask it: from where does this start being a raise?
    const first = OPENING_SEATS.find((seat) => opensHand(seatById(seat), hand))
    const answer = first ? (seatById(first).opens ?? 'never') : 'never'
    return {
      prompt: ask.prompt,
      choices: FIRST_SEAT_CHOICES,
      answer,
      because: `${hand} ${FIRST_SEAT_BECAUSE[answer]}`,
    }
  }

  if (ask.kind === 'count-outs') {
    const outs = riverOuts(hero.hole, holeOf(state, ask.against, beat), board)
    if (outs.chops > 0) throw new Error(`${beat.id}: a river splits it, so the count is not clean`)
    const answer = outs.wins.length
    if (answer === 0) throw new Error(`${beat.id}: drawing dead`)
    const traps = outs.traps.length
    return {
      prompt: ask.prompt,
      choices: countChoices(answer, answer + traps).map((n) => ({
        id: String(n),
        label: String(n),
        spoken: `${n} cards`,
      })),
      answer: String(answer),
      because:
        `${answer} of the ${UNSEEN} cards left win it for you.` +
        (traps > 0
          ? ` ${list(outs.traps.map(cardText))} ${traps === 1 ? 'makes' : 'make'} the hand you were drawing to and still ${traps === 1 ? 'loses' : 'lose'}, so ${traps === 1 ? 'it is' : 'they are'} not outs.`
          : ''),
    }
  }

  if (ask.kind === 'price') {
    const { toCall, pot } = facingBet(state, beat)
    const { right, all } = priceChoices(toCall, pot)
    return {
      prompt: ask.prompt,
      choices: all.map((p) => ({ id: p, label: p })),
      answer: right,
      because: `${right}. You put in ${toCall} to win a pot that will hold ${pot + toCall} once you have, so you need to win it ${right} of the time to break even. Dividing by the pot as it stands flatters the price.`,
    }
  }

  if (ask.kind === 'call-or-fold') {
    const { toCall, pot } = facingBet(state, beat)
    const outs = riverOuts(hero.hole, holeOf(state, ask.against, beat), board)
    if (outs.chops > 0) throw new Error(`${beat.id}: a river splits it`)
    const wins = outs.wins.length
    const chance = wins / UNSEEN
    const price = priceOf(toCall, pot)
    // The pot odds drill's margin: closer than four points and the two answers
    // are worth the same, which is not a question worth marking.
    if (Math.abs(chance - price) < 0.04) throw new Error(`${beat.id}: too close to call`)
    const answer = chance > price ? 'call' : 'fold'
    return {
      prompt: ask.prompt,
      choices: [
        { id: 'fold', label: 'Fold' },
        { id: 'call', label: `Call ${toCall}` },
      ],
      answer,
      because: `You win on ${wins} of the ${UNSEEN} cards left: ${percent(chance)}, or about ${2 * wins}% by the rule of two. The call needs ${percent(price)}, so it is a ${answer}.`,
    }
  }

  if (ask.kind === 'big-blinds') {
    const mine = startingStack(hero)
    const bb = state.bigBlind
    if (!ask.against) {
      const answer = bigBlinds(mine, bb)
      return {
        prompt: ask.prompt,
        choices: stackChoices(answer, []).map((n) => ({
          id: String(n),
          label: String(n),
          spoken: `${n} big blinds`,
        })),
        answer: String(answer),
        because: `${answer}. ${mine} chips over a big blind of ${bb}. The chips never changed what they are worth; this is the number that says how much poker you can play with them.`,
      }
    }
    const villain = state.players.find((p) => p.id === ask.against)
    if (!villain) throw new Error(`${beat.id}: nobody in ${ask.against}`)
    const theirs = startingStack(villain)
    const answer = bigBlinds(Math.min(mine, theirs), bb)
    const other = bigBlinds(Math.max(mine, theirs), bb)
    return {
      prompt: ask.prompt,
      choices: stackChoices(answer, [other]).map((n) => ({
        id: String(n),
        label: String(n),
        spoken: `${n} big blinds`,
      })),
      answer: String(answer),
      because: `${answer}, the shorter of the two stacks. Nobody can win more from a player than that player has, so the bigger stack’s extra ${bigBlinds(Math.abs(mine - theirs), bb)} big blinds are not in this pot, whoever holds them.`,
    }
  }

  if (ask.kind === 'raise-share') {
    const stack = startingStack(hero)
    const bb = state.bigBlind
    const openTo = (OPEN_TO / LESSON_BLINDS.big) * bb
    const share = openTo / stack
    const all = [share / 2, share, share * 2].map(percent)
    if (new Set(all).size !== 3) throw new Error(`${beat.id}: shares collide`)
    return {
      prompt: ask.prompt,
      choices: all.map((p) => ({ id: p, label: p })),
      answer: percent(share),
      because: `${percent(share)}. A raise to ${openTo} is two and a half of your ${bigBlinds(stack, bb)} big blinds, before a single card of the flop.`,
    }
  }

  if (ask.kind === 'in-range') {
    if (ask.seat !== beat.webb)
      throw new Error(`${beat.id}: the range is Webb's, and Webb says "I"`)
    const line = lineOf(beat.scene, ask.seat)
    const dead = new Set([...hero.hole, ...board].map((c) => `${c.rank}${c.suit}`))
    const hands = ask.hands.map((pair) => {
      if (pair.some((c) => dead.has(c))) throw new Error(`${beat.id}: ${pair} is on the table`)
      const hole = pair.map(cardFromString)
      return { hole, verdict: rangeVerdict(hole, board, line) }
    })
    const inside = hands.filter((h) => h.verdict === 'in')
    if (inside.length !== 1) throw new Error(`${beat.id}: ${inside.length} of the hands are in`)
    const kept = inside[0]
    const bet = line.flop === 'bet' || line.turn === 'bet'
    const why = !bet
      ? 'a hand I play before the flop, and nothing since has ruled it out'
      : pairsTheBoard(kept.hole, board)
        ? 'it has a pair of its own to bet'
        : 'it has a draw to bet'
    const REASON: Record<string, string> = {
      preflop: 'is not a hand I play before the flop',
      flop: 'had nothing on the flop, and I bet it',
      turn: 'had nothing on the turn, and I bet that too',
    }
    const out = hands
      .filter((h) => h !== kept)
      .map((h) => `${holeText(h.hole)} ${REASON[h.verdict]}`)
    return {
      prompt: ask.prompt,
      choices: hands.map((h, i) => ({ id: `h${i}`, label: holeText(h.hole) })),
      answer: `h${hands.indexOf(kept)}`,
      because: `${holeText(kept.hole)}: ${why}. ${out.map((o) => `${o[0].toUpperCase()}${o.slice(1)}.`).join(' ')}`,
    }
  }

  if (ask.kind === 'river-call') {
    if (board.length !== 5) throw new Error(`${beat.id}: the river is not out`)
    const { toCall, pot } = facingBet(state, beat)
    const fraction = toCall / (pot - toCall)
    const required = requiredEquity(fraction)
    const line = lineOf(beat.scene, ask.seat)
    const counted = count(hero.hole, board, riverRange(hero.hole, board, line), fraction)
    const at = (weight: number) => weigh(counted, weight)
    const typical = at(BLUFF_WEIGHTS.typical)
    const verdict = (equity: number) => (equity > required ? 'call' : 'fold')
    const answer = verdict(typical.equity)
    // The pack's own rule: only asked when the answer is the same whoever is
    // betting, the Garage's bluffer or the Main Event's, and clear of the margin.
    for (const weight of [BLUFF_WEIGHTS.low, BLUFF_WEIGHTS.high]) {
      const e = at(weight).equity
      if (verdict(e) !== answer || Math.abs(e - required) * 100 < RIVER_MARGIN) {
        throw new Error(`${beat.id}: the answer depends on who is betting`)
      }
    }
    return {
      prompt: ask.prompt,
      choices: [
        { id: 'fold', label: 'Fold' },
        { id: 'call', label: `Call ${toCall}` },
      ],
      answer,
      because: `A bet like this is ${typical.valueHands} hands for value, the weakest of them ${typical.weakestValue}, and some of the ${typical.missedHands} that missed. Against all of it you win ${percent(typical.equity)}, and the call needs ${percent(required)}, so it is a ${answer}.`,
    }
  }

  if (ask.kind === 'bluff-price') {
    if (state.toActIndex !== 0 || state.currentBet > hero.committedThisStreet) {
      throw new Error(`${beat.id}: a bluff is a bet into a pot nobody has bet`)
    }
    const pot = potSize(state)
    const { right, all } = bluffChoices(ask.bet, pot)
    return {
      prompt: ask.prompt,
      choices: all.map((p) => ({ id: p, label: p })),
      answer: right,
      because: `${right}. You risk ${ask.bet} to win the ${pot} already there, so ${ask.bet} out of ${ask.bet + pot}. Get more folds than that and the bet makes money on its own, whatever you are holding.`,
    }
  }

  if (ask.kind === 'better-bluff') {
    if (board.length !== 5) throw new Error(`${beat.id}: the river is not out`)
    const line = lineOf(beat.scene, ask.seat)
    const hands = ask.hands.map((pair) => {
      const hole = pair.map(cardFromString)
      return { hole, share: showdownShare(hole, board, line) }
    })
    const [a, b] = hands
    if (Math.abs(a.share - b.share) < 0.2) throw new Error(`${beat.id}: no clear bluff`)
    const bluff = a.share < b.share ? a : b
    const other = bluff === a ? b : a
    return {
      prompt: ask.prompt,
      choices: hands.map((h, i) => ({ id: `h${i}`, label: holeText(h.hole) })),
      answer: `h${hands.indexOf(bluff)}`,
      because: `${holeText(bluff.hole)}. Checked down, it beats ${bluff.share === 0 ? 'none' : percent(bluff.share)} of the hands I can have here; ${holeText(other.hole)} beats ${percent(other.share)}. Bluff with the hand that cannot win any other way, and let the other one get to a showdown.`,
    }
  }

  if (ask.kind === 'which-regular') {
    const room = roomById(ask.room)
    for (const id of ask.among) {
      if (!playsAt(id, room)) throw new Error(`${beat.id}: ${id} does not play at ${room.id}`)
    }
    const answer = mostOf(ask.trait, ask.among, room)
    return {
      prompt: ask.prompt,
      choices: ask.among.map((id) => ({ id, label: characterById(id)?.name ?? id })),
      answer,
      because: traitBecause(ask.trait, answer, room),
    }
  }

  throw new Error(`${beat.id}: an ask nobody answers`)
}

/** Right or not. The question already carries its answer; nothing is recomputed. */
export function isRight(question: Question, choiceId: string): boolean {
  return question.answer === choiceId
}
