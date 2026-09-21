// Monte-Carlo equity: how often does a hand win at showdown against N random
// opponents, given the current board? Fast enough (~1–2k sims) to run inline
// for both AI decisions and the human's ambient "win %" readout.

import type { Card, Rank, Rng, Suit } from './cards'
import { RANKS, SUITS } from './cards'
import { DECK_RANKS, HOLE_CARDS, type Variant, determineWinners } from './handEval'
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
  /**
   * Which game's rules to simulate. Defaults to Hold'em.
   *
   * At Omaha every opponent is dealt four cards and every showdown is read
   * under the two-from-hand rule, so an equity estimate that ignored this
   * would be answering a different game's question with this game's cards.
   *
   * **`opponentSelectivity` is ignored at Omaha**, and that is deliberate
   * rather than missing: the ranged draw weights two-card holdings by a
   * Hold'em notion of strength, and there is no honest way to reuse it for
   * four. Omaha estimates are raw equity against random hands.
   */
  variant?: Variant
}

function cardKey(c: Card): string {
  return `${c.rank}${c.suit}`
}

function remainingDeck(known: readonly Card[], ranks: readonly Rank[] = RANKS): Card[] {
  const used = new Set(known.map(cardKey))
  const deck: Card[] = []
  for (const rank of ranks) {
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

  const variant = opts.variant ?? 'holdem'
  // The sim deals from the same deck the table does. Running a short-deck spot
  // against a fifty-two-card runout answers a different question than the one
  // on screen, and answers it confidently.
  const base = remainingDeck([...opts.hole, ...community], DECK_RANKS[variant])
  const boardNeeded = 5 - community.length
  const holeSize = HOLE_CARDS[variant]
  const selectivity = opts.opponentSelectivity
  const ranged = variant === 'holdem' && !!selectivity && selectivity.some((s) => s > 0)

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
      const need = opponents * holeSize + boardNeeded
      const drawn = drawN(base, need, rng)
      oppHoles = []
      for (let o = 0; o < opponents; o++) {
        oppHoles.push(drawn.slice(o * holeSize, (o + 1) * holeSize))
      }
      board = [...community, ...drawn.slice(opponents * holeSize)]
    }

    const contenders = [
      { id: 'hero', hole: opts.hole },
      ...oppHoles.map((hole, i) => ({ id: `opp${i}`, hole })),
    ]
    const { winners } = determineWinners(contenders, board, variant)

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

// --- every hand face up ------------------------------------------------------

/**
 * How often each of a set of *known* hands wins from here.
 *
 * The estimate above answers "how do I do against strangers"; this one answers
 * "who is ahead", and it is a different question with a better answer
 * available: when every hole card is known the only unknown left is the board,
 * and the board can be dealt out exhaustively rather than sampled. The session
 * review is the one surface that can ask it — the hand is over, every card is
 * recorded, and nothing anybody learns from it can be played.
 *
 * Exact wherever exact is affordable: one runout on the river, forty-odd on the
 * turn, a few hundred on the flop. Preflop the five-card runout runs to
 * millions, so it samples and says so through `exact`.
 */
export interface ShowdownOdds {
  /** Share of the pot per player id, summing to 1. Chops split their share. */
  share: Record<string, number>
  /** True when every remaining board was dealt rather than sampled. */
  exact: boolean
  /** Runouts read. */
  runouts: number
}

/**
 * How much work one of these may do, counted in showdowns rather than in
 * boards.
 *
 * A board costs one evaluation *per player*, so "666 runouts" is cheap
 * heads-up and four times the work five-handed. Budgeting the product is what
 * keeps a step on the review feeling instant whoever is still in the pot: at a
 * few thousand a step it crawled, and the first preflop step of a five-handed
 * hand took a full second (Will, 2026-09-21).
 */
const MAX_EXACT_SOLVES = 4_000
/** And the same budget for the sampled case, which is preflop and only preflop. */
const SAMPLE_SOLVES = 1_500
/** However few players are in, never fewer samples than this. */
const MIN_SAMPLES = 250

export function showdownOdds(
  hands: readonly { id: string; hole: readonly Card[] }[],
  community: readonly Card[],
  opts: { rng?: Rng; samples?: number; variant?: Variant } = {},
): ShowdownOdds {
  const variant = opts.variant ?? 'holdem'
  const share: Record<string, number> = Object.fromEntries(hands.map((h) => [h.id, 0]))
  if (hands.length === 0) return { share, exact: true, runouts: 0 }
  if (hands.length === 1) return { share: { [hands[0].id]: 1 }, exact: true, runouts: 0 }

  const contenders = hands.map((h) => ({ id: h.id, hole: [...h.hole] }))
  const known = [...community, ...hands.flatMap((h) => h.hole)]
  const rest = remainingDeck(known, DECK_RANKS[variant])
  const toCome = 5 - community.length

  const award = (board: Card[]) => {
    const { winners } = determineWinners(contenders, board, variant)
    for (const id of winners) share[id] += 1 / winners.length
  }

  let runouts = 0
  let exact = true
  if (toCome <= 0) {
    award([...community])
    runouts = 1
  } else if (toCome === 1) {
    for (const card of rest) {
      award([...community, card])
      runouts++
    }
  } else if (
    toCome === 2 &&
    ((rest.length * (rest.length - 1)) / 2) * hands.length <= MAX_EXACT_SOLVES
  ) {
    for (let i = 0; i < rest.length; i++) {
      for (let j = i + 1; j < rest.length; j++) {
        award([...community, rest[i], rest[j]])
        runouts++
      }
    }
  } else {
    // Too many boards to deal them all. Sample, and say so.
    exact = false
    const rng = opts.rng ?? Math.random
    // Scaled by how many hands are being read, so the cost of a sampled answer
    // does not multiply with the size of the pot. The screen prints "about" off
    // `exact`, so the band this trades away is already declared.
    const samples = opts.samples ?? Math.max(MIN_SAMPLES, Math.round(SAMPLE_SOLVES / hands.length))
    const pool = [...rest]
    for (let s = 0; s < samples; s++) {
      // Partial Fisher-Yates over the head of the pool: `toCome` swaps, not a
      // whole shuffle, because the tail is never looked at.
      for (let i = 0; i < toCome; i++) {
        const j = i + Math.floor(rng() * (pool.length - i))
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
      }
      award([...community, ...pool.slice(0, toCome)])
      runouts++
    }
  }

  for (const id of Object.keys(share)) share[id] /= runouts
  return { share, exact, runouts }
}
