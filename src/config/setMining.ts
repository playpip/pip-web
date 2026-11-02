import { blindsAt } from './blinds'
import { FLOPS, FLOPS_WITH_YOUR_RANK } from './flopSet'
import { DEEP_STACK_TABLES, deepStackTwin, type Venue } from './venues'

// The figures in /blog/deep-stack-set-mining. Nothing here is typed in: the
// odds come from config/flopSet (the same 2,304 of 19,600 the set guide
// prints) and the hand counts come from each table's own stack and blind
// clock, through the same `blindsAt` the engine posts blinds with. A change to
// either moves the post with it, and tests/setMining.test.ts recounts both.

/** The raise the post prices a call against, in big blinds. A common open, not one Pip's players are known to make. */
export const SET_MINE_RAISE_BB = 3

/** Flops that miss for every flop that brings your rank: 17,296 to 2,304. */
export const MISSES_PER_HIT = (FLOPS - FLOPS_WITH_YOUR_RANK) / FLOPS_WITH_YOUR_RANK

/**
 * The fewest big blinds both players need for the call to break even: the call
 * itself, plus what the hits have to win back for every miss. A floor, because
 * it assumes every set wins and gets paid in full.
 */
export const SET_MINE_STACK_BB = SET_MINE_RAISE_BB * (1 + MISSES_PER_HIT)

export interface SetMineRow {
  table: Venue
  /** Chips you sit down with. */
  stack: number
  /** That stack in the opening big blinds. */
  startBigBlinds: number
  /** Hands dealt before the starting stack is under `SET_MINE_STACK_BB`. */
  hands: number
}

/** How many hands a table deals before its starting stack stops covering the call. */
export function setMineRow(table: Venue): SetMineRow {
  const stack = table.startingStack ?? table.buyIn
  let hands = 0
  while (stack / blindsAt(table, hands).bigBlind >= SET_MINE_STACK_BB) hands++
  return { table, stack, startBigBlinds: stack / table.bigBlind, hands }
}

/** Each Deep Stack price beside the ladder table at the same buy-in. */
export const SET_MINE_TABLES = DEEP_STACK_TABLES.map((deep) => ({
  deep: setMineRow(deep),
  ladder: setMineRow(deepStackTwin(deep)!),
}))
