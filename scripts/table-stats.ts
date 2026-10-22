// What a player tracker would say about each seat, counted hand by hand.
//
// `pnpm ai-stats` counts the same kind of thing for a whole table at once, which
// answers "how does this rung play". This answers it per seat, so two policies
// sharing a table (`pnpm bot-duel`) or two characters sharing one
// (`pnpm persona-stats`) can be told apart, and it counts a few things the
// table view does not need: how often a seat bets a pot it is last to act in,
// how much of its river betting is a bluff, and how big its bets are.
//
// Every counter is a plain `{ hits, chances }` pair, so a tally from one worker
// adds onto another's field by field.

import type { Card } from '@/lib/poker/cards'
import { RANKS, SUITS } from '@/lib/poker/cards'
import { type Action, type HandState, potSize } from '@/lib/poker/engine'
import { determineWinners } from '@/lib/poker/handEval'

export interface Tally {
  hits: number
  chances: number
}

/** A running sum, for averages and their spread. */
export interface Moments {
  n: number
  sum: number
  sumSq: number
}

export const STAT_KEYS = [
  'vpip',
  'pfr',
  'threeBet',
  'foldToThreeBet',
  'bbFoldToSteal',
  'cbetFlop',
  'foldToCbet',
  'barrelTurn',
  'checkRaiseFlop',
  'stabInPosition',
  'foldToBet',
  'postflopAggression',
  'wtsd',
  'wonAtShowdown',
  'riverBluff',
] as const
export type StatKey = (typeof STAT_KEYS)[number]

export const STAT_LABEL: Record<StatKey, string> = {
  vpip: 'enters the pot (VPIP)',
  pfr: 'raises preflop (PFR)',
  threeBet: 're-raises an open (3-bet)',
  foldToThreeBet: 'opener folds to a 3-bet',
  bbFoldToSteal: 'big blind folds to a steal',
  cbetFlop: 'raiser bets the flop (c-bet)',
  foldToCbet: 'folds to a c-bet',
  barrelTurn: 'bets the turn again',
  // Against the preflop raiser's bet only, as `pnpm ai-stats` counts it, so the
  // two print the same rate beside the same reference band.
  checkRaiseFlop: 'check-raises a flop c-bet',
  stabInPosition: 'bets a checked pot, last to act',
  foldToBet: 'folds to any postflop bet',
  postflopAggression: 'bets/raises per postflop action',
  wtsd: 'sees showdown (of flops seen)',
  wonAtShowdown: 'wins at showdown',
  riverBluff: 'river bets that are bluffs',
}

export interface SeatStats {
  hands: number
  /** Net chips over every hand, in big blinds. */
  netBb: number
  stat: Record<StatKey, Tally>
  /** First-in raises, indexed by how many players were still to act behind. */
  openByBehind: Tally[]
  /** Postflop bet and raise sizes as a fraction of the pot, all-ins excluded. */
  betSize: Moments
  /** Preflop open sizes, in big blinds. */
  openSize: Moments
}

const tally = (): Tally => ({ hits: 0, chances: 0 })
const moments = (): Moments => ({ n: 0, sum: 0, sumSq: 0 })

export function emptySeatStats(): SeatStats {
  return {
    hands: 0,
    netBb: 0,
    stat: Object.fromEntries(STAT_KEYS.map((k) => [k, tally()])) as Record<StatKey, Tally>,
    openByBehind: [],
    betSize: moments(),
    openSize: moments(),
  }
}

function addTally(a: Tally, b: Tally): Tally {
  return { hits: a.hits + b.hits, chances: a.chances + b.chances }
}

function addMoments(a: Moments, b: Moments): Moments {
  return { n: a.n + b.n, sum: a.sum + b.sum, sumSq: a.sumSq + b.sumSq }
}

export function addSeatStats(a: SeatStats, b: SeatStats): SeatStats {
  const width = Math.max(a.openByBehind.length, b.openByBehind.length)
  return {
    hands: a.hands + b.hands,
    netBb: a.netBb + b.netBb,
    stat: Object.fromEntries(STAT_KEYS.map((k) => [k, addTally(a.stat[k], b.stat[k])])) as Record<
      StatKey,
      Tally
    >,
    openByBehind: Array.from({ length: width }, (_, i) =>
      addTally(a.openByBehind[i] ?? tally(), b.openByBehind[i] ?? tally()),
    ),
    betSize: addMoments(a.betSize, b.betSize),
    openSize: addMoments(a.openSize, b.openSize),
  }
}

/** A rate as a share, or null when there was never a chance to show it. */
export function rate(t: Tally): number | null {
  return t.chances > 0 ? t.hits / t.chances : null
}

function bump(t: Tally, hit: boolean) {
  t.chances++
  if (hit) t.hits++
}

/**
 * Whether a seat won chips at showdown from somebody else. A pot only that seat
 * could win is its own uncalled bet coming back (a big stack's shove called by a
 * short one), so it is not a win, however the hand went.
 */
function wonContested(state: HandState, id: string): boolean {
  const own = state.pots
    .filter((pot) => pot.eligible.length === 1 && pot.eligible[0] === id)
    .reduce((sum, pot) => sum + pot.amount, 0)
  return (state.result?.payouts[id] ?? 0) > own
}

function record(m: Moments, x: number) {
  m.n++
  m.sum += x
  m.sumSq += x * x
}

const aggressive = (a: Action) => a.type === 'bet' || a.type === 'raise'

const FULL_DECK: Card[] = RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })))
const key = (c: Card) => `${c.rank}${c.suit}`

/**
 * Whether a river hand is a bluff: it beats fewer than half of the hands an
 * opponent could hold, counted exactly over every two cards left. That is the
 * standard a bettor is held to, since a bet with a hand that wins against most
 * holdings is value however it turns out.
 */
export function isRiverBluff(hole: readonly Card[], board: readonly Card[]): boolean {
  const used = new Set([...hole, ...board].map(key))
  const rest = FULL_DECK.filter((c) => !used.has(key(c)))
  let share = 0
  let n = 0
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      const { winners } = determineWinners(
        [
          { id: 'me', hole },
          { id: 'them', hole: [rest[i], rest[j]] },
        ],
        board,
      )
      if (winners.includes('me')) share += 1 / winners.length
      n++
    }
  }
  return share / n < 0.5
}

/**
 * Follows one hand action by action. Call `observe` with the state *before*
 * each action is applied, then `finish` with the completed hand; it adds into
 * the `SeatStats` that `statsFor` hands it for each seat id (return null to
 * skip a seat). Hold'em only: the bluff read is a Hold'em showdown.
 */
export function createHandTracker(statsFor: (id: string) => SeatStats | null) {
  let street: HandState['street'] = 'preflop'
  let streetBets = 0
  let preflopRaises = 0
  let preflopAggressor: string | null = null
  let opener: string | null = null
  let anyoneIn = false
  let flopCbetBy: string | null = null
  const flopCbetCalledBy = new Set<string>()
  const checkedThisStreet = new Set<string>()
  const sawFlop = new Set<string>()
  const vpip = new Set<string>()
  const pfr = new Set<string>()
  let bbId: string | null = null
  let started = false

  return {
    observe(state: HandState, action: Action) {
      const n = state.players.length
      if (!started) {
        started = true
        const dealt = state.players.filter((p) => p.status !== 'out').length
        // The big blind sits two seats after the button, or one heads-up, among
        // dealt-in players; seat ids carry it through the hand.
        const order: string[] = []
        for (let i = 1; i <= n; i++) {
          const p = state.players[(state.buttonIndex + i) % n]
          if (p.status !== 'out') order.push(p.id)
        }
        bbId = dealt === 2 ? order[0] : (order[1] ?? null)
      }
      if (state.street !== street) {
        street = state.street
        streetBets = 0
        checkedThisStreet.clear()
        // Seeing a flop means being there to bet it, as `observeHandEnd` reads
        // it: not a seat all in before it, and not a board run out to nobody.
        if (street === 'flop') {
          for (const p of state.players) if (p.status === 'active') sawFlop.add(p.id)
        }
      }
      const me = state.players[state.toActIndex]
      const s = statsFor(me.id)
      const facing = state.currentBet > me.committedThisStreet
      const bb = Math.max(state.bigBlind, 1)
      const pot = potSize(state)

      if (state.street === 'preflop') {
        if (action.type === 'call' || aggressive(action)) vpip.add(me.id)
        if (aggressive(action)) pfr.add(me.id)
        if (s && !anyoneIn && preflopRaises === 0) {
          const behind = state.players.filter(
            (p) => p.id !== me.id && p.status === 'active' && !p.hasActed,
          ).length
          s.openByBehind[behind] ??= tally()
          bump(s.openByBehind[behind], aggressive(action))
          if (aggressive(action) && action.amount !== undefined)
            record(s.openSize, action.amount / bb)
        }
        if (s && preflopRaises === 1 && facing) bump(s.stat.threeBet, aggressive(action))
        if (s && preflopRaises === 2 && facing && me.id === opener)
          bump(s.stat.foldToThreeBet, action.type === 'fold')
        if (s && me.id === bbId && preflopRaises === 1 && facing) {
          const nobodyIn = state.players.every(
            (p) => p.id === me.id || p.id === preflopAggressor || p.status === 'folded',
          )
          if (nobodyIn) bump(s.stat.bbFoldToSteal, action.type === 'fold')
        }
        if (action.type === 'call' || aggressive(action)) anyoneIn = true
        if (aggressive(action)) {
          preflopRaises++
          preflopAggressor = me.id
          opener ??= me.id
        }
        return
      }

      if (s) {
        bump(s.stat.postflopAggression, aggressive(action))
        if (facing) bump(s.stat.foldToBet, action.type === 'fold')
        // Last to act in a pot nobody has bet: every other live seat that can
        // still act has already checked to it.
        const lastToAct =
          !facing &&
          streetBets === 0 &&
          state.players.every(
            (p) => p.id === me.id || p.status !== 'active' || checkedThisStreet.has(p.id),
          )
        if (lastToAct) bump(s.stat.stabInPosition, aggressive(action))
        if (
          aggressive(action) &&
          action.amount !== undefined &&
          action.amount < me.stack + me.committedThisStreet
        ) {
          const toCall = state.currentBet - me.committedThisStreet
          const added = action.amount - state.currentBet
          record(s.betSize, added / Math.max(pot + toCall, bb))
        }
        if (state.street === 'river' && aggressive(action)) {
          bump(s.stat.riverBluff, isRiverBluff(me.hole, state.community))
        }
      }

      if (state.street === 'flop') {
        if (s && me.id === preflopAggressor && streetBets === 0)
          bump(s.stat.cbetFlop, aggressive(action))
        if (flopCbetBy && streetBets === 1 && facing && me.id !== flopCbetBy) {
          if (s) bump(s.stat.foldToCbet, action.type === 'fold')
          if (action.type === 'call') flopCbetCalledBy.add(me.id)
          if (s && checkedThisStreet.has(me.id)) bump(s.stat.checkRaiseFlop, aggressive(action))
        }
        if (me.id === preflopAggressor && streetBets === 0 && aggressive(action)) flopCbetBy = me.id
      }
      if (
        s &&
        state.street === 'turn' &&
        flopCbetBy === me.id &&
        streetBets === 0 &&
        flopCbetCalledBy.size > 0
      ) {
        bump(s.stat.barrelTurn, aggressive(action))
      }
      if (action.type === 'check') checkedThisStreet.add(me.id)
      if (aggressive(action)) streetBets++
    },

    /** `startStacks` is each seat's stack before the blinds went in. */
    finish(state: HandState, startStacks: Record<string, number>) {
      const bb = Math.max(state.bigBlind, 1)
      const showdown = !!state.result?.showdown
      for (const p of state.players) {
        if (p.status === 'out') continue
        const s = statsFor(p.id)
        if (!s) continue
        s.hands++
        s.netBb += (p.stack - (startStacks[p.id] ?? p.stack)) / bb
        bump(s.stat.vpip, vpip.has(p.id))
        bump(s.stat.pfr, pfr.has(p.id))
        const reached = showdown && p.status !== 'folded'
        if (sawFlop.has(p.id)) bump(s.stat.wtsd, reached)
        // Every showdown is won or lost, a board run out to all-ins included.
        if (reached) bump(s.stat.wonAtShowdown, wonContested(state, p.id))
      }
    },
  }
}
