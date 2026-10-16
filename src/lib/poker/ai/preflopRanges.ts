// Ranges for re-raises before the flop, under the `preflopRanges` experiment.
//
// The shipped AI reads a raiser through `aiSelectivity`: the best of a handful
// of random holdings, at most five extra, which is about the top fifth of hands
// however many raises came before. A real 3-bet range is a few percent of
// hands, so an opener's hand always had the equity to call one, and at The
// Main Event the opener folded to a 3-bet 4 times in 3,450 (`pnpm bot-duel`).
// Here a raise is read as a percentile range instead: the opener's by where it
// opened from, each re-raise a slice of the range it answers (Loki/Poki's
// "re-weight by the action" idea, reduced to one number per level).

import { OPENING, PREFLOP_RANGES } from '@/config/aiGates'
import type { HandState } from '../engine'
import { lineOf } from './line'
import { credibility, ratesFor, type TableMemory, TYPICAL } from './memory'

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

/** The preflop raises so far, in order: who made each and what it was to. */
export function preflopRaises(state: HandState): { playerId: string; to: number }[] {
  return lineOf(state)
    .filter((a) => a.street === 'preflop' && a.type === 'raise')
    .map((a) => ({ playerId: a.playerId, to: a.to }))
}

/**
 * The share of hands a regular opens from where this hand was opened, read
 * off how many players were still to act behind the open. `OPENING`'s base
 * shares, not the AI's own tightened ones: an opener can be anybody.
 */
export function openShare(state: HandState): number {
  const preflop = lineOf(state).filter((a) => a.street === 'preflop')
  const open = preflop.findIndex((a) => a.type === 'raise')
  if (open < 0) return OPENING.shareByBehind[0]
  // Everybody dealt in who gets a turn: a blind all in from posting never acts,
  // so it is nobody the open has to get through.
  const acted = new Set(preflop.map((a) => a.playerId))
  const acting = state.players.filter(
    (p) => p.status !== 'out' && !(p.status === 'allin' && !acted.has(p.id)),
  ).length
  const behind = Math.max(1, acting - (open + 1))
  const shares = OPENING.shareByBehind
  return shares[Math.min(behind, shares.length - 1)]
}

/**
 * The range a raise at `level` represents (1 the open, 2 the 3-bet, 3 the
 * 4-bet...), as a share of all starting hands.
 */
export function levelShare(level: number, open: number): number {
  if (level <= 1) return open
  const threeBet = clamp(
    open * PREFLOP_RANGES.threeBetOfOpen + PREFLOP_RANGES.threeBetFloor,
    PREFLOP_RANGES.floor,
    PREFLOP_RANGES.threeBetMax,
  )
  let share = threeBet
  for (let l = 3; l <= level; l++) share *= PREFLOP_RANGES.fourBetOf3Bet
  return Math.max(share, PREFLOP_RANGES.floor)
}

/**
 * A re-raise at `level` (2 the 3-bet, 3 the 4-bet...) from this player, read
 * by how often they actually re-raise (`threeBetReads`): the range the AI
 * would re-raise with itself, `levelShare`, scaled by the player's 3-bet rate
 * over a typical player's (`memory.ts`), no wider than `PREFLOP_RANGES.widest`.
 *
 * Reading opponents and choosing the AI's own re-raises off one table was the
 * trouble with pf3: an opponent was assumed to 3-bet as narrowly as the AI
 * does, and only `credibility`, a read of every preflop raise scaled down by
 * skill, could widen it. Against a table that 3-bets 13% of the time that
 * barely moved, and the opener folded to it too often. The rate is shrunk
 * toward typical by the memory's prior, so a few hands never swing it, and it
 * is not scaled by skill: how often somebody re-raises is a count, not a feel.
 */
export function reRaiseShare(
  level: number,
  open: number,
  memory: TableMemory | undefined,
  id: string,
): number {
  const scale = ratesFor(memory, id).threeBet / TYPICAL.threeBet
  return clamp(levelShare(level, open) * scale, PREFLOP_RANGES.floor, PREFLOP_RANGES.widest)
}

/**
 * Each opponent's range as a top share of hands, by the highest raise they
 * made or called. Undefined for one who has only posted a blind or limped: the
 * selectivity read stands for them. A raise from somebody the table has seen
 * raise everything is read wider, by as much as their raises have meant less
 * (`credibility`), and that read moves with skill as `aiSelectivity`'s does.
 * With `byRate` (`threeBetReads`) a re-raise the player made is read by
 * `reRaiseShare` instead, and the levels come off the action log.
 */
export function opponentShares(
  state: HandState,
  opponents: HandState['players'],
  memory: TableMemory | undefined,
  skill: number,
  byRate = false,
): (number | undefined)[] {
  const raises = preflopRaises(state)
  const open = openShare(state)
  const levels = byRate ? levelsOf(state) : null
  return opponents.map((opp) => {
    const known = levels?.get(opp.id)
    let level = known?.level ?? 0
    const made = known?.made ?? 0
    if (!levels) {
      for (let i = 0; i < raises.length; i++) {
        if (opp.committedThisStreet >= raises[i].to) level = i + 1
      }
    }
    if (level === 0) return undefined
    // Their own 3-bet rate says how wide their re-raises are, not their calls.
    if (levels && level >= 2 && made === level) return reRaiseShare(level, open, memory, opp.id)
    const read = 1 + (credibility(memory, opp.id, true) - 1) * skill
    return clamp(levelShare(level, open) / read, PREFLOP_RANGES.floor, PREFLOP_RANGES.widest)
  })
}

/**
 * Each player's highest preflop raise level so far, made or called (`level`),
 * and the highest they made themselves (`made`), off the action log. Read from
 * the log rather than from chips committed, so a call all in for less than the
 * raise still counts as calling it.
 */
function levelsOf(state: HandState): Map<string, { level: number; made: number }> {
  const out = new Map<string, { level: number; made: number }>()
  let raises = 0
  for (const a of lineOf(state)) {
    if (a.street !== 'preflop') continue
    const seen = out.get(a.playerId) ?? { level: 0, made: 0 }
    if (a.type === 'raise') {
      raises++
      out.set(a.playerId, { level: raises, made: raises })
    } else if (a.type === 'call' && raises > 0) {
      out.set(a.playerId, { level: Math.max(seen.level, raises), made: seen.made })
    }
  }
  return out
}

/**
 * Under `threeBetReads`, how many times wider than `levelShare` the AI's own
 * next raise is: never narrower, and as much wider as the last raise is read
 * wider than the table's ranges. Each raise is a slice of the range it answers,
 * and against somebody who re-raises half their hands that range is half the
 * deck. Kept to the table's ranges, the AI 4-bet only the top two or three
 * percent there and called the rest, out of position against a player who
 * then bets every street: the scripted aggressive hero of `pnpm exploit-sim`
 * won 330 bb/100 more against it than against the shipped AI, which 4-bets
 * the top sixth of hands whoever raised.
 */
export function answerScale(
  state: HandState,
  memory: TableMemory | undefined,
  skill: number,
): number {
  const raises = preflopRaises(state)
  const last = raises[raises.length - 1]
  const raiser = last && state.players.find((p) => p.id === last.playerId)
  if (!raiser) return 1
  const read = opponentShares(state, [raiser], memory, skill, true)[0]
  const table = levelShare(raises.length, openShare(state))
  return read ? Math.max(1, read / table) : 1
}
