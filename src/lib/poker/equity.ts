// Monte-Carlo equity: how often does a hand win at showdown against N random
// opponents, given the current board? Fast enough (~1–2k sims) to run inline
// for both AI decisions and the human's ambient "win %" readout.

import type { Card, Rank, Rng, Suit } from './cards'
import { RANKS, SUITS } from './cards'
import { determineWinners } from './handEval'

export interface EquityResult {
  /** Fraction of run-outs the hand wins outright. */
  win: number
  /** Fraction tied (chop). */
  tie: number
  /** Expected share of the pot: win + tie split. In [0, 1]. */
  equity: number
  iterations: number
}

export interface EquityOptions {
  hole: readonly Card[]
  community?: readonly Card[]
  opponents: number
  iterations?: number
  rng?: Rng
}

function cardKey(c: Card): string {
  return `${c.rank}${c.suit}`
}

function remainingDeck(known: readonly Card[]): Card[] {
  const used = new Set(known.map(cardKey))
  const deck: Card[] = []
  for (const rank of RANKS as readonly Rank[]) {
    for (const suit of SUITS as readonly Suit[]) {
      const c = { rank, suit }
      if (!used.has(cardKey(c))) deck.push(c)
    }
  }
  return deck
}

/** Partial Fisher–Yates: draw `count` cards from the front of `deck` in place. */
function drawN(deck: Card[], count: number, rng: Rng): Card[] {
  const drawn: Card[] = []
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (deck.length - i))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
    drawn.push(deck[i])
  }
  return drawn
}

export function estimateEquity(opts: EquityOptions): EquityResult {
  const community = opts.community ?? []
  const iterations = opts.iterations ?? 1500
  const rng = opts.rng ?? Math.random
  const opponents = opts.opponents

  if (opponents <= 0) {
    return { win: 1, tie: 0, equity: 1, iterations: 0 }
  }

  const base = remainingDeck([...opts.hole, ...community])
  const boardNeeded = 5 - community.length

  let wins = 0
  let ties = 0
  let equitySum = 0

  for (let it = 0; it < iterations; it++) {
    // Draw opponents' holes + the rest of the board from a fresh shuffle head.
    const need = opponents * 2 + boardNeeded
    const drawn = drawN(base, need, rng)

    const oppHoles: Card[][] = []
    for (let o = 0; o < opponents; o++) {
      oppHoles.push([drawn[o * 2], drawn[o * 2 + 1]])
    }
    const board = [...community, ...drawn.slice(opponents * 2)]

    const contenders = [
      { id: 'hero', hole: opts.hole },
      ...oppHoles.map((hole, i) => ({ id: `opp${i}`, hole })),
    ]
    const { winners } = determineWinners(contenders, board)

    if (winners.includes('hero')) {
      if (winners.length === 1) {
        wins++
        equitySum += 1
      } else {
        ties++
        equitySum += 1 / winners.length
      }
    }
  }

  return {
    win: wins / iterations,
    tie: ties / iterations,
    equity: equitySum / iterations,
    iterations,
  }
}
