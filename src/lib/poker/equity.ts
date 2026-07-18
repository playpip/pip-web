// Monte-Carlo equity: how often does a hand win at showdown against N random
// opponents, given the current board? Fast enough (~1–2k sims) to run inline
// for both AI decisions and the human's ambient "win %" readout.

import type { Card, Rank, Rng, Suit } from './cards'
import { RANKS, SUITS } from './cards'
import { determineWinners } from './handEval'
import { holeStrength } from './range'

/** How many candidate holdings a maximally-tight opponent picks the best of. */
const MAX_EXTRA_CANDIDATES = 5

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
  /**
   * Per-opponent range tightness in [0, 1]: 0 = a uniformly random hand (raw
   * equity, the default), higher = a stronger, self-selected range (as when the
   * opponent keeps betting). Length should match `opponents`; missing/0 entries
   * fall back to random. Omit entirely to reproduce classic raw equity.
   */
  opponentSelectivity?: readonly number[]
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

/**
 * Draw opponent holes from strength-weighted ranges plus the rest of the board.
 * Each opponent takes the best (by `holeStrength`) of `1 + floor(sel * MAX)`
 * random candidate pairs, so tighter selectivity concentrates their range on
 * stronger hands. Cards are consumed without replacement across opponents+board.
 */
function drawRangedHoles(
  base: readonly Card[],
  opponents: number,
  boardNeeded: number,
  selectivity: readonly number[],
  community: readonly Card[],
  rng: Rng,
): { oppHoles: Card[][]; board: Card[] } {
  const n = base.length
  const used = new Array<boolean>(n).fill(false)
  const pickUnused = (): number => {
    let idx = Math.floor(rng() * n)
    while (used[idx]) idx = Math.floor(rng() * n)
    return idx
  }

  const oppHoles: Card[][] = []
  for (let o = 0; o < opponents; o++) {
    const sel = Math.max(0, Math.min(1, selectivity[o] ?? 0))
    const candidates = 1 + Math.floor(sel * MAX_EXTRA_CANDIDATES)
    let best: [number, number] | null = null
    let bestScore = -1
    for (let c = 0; c < candidates; c++) {
      const i = pickUnused()
      used[i] = true // reserve so the partner card differs
      const j = pickUnused()
      used[i] = false // release both; only the winning pair is kept
      const score = holeStrength([base[i], base[j]], community)
      if (score > bestScore) {
        bestScore = score
        best = [i, j]
      }
    }
    // `best` is always set: candidates >= 1.
    const [i, j] = best as [number, number]
    used[i] = true
    used[j] = true
    oppHoles.push([base[i], base[j]])
  }

  const board = [...community]
  for (let b = 0; b < boardNeeded; b++) {
    const i = pickUnused()
    used[i] = true
    board.push(base[i])
  }
  return { oppHoles, board }
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
  const selectivity = opts.opponentSelectivity
  const ranged = !!selectivity && selectivity.some((s) => s > 0)

  let wins = 0
  let ties = 0
  let equitySum = 0

  for (let it = 0; it < iterations; it++) {
    // Draw opponents' holes + the rest of the board. With per-opponent
    // selectivity, holdings are weighted toward stronger hands; otherwise every
    // opponent gets a uniformly random hand (classic raw equity).
    let oppHoles: Card[][]
    let board: Card[]
    if (ranged) {
      ;({ oppHoles, board } = drawRangedHoles(
        base,
        opponents,
        boardNeeded,
        selectivity as readonly number[],
        community,
        rng,
      ))
    } else {
      const need = opponents * 2 + boardNeeded
      const drawn = drawN(base, need, rng)
      oppHoles = []
      for (let o = 0; o < opponents; o++) {
        oppHoles.push([drawn[o * 2], drawn[o * 2 + 1]])
      }
      board = [...community, ...drawn.slice(opponents * 2)]
    }

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
