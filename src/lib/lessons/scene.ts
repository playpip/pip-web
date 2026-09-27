import { SEATS_AT_A_TABLE, type SeatId, seatById } from '@/config/positions'
import {
  type Card,
  cardFromString,
  cardToString,
  mulberry32,
  shuffledDeck,
} from '@/lib/poker/cards'
import { type Action, type HandState, applyAction, startHand } from '@/lib/poker/engine'

// A lesson's table, dealt by the real engine.
//
// **Everything on the felt in a lesson is a `HandState` the engine produced**
// (Will, 2026-09-23: "everything happens on the real poker table"). A scene
// says where you sit, what you hold, and what everybody does, and this file
// deals it with `startHand` and plays it with `applyAction` — so the blinds are
// posted by the rule that posts them at every table, the button is where the
// engine puts it, and an action out of turn is refused rather than drawn. The
// screen then renders it with the table's own `Seat` and `HeroCards`, the way
// the session review does.
//
// Pure and deterministic, like the engine under it: the cards nobody specified
// come from a seeded shuffle, so a lesson deals the same table on every visit
// and a test can check every scene in it.

/** A lesson is dealt at a hundred big blinds, the depth the chart is written for. */
export const LESSON_BLINDS = { small: 10, big: 20 } as const
export const LESSON_STACK = 2_000

/** A standard open: two and a half big blinds. */
export const OPEN_TO = 50

/** One thing somebody does in a scene, in the order the table would do it. */
export interface SceneAction {
  seat: SeatId
  type: 'fold' | 'check' | 'call' | 'raise' | 'bet'
  /** Chips to make it, for a bet or a raise. */
  to?: number
}

export interface Scene {
  /** Where you sit this beat. */
  heroSeat: SeatId
  /** Your two cards, as the codec writes them: `['Jh', '9h']`. */
  hero: readonly [string, string]
  /** The flop, turn and river as far as the scene gets, in the order they come. */
  board?: readonly string[]
  /** What happens, from the first to act. Refused if out of turn. */
  actions?: readonly SceneAction[]
  /**
   * Other seats' cards, where the beat needs to know them: a hand Webb plays
   * face up, so a count of outs or a price can be settled against it. Every
   * seat not named here is dealt from the seeded deck, as before.
   */
  hands?: Partial<Record<SeatId, readonly [string, string]>>
  /** The blinds, when the beat is about their size. {@link LESSON_BLINDS} otherwise. */
  blinds?: { small: number; big: number }
  /** Stacks by seat, when the beat is about depth. {@link LESSON_STACK} otherwise. */
  stacks?: Partial<Record<SeatId, number>>
}

/**
 * The seat of the player at `index`, counting from you at 0 and going round the
 * table in the order the action goes. Index 0 is always you, which is how the
 * screen knows who sits at the foot of the felt.
 */
export function seatOfIndex(heroSeat: SeatId, index: number): SeatId {
  const offset = (seatById(heroSeat).offset + index) % SEATS_AT_A_TABLE
  const seat = SEAT_BY_OFFSET[offset]
  if (!seat) throw new Error(`No seat at offset ${offset}`)
  return seat
}

const SEAT_BY_OFFSET: Record<number, SeatId> = Object.fromEntries(
  (['btn', 'sb', 'bb', 'utg', 'mp', 'co'] as const).map((id) => [seatById(id).offset, id]),
)

/**
 * Deal a scene's opening state: six seats, the blinds posted, your cards and
 * the board where the scene put them, and everything else from a seeded deck.
 *
 * Player ids are seat ids, so a scene and a screen can talk about "the big
 * blind" without either keeping a map. You are `players[0]`.
 */
export function dealScene(scene: Scene, seed: number): HandState {
  const fixedHero = scene.hero.map(cardFromString)
  const fixedBoard = (scene.board ?? []).map(cardFromString)
  const fixedHands = Object.fromEntries(
    Object.entries(scene.hands ?? {}).map(([seat, hole]) => [
      seat,
      (hole ?? []).map(cardFromString),
    ]),
  ) as Partial<Record<SeatId, Card[]>>
  if (scene.hands?.[scene.heroSeat]) throw new Error('A scene names your cards twice')
  const named = [...fixedHero, ...fixedBoard, ...Object.values(fixedHands).flat()] as Card[]
  const fixed = new Set(named.map(cardToString))
  if (fixed.size !== named.length) {
    throw new Error('A scene deals the same card twice')
  }
  const rest = shuffledDeck(mulberry32(seed)).filter((card) => !fixed.has(cardToString(card)))

  // The engine deals one card to each seat in turn, twice, then the board, all
  // from the end of the deck. So the order things come off is written out here
  // and the deck is that order reversed on top of what is left.
  const holes: Card[][] = Array.from({ length: SEATS_AT_A_TABLE }, (_, i) =>
    i === 0
      ? fixedHero
      : (fixedHands[seatOfIndex(scene.heroSeat, i)] ?? [rest.pop() as Card, rest.pop() as Card]),
  )
  const board = [...fixedBoard]
  while (board.length < 5) board.push(rest.pop() as Card)
  const order = [...holes.map((hole) => hole[0]), ...holes.map((hole) => hole[1]), ...board]
  const deck = [...rest, ...order.reverse()]

  const heroOffset = seatById(scene.heroSeat).offset
  const seats = Array.from({ length: SEATS_AT_A_TABLE }, (_, i) => ({
    id: seatOfIndex(scene.heroSeat, i),
    name: i === 0 ? 'You' : seatById(seatOfIndex(scene.heroSeat, i)).name,
    stack: scene.stacks?.[seatOfIndex(scene.heroSeat, i)] ?? LESSON_STACK,
  }))
  const blinds = scene.blinds ?? LESSON_BLINDS

  return startHand({
    seats,
    buttonIndex: (SEATS_AT_A_TABLE - heroOffset) % SEATS_AT_A_TABLE,
    smallBlind: blinds.small,
    bigBlind: blinds.big,
    deck,
  })
}

/**
 * Play actions onto a state, refusing any that is out of turn. A scene that
 * says the button raised when it was the cutoff's turn is a lesson teaching the
 * wrong order, and that should fail a test rather than draw.
 */
export function playActions(state: HandState, actions: readonly SceneAction[]): HandState {
  let next = state
  for (const action of actions) {
    const actor = next.players[next.toActIndex]
    if (!actor || actor.id !== action.seat) {
      throw new Error(`It is not ${action.seat}'s turn (it is ${actor?.id ?? 'nobody'}'s)`)
    }
    const move: Action =
      action.type === 'raise' || action.type === 'bet'
        ? { type: action.type, amount: action.to }
        : { type: action.type }
    next = applyAction(next, move)
  }
  return next
}

/** A scene, dealt and played to where it stands. */
export function sceneState(scene: Scene, seed: number): HandState {
  return playActions(dealScene(scene, seed), scene.actions ?? [])
}

/** Everybody folds until it is `seat`'s turn: "it folds round to you". */
export function foldsTo(seat: SeatId): SceneAction[] {
  const order: SeatId[] = ['utg', 'mp', 'co', 'btn', 'sb', 'bb']
  return order.slice(0, order.indexOf(seat)).map((s) => ({ seat: s, type: 'fold' as const }))
}

/**
 * What `seat` did on the flop and the turn, read by playing the scene through:
 * a bet or a raise on a street is a bet, anything else a check. The line the
 * calling-the-river pack's range model narrows by (lib/drills/riverRange).
 *
 * The street each action lands on is the engine's, not the scene's say-so, and
 * it does not depend on the cards, so the replay deals from any seed.
 */
export function lineOf(
  scene: Scene,
  seat: SeatId,
): { flop: 'check' | 'bet'; turn: 'check' | 'bet' } {
  const line: { flop: 'check' | 'bet'; turn: 'check' | 'bet' } = { flop: 'check', turn: 'check' }
  let state = dealScene(scene, 1)
  for (const action of scene.actions ?? []) {
    const street = state.street
    if (
      action.seat === seat &&
      (action.type === 'bet' || action.type === 'raise') &&
      (street === 'flop' || street === 'turn')
    ) {
      line[street] = 'bet'
    }
    state = playActions(state, [action])
  }
  return line
}
