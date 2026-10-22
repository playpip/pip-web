// What each opponent might hold, as a weight on every one of the 1,326 two-card
// holdings: the `weightedRanges` experiment (`AiProfile.experiment`).
//
// The shipped AI reads an opponent as one number, a "selectivity" that deals
// them the best of a few random holdings (`aiSelectivity`, `estimateEquity`).
// One number can say "stronger than random" and nothing else. It cannot say
// that somebody who checked and called two streets has no big hand (a capped
// range), or that a river overbet is the nuts or nothing (a polarised one),
// and the bot-duel showed that ranking the candidates more exactly changed
// nothing measurable: the shape is the limit, not the sort.
//
// So this keeps a table instead, the way the Loki and Poki programs at Alberta
// described opponent modelling: start every holding at a weight that fits the
// seat's position and preflop action, and at each later action multiply it by
// how likely a player of this kind would have been to take that action with
// that holding. Holdings that act like the line survive; the rest fade to a
// floor (`FLOOR`), never to nothing, because people do surprising things.
//
// "How likely with that holding" is read off one strength number per holding
// per street, an effective hand strength: the share of random holdings it beats
// on that board (via `rankHoldem`, so 1,326 evaluations a street), raised by a
// fixed amount for a live flush or straight draw. That is the papers' HS + (1 -
// HS) * PPot with the potential approximated, because enumerating the next
// cards for every holding is far too slow to do in a browser on every decision.
//
// The likelihoods are smooth steps (`step`) around thresholds that move with
// what the table has seen this player do (`memory.ts`): how often they open,
// 3-bet, bet after the flop, fold to bets and c-bets, and go to showdown.
//
// Rebuilt from the hand's action log on every decision, so it needs no state of
// its own and cannot drift from the hand. Pure and deterministic; draws nothing
// from the rng.

import { OPENING } from '@/config/aiGates'
import type { Card } from '../cards'
import { CARD_AT, COMBO_A, COMBO_B, COMBOS, cardIndex, comboIndex, deadMask } from '../combos'
import type { ActionRecord, HandState, Player, Street } from '../engine'
import { preflopPercentile } from '../range'
import { CATEGORY, rankHoldem } from '../rank7'
import { lineOf } from './line'
import { ratesFor, type TableMemory, TYPICAL } from './memory'
import { openShare, reRaiseShare } from './preflopRanges'

/** No holding's weight falls below this, relative to the likeliest one. */
export const FLOOR = 0.01

/**
 * The second round of the experiment (`AiExperiment.rangeTuning`), each part
 * separately switchable so it can be measured on its own. All off is the
 * first round exactly.
 *
 * Against the scripted heroes of `pnpm exploit-sim` the first round paid a
 * player who bets the pot every time, because a full-pot bet multiplied the
 * range toward strong hands however often it came. The table's read of how
 * often somebody bets was capped at two and a half times typical and then
 * scaled down by skill, so a maniac's bets still read as strong, and a holding
 * that fell to the floor stayed there through every later bet.
 */
export interface RangeReads {
  /**
   * Let the read of postflop aggression reach five times typical instead of
   * two and a half, and keep every holding at `TUNED_FLOOR` rather than
   * `FLOOR`: a range that has been bet into is never quite empty.
   */
  wideReads?: boolean
  /**
   * Against somebody who bets or raises after the flop more than twice as
   * often as typical, flatten the likelihood of each of their bets toward 1 by
   * the power `1 / ratio`. A bet from a player who bets everything is not a
   * sign of strength. Read off the raw rate, not scaled by skill: a player who
   * bets every street is the one thing even the soft end of the ladder notices.
   *
   * The same goes for preflop raises, by the preflop raise rate. Flattening
   * only the bets after the flop still left a player who raises every hand
   * read as the top 45% at best, and the scripted maniac of `pnpm exploit-sim`
   * still won about 160 bb/100 more at The Main Event than against the
   * shipped AI; flattening the raises too took that to nothing measurable.
   */
  flattenManiacs?: boolean
  /**
   * Read a raise that puts the player all in before the flop by how often
   * this player goes all in (`memory.ts`), at least that wide, and keep it out
   * of `flattenManiacs`.
   *
   * The scripted shover of `pnpm exploit-sim`, all in with every decent hand,
   * won 83 to 130 bb/100 more against the ranged AI than against the shipped
   * one, from Friends' Garage to Downtown Casino. Its shoves were read two
   * wrong ways at once. As raises, they were read off a regular's opening
   * range by position, moved by skill, so an under-the-gun shove of the top
   * 45% read as about the top 29% at Downtown Casino; and as raises from
   * somebody who raises far more than typical they were flattened toward 1,
   * which spread the same shove over far worse hands. A shove is a count, like
   * a 3-bet: how often somebody does it says how wide it is.
   *
   * `decideAction` also plays the call as a call of a shove (see there).
   */
  shoveReads?: boolean
}

/** `FLOOR` under `RangeReads.wideReads`. */
export const TUNED_FLOOR = 0.03
/** How far above typical a postflop aggression read may go, first round and tuned. */
const AGGRESSION_CAP = 2.5
const TUNED_AGGRESSION_CAP = 5
/** Above this multiple of typical postflop aggression, `flattenManiacs` reads bets as flat. */
const MANIAC_RATIO = 2

/** Width of a likelihood step, in percentile (preflop) or strength (after) units. */
const PREFLOP_WIDTH = 0.03
const POSTFLOP_WIDTH = 0.07
/** Narrower, for telling the near-nuts from merely strong: both beat most random hands. */
const NUT_WIDTH = 0.025

/** A smooth step from 0 to 1 centred on `at`. */
function step(x: number, at: number, width: number): number {
  return 1 / (1 + Math.exp((at - x) / width))
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

// --- strength per holding ----------------------------------------------------

let preflopPct: Float64Array | null = null

/** Every holding's preflop percentile (`preflopPercentile`), built once. */
function preflopPercentiles(): Float64Array {
  if (!preflopPct) {
    preflopPct = new Float64Array(COMBOS)
    for (let c = 0; c < COMBOS; c++) {
      preflopPct[c] = preflopPercentile([CARD_AT[COMBO_A[c]], CARD_AT[COMBO_B[c]]])
    }
  }
  return preflopPct
}

/**
 * How much a live draw adds to a holding's strength, by street, approximating
 * the chance it improves by the river: four to a flush, four in a row, both.
 */
const POTENTIAL = {
  flop: { flush: 0.35, straight: 0.31, both: 0.5 },
  turn: { flush: 0.19, straight: 0.17, both: 0.32 },
} as const

const RANK_BIT = (card: number) => 1 << (card >> 2)
/** Four ranks in a row anywhere in a 13-bit mask (ace low included), as a mask of their low ends. */
function fours(mask: number): number {
  const m = (mask << 1) | (mask & (1 << 12) ? 1 : 0) // ace also plays below the deuce
  return m & (m << 1) & (m << 2) & (m << 3)
}

/** How many boards' strengths `boardStrengths` keeps: a hand has three, a few tables a few. */
const STRENGTH_CACHE = 8
const strengthCache = new Map<string, Float64Array>()

/**
 * Every holding's effective strength on one board, in [0, 1], or -1 where the
 * board holds one of its cards. Strength is the share of holdings it beats
 * (ties half), plus `(1 - strength) * potential` for a draw the hole cards are
 * part of.
 *
 * Kept for the last few boards, because every decision of a hand asks for the
 * same ones again: each opponent's range on every street so far, and on the
 * river `shareBeaten` too. It is 1,326 evaluations a board, and a pure function
 * of the board, so a kept table is the same answer. Shared, so read-only.
 */
export function boardStrengths(board: readonly Card[]): Float64Array {
  const key = board.map(cardIndex).join(',')
  let out = strengthCache.get(key)
  if (!out) {
    out = strengthsOn(board)
    strengthCache.set(key, out)
    // A Map iterates in insertion order, so the first key is the oldest.
    if (strengthCache.size > STRENGTH_CACHE)
      strengthCache.delete(strengthCache.keys().next().value!)
  }
  return out
}

function strengthsOn(board: readonly Card[]): Float64Array {
  const out = new Float64Array(COMBOS).fill(-1)
  const dead = deadMask(board)
  const ranks = new Float64Array(COMBOS)
  const live: number[] = []
  for (let c = 0; c < COMBOS; c++) {
    if (dead[COMBO_A[c]] || dead[COMBO_B[c]]) continue
    ranks[c] = rankHoldem([CARD_AT[COMBO_A[c]], CARD_AT[COMBO_B[c]]], board)
    live.push(c)
  }
  live.sort((x, y) => ranks[x] - ranks[y])
  for (let i = 0; i < live.length; ) {
    let j = i
    while (j < live.length && ranks[live[j]] === ranks[live[i]]) j++
    const pct = (i + (j - i) / 2) / live.length
    for (let k = i; k < j; k++) out[live[k]] = pct
    i = j
  }

  const potential = board.length === 3 ? POTENTIAL.flop : board.length === 4 ? POTENTIAL.turn : null
  if (!potential) return out
  const suitCount = new Uint8Array(4)
  let boardRanks = 0
  for (const card of board) {
    const i = cardIndex(card)
    suitCount[i & 3]++
    boardRanks |= RANK_BIT(i)
  }
  const boardFours = fours(boardRanks)
  for (const c of live) {
    // A straight or better has nothing left to draw to that matters here.
    if (Math.floor(ranks[c] / 0x100000) >= CATEGORY.straight) continue
    const a = COMBO_A[c]
    const b = COMBO_B[c]
    const sa = a & 3
    const sb = b & 3
    const flush =
      suitCount[sa] + 1 + (sb === sa ? 1 : 0) === 4 || (sb !== sa && suitCount[sb] + 1 === 4)
    const all = fours(boardRanks | RANK_BIT(a) | RANK_BIT(b))
    const straight = all !== 0 && all !== boardFours
    const pot =
      flush && straight
        ? potential.both
        : flush
          ? potential.flush
          : straight
            ? potential.straight
            : 0
    if (pot > 0) out[c] += (1 - out[c]) * pot
  }
  return out
}

/**
 * The share of all holdings a hand beats on a board (ties half), the same
 * yardstick a tracker uses to call a river bet a bluff: under one half, it
 * loses to most random hands.
 */
export function shareBeaten(hole: readonly Card[], board: readonly Card[]): number {
  return boardStrengths(board)[comboIndex(hole[0], hole[1])]
}

// --- the hand, replayed --------------------------------------------------------

/** One action off the log, with what a reader of it needs to know. */
interface Read {
  record: ActionRecord
  /** Bets and raises on this street before it. */
  raisesBefore: number
  /** Chips in the middle when it was taken: earlier streets plus this one so far. */
  potBefore: number
  /** The chips it put in (a bet or raise), or had to put in (a call). */
  chips: number
  /** Preflop: players still to act behind this one in a first-in spot. */
  behind: number
  /** The big blind's seat. */
  bigBlind: boolean
  /** The preflop raiser's first bet on the flop, or a call or fold of it. */
  cbet: boolean
  /** A check that closed the street: everybody else had checked already. */
  checkedBehind: boolean
  /** A check with the preflop raiser still to act on this street. */
  toRaiser: boolean
}

const BOARD_STREETS: Street[] = ['flop', 'turn', 'river']
const isAggressive = (a: ActionRecord) => a.type === 'bet' || a.type === 'raise'

/** Seats that were dealt in, in preflop order (first to act first). */
function preflopOrder(state: HandState): string[] {
  const n = state.players.length
  const dealt = (i: number) => state.players[i % n].status !== 'out'
  const next = (from: number) => {
    let i = (from + 1) % n
    while (!dealt(i)) i = (i + 1) % n
    return i
  }
  const count = state.players.filter((p) => p.status !== 'out').length
  const sb = count === 2 ? state.buttonIndex : next(state.buttonIndex)
  const bb = next(sb)
  const first = count === 2 ? sb : next(bb)
  const order: string[] = []
  for (let i = first, k = 0; k < count; k++, i = next(i)) order.push(state.players[i].id)
  return order
}

/** Walk the log once, keeping the pot and the betting so every action can be read. */
function replay(state: HandState): Read[] {
  const line = lineOf(state)
  const order = preflopOrder(state)
  const bbId = order.length === 2 ? order[1] : order[order.length - 1]
  const sbId = order.length === 2 ? order[0] : order[order.length - 2]
  const raiser = (() => {
    let who: string | null = null
    for (const a of line) if (a.street === 'preflop' && isAggressive(a)) who = a.playerId
    return who
  })()

  const reads: Read[] = []
  let potStart = 0
  let street: Street = 'preflop'
  // A blind is posted only as far as the stack goes, and a seat all in on its
  // blind never acts, so nothing later in the log would correct a full one.
  const posted = (id: string, blind: number) =>
    Math.min(blind, state.players.find((p) => p.id === id)?.committedThisHand ?? blind)
  let to = new Map<string, number>([
    [sbId, posted(sbId, state.smallBlind)],
    [bbId, posted(bbId, state.bigBlind)],
  ])
  let high = state.bigBlind
  let raises = 0
  let cbetOpen = false
  const actedPreflop = new Set<string>()
  const sum = () => [...to.values()].reduce((x, y) => x + y, 0)

  for (let i = 0; i < line.length; i++) {
    const a = line[i]
    if (a.street !== street) {
      potStart += sum()
      to = new Map()
      high = 0
      raises = 0
      street = a.street
      cbetOpen = false
    }
    const before = to.get(a.playerId) ?? 0
    const potBefore = potStart + sum()
    // `a.to` is what the action actually put in, so an all-in call for less
    // is read at its own price rather than the full bet's.
    const chips = isAggressive(a) || a.type === 'call' ? a.to - before : 0
    let behind = 0
    if (street === 'preflop' && !actedPreflop.has(a.playerId)) {
      behind = order.length - 1 - order.indexOf(a.playerId)
    }
    actedPreflop.add(a.playerId)
    const cbet =
      street === 'flop' &&
      ((isAggressive(a) && raises === 0 && a.playerId === raiser) ||
        (cbetOpen && raises === 1 && !isAggressive(a)))
    const nextOnStreet = line[i + 1]
    const checkedBehind =
      a.type === 'check' &&
      street !== 'preflop' &&
      (nextOnStreet ? nextOnStreet.street !== street : state.street !== street) &&
      line.filter((x) => x.street === street && x !== a && x.type !== 'check').length === 0

    const toRaiser =
      a.type === 'check' &&
      street !== 'preflop' &&
      raiser !== null &&
      raiser !== a.playerId &&
      // A raiser who has folded is not still to act, so a check is no trap.
      !line.some(
        (x, j) => j < i && x.playerId === raiser && (x.street === street || x.type === 'fold'),
      )
    reads.push({
      record: a,
      raisesBefore: raises,
      potBefore,
      chips: Math.max(0, chips),
      behind,
      bigBlind: a.playerId === bbId,
      cbet,
      checkedBehind,
      toRaiser,
    })

    if (isAggressive(a)) {
      if (street === 'flop' && raises === 0 && a.playerId === raiser) cbetOpen = true
      raises++
      high = Math.max(high, a.to)
    }
    to.set(a.playerId, Math.max(before, a.to))
  }
  return reads
}

// --- how likely each holding was to take each action -------------------------

/** What the table's reads say about this player, each a multiple of typical, scaled by skill. */
function tendencies(
  memory: TableMemory | undefined,
  id: string,
  skill: number,
  tuning: RangeReads,
) {
  const r = ratesFor(memory, id)
  const read = (rate: number, typical: number, lo: number, hi: number) =>
    clamp(1 + (rate / typical - 1) * skill, lo, hi)
  return {
    opens: read(r.preflopRaise, TYPICAL.preflopRaise, 0.4, 3),
    threeBets: read(r.threeBet, TYPICAL.threeBet, 0.4, 4),
    aggression: read(
      r.postflopAggression,
      TYPICAL.postflopAggression,
      0.4,
      tuning.wideReads ? TUNED_AGGRESSION_CAP : AGGRESSION_CAP,
    ),
    // Stickiness: above 1 for somebody who folds less than most, so calls mean less.
    sticky: read(TYPICAL.foldToBet, r.foldToBet, 0.5, 2.5),
    stickyCbet: read(TYPICAL.foldToCbet, r.foldToCbet, 0.5, 2.5),
    showdowns: read(r.wtsd, TYPICAL.wtsd, 0.6, 1.8),
    /**
     * The power each postflop bet's likelihood is raised to: 1, or `1 / ratio`
     * for somebody who bets more than `MANIAC_RATIO` times as often as typical.
     */
    betFlatten:
      tuning.flattenManiacs && r.postflopAggression / TYPICAL.postflopAggression > MANIAC_RATIO
        ? TYPICAL.postflopAggression / r.postflopAggression
        : 1,
    /** The same for preflop raises, by the preflop raise rate. */
    raiseFlatten:
      tuning.flattenManiacs && r.preflopRaise / TYPICAL.preflopRaise > MANIAC_RATIO
        ? TYPICAL.preflopRaise / r.preflopRaise
        : 1,
  }
}

type Tendencies = ReturnType<typeof tendencies>

/**
 * Preflop: a likelihood per holding from its percentile `p`. `reRaise`, when
 * given, is the share of hands a re-raise at each level is read as, from the
 * same percentile ranges the AI re-raises from (`threeBetReads`). `shove`,
 * when given, is the share of hands this player goes all in with, and an all
 * in is read at least that wide (`RangeReads.shoveReads`).
 */
function preflopLikelihood(
  read: Read,
  t: Tendencies,
  reRaise?: (level: number) => number,
  shove?: number,
): (p: number) => number {
  const w = PREFLOP_WIDTH
  const type = read.record.type
  const threeBetShare = reRaise ? reRaise(2) : clamp(TYPICAL.threeBet * t.threeBets, 0.02, 0.4)
  if (isAggressive(read.record)) {
    let share: number
    if (read.raisesBefore === 0) {
      const byBehind = OPENING.shareByBehind
      share = clamp(byBehind[Math.min(read.behind, byBehind.length - 1)] * t.opens, 0.05, 0.95)
    } else {
      share = reRaise
        ? reRaise(read.raisesBefore + 1)
        : read.raisesBefore === 1
          ? threeBetShare
          : clamp(0.035 * t.threeBets, 0.01, 0.2)
    }
    if (shove !== undefined) share = Math.max(share, shove)
    return (p) => step(p, 1 - share, w)
  }
  if (type === 'call') {
    if (read.raisesBefore === 0) {
      // A limp: most strong hands would have raised.
      return (p) => 0.15 + 0.85 * step(p, 0.3, w) * (1 - 0.7 * step(p, 0.8, w))
    }
    if (read.raisesBefore === 1) {
      const defend = read.bigBlind ? 0.45 : 0.2
      return (p) => step(p, 1 - defend, w) * (1 - 0.7 * step(p, 1 - threeBetShare, w))
    }
    return (p) => step(p, 0.9, w) * (1 - 0.6 * step(p, 0.965, w))
  }
  if (type === 'check') return (p) => 1 - 0.6 * step(p, 0.85, w)
  return () => 1
}

/**
 * Where a hand is strong enough that this player would usually raise it rather
 * than call, or lead it rather than check to the raiser: well above top pair,
 * which already beats nine random holdings in ten.
 */
const nutsAt = (t: Tendencies) => clamp(0.94 - 0.05 * (t.aggression - 1), 0.85, 0.98)

/** After the flop: a likelihood per holding from its effective strength `e`. */
function postflopLikelihood(read: Read, t: Tendencies, river: boolean): (e: number) => number {
  const w = POSTFLOP_WIDTH
  const type = read.record.type
  const ratio = read.chips / Math.max(read.potBefore, 1)
  // The value line moves with size and with how freely this player bets.
  const valueAt = (r: number, cbet: boolean) =>
    clamp(0.66 + 0.13 * Math.min(r, 2) - 0.12 * (t.aggression - 1) - (cbet ? 0.14 : 0), 0.3, 0.95)
  if (isAggressive(read.record)) {
    const facing = read.raisesBefore > 0
    const at = clamp(valueAt(ratio, read.cbet) + (facing ? 0.12 : 0), 0.3, 0.95)
    // Big bets are polarised: what is not value is air, not a middling hand.
    const polar = Math.max(clamp((ratio - 0.5) / 0.5, 0, 1) * (river ? 1 : 0.5), facing ? 0.6 : 0)
    const bluffs = clamp(
      (read.cbet ? 0.3 : facing ? 0.05 : 0.12) * t.aggression * (1 + 0.5 * polar),
      0.02,
      0.7,
    )
    return (e) => {
      const value = step(e, at, w)
      const air = 1 - polar * step(e, 0.4, w)
      return value + bluffs * (1 - value) * air
    }
  }
  if (type === 'call') {
    const price = read.chips / Math.max(read.potBefore + read.chips, 1)
    const sticky = read.cbet ? t.stickyCbet : t.sticky
    const laterStreet = river || read.record.street === 'turn' ? Math.sqrt(t.showdowns) : 1
    const at = clamp(0.25 + 0.9 * price - 0.15 * (sticky * laterStreet - 1), 0.05, 0.85)
    const nuts = nutsAt(t)
    return (e) => step(e, at, w) * (1 - 0.5 * step(e, nuts, NUT_WIDTH))
  }
  if (type === 'check') {
    // Checking caps a range, because most strong hands bet. Checking to the
    // preflop raiser caps it least, since that is where strong hands check too,
    // and checking behind caps it hardest: nobody is left to raise.
    if (read.checkedBehind) return (e) => 1 - 0.8 * step(e, valueAt(0.6, false), w)
    if (read.toRaiser) {
      const nuts = nutsAt(t)
      return (e) => 1 - 0.4 * step(e, nuts, NUT_WIDTH)
    }
    return (e) => 1 - 0.55 * step(e, valueAt(0.6, false), w)
  }
  return () => 1
}

// --- the ranges --------------------------------------------------------------

/**
 * Every live opponent's range at this decision, one `Float64Array` of 1,326
 * weights each (combo order from `combos.ts`), with the decider's own cards and
 * the board at weight 0. Ready for `estimateEquity`'s `opponentRanges`.
 *
 * `skill` scales how far the table's reads move the thresholds, as it does the
 * shipped AI's `credibility`: the soft end of the ladder barely adjusts.
 * `tuning` turns on the second round's parts (`RangeReads`); none is round one.
 * `percentileReRaises` reads preflop re-raises off `reRaiseShare`, the
 * percentile ranges of the `preflopRanges` experiment (`threeBetReads`).
 */
export function opponentRanges(
  state: HandState,
  self: Player,
  opponents: readonly Player[],
  memory: TableMemory | undefined,
  skill: number,
  tuning: RangeReads = {},
  percentileReRaises = false,
): Float64Array[] {
  const reads = replay(state)
  const pct = preflopPercentiles()
  const strengthOn = (street: Street) =>
    boardStrengths(state.community.slice(0, street === 'flop' ? 3 : street === 'turn' ? 4 : 5))
  const dead = deadMask([...self.hole, ...state.community])
  const floor = tuning.wideReads ? TUNED_FLOOR : FLOOR
  const open = percentileReRaises ? openShare(state) : 0

  return opponents.map((opp) => {
    const weights = new Float64Array(COMBOS)
    for (let c = 0; c < COMBOS; c++) weights[c] = dead[COMBO_A[c]] || dead[COMBO_B[c]] ? 0 : 1
    const t = tendencies(memory, opp.id, skill, tuning)
    const reRaise = percentileReRaises
      ? (level: number) => reRaiseShare(level, open, memory, opp.id)
      : undefined
    // A player all in made their last action with their last chips.
    let shove: Read | undefined
    if (tuning.shoveReads && opp.status === 'allin') {
      for (const read of reads) if (read.record.playerId === opp.id) shove = read
    }
    for (const read of reads) {
      if (read.record.playerId !== opp.id || read.record.type === 'fold') continue
      const street = read.record.street
      if (street === 'preflop') {
        const like = preflopLikelihood(
          read,
          t,
          reRaise,
          read === shove ? ratesFor(memory, opp.id).shove : undefined,
        )
        const flatten = isAggressive(read.record) && read !== shove ? t.raiseFlatten : 1
        if (flatten === 1) {
          for (let c = 0; c < COMBOS; c++) if (weights[c] > 0) weights[c] *= like(pct[c])
        } else {
          for (let c = 0; c < COMBOS; c++) if (weights[c] > 0) weights[c] *= like(pct[c]) ** flatten
        }
      } else if (BOARD_STREETS.includes(street) && state.community.length >= 3) {
        const like = postflopLikelihood(read, t, street === 'river')
        const e = strengthOn(street)
        const flatten = isAggressive(read.record) ? t.betFlatten : 1
        if (flatten === 1) {
          for (let c = 0; c < COMBOS; c++) if (weights[c] > 0) weights[c] *= like(e[c])
        } else {
          for (let c = 0; c < COMBOS; c++) if (weights[c] > 0) weights[c] *= like(e[c]) ** flatten
        }
      }
      floorWeights(weights, floor)
    }
    return weights
  })
}

/** Rescale so the likeliest holding is 1, then lift every live one to `floor`. */
function floorWeights(weights: Float64Array, floor: number): void {
  let max = 0
  for (let c = 0; c < COMBOS; c++) if (weights[c] > max) max = weights[c]
  if (max <= 0) return
  for (let c = 0; c < COMBOS; c++) {
    if (weights[c] > 0) weights[c] = Math.max(floor, weights[c] / max)
  }
}
