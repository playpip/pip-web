// Monte-Carlo equity: how often does a hand win at showdown against N random
// opponents, given the current board? Fast enough (~1–2k sims) to run inline
// for both AI decisions and the human's ambient "win %" readout.

import type { Card, Rank, Rng, Suit } from './cards'
import { RANKS, SUITS } from './cards'
import { CARD_AT, COMBO_A, COMBO_B, COMBOS, cardIndex } from './combos'
import { DECK_RANKS, HOLE_CARDS, type Variant, determineWinners } from './handEval'
import { exactStrength, holeStrength, omahaStrength, preflopTop } from './range'
import { rankHoldem } from './rank7'

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
   * At Omaha the ranged draw weights four-card holdings by `omahaStrength`:
   * the best two-card pairing with the board after the flop, the shape of the
   * four before it. It is still ignored at Omaha hi-lo and Short Deck, whose
   * estimates are raw equity against random hands.
   */
  variant?: Variant
  /**
   * Settle each sampled Hold'em showdown with `rankHoldem` instead of
   * pokersolver. Same winners on every board (`tests/rank7.test.ts`), so the
   * same rng gives the same answer, about fifty times sooner. Off by default
   * while it is measured; Hold'em only, ignored elsewhere.
   */
  fastShowdown?: boolean
  /**
   * Rank an opponent's candidate holdings by their exact made hand (pair rank
   * and kickers included) plus live draws, instead of `holeStrength`'s
   * category read. Only changes anything when `opponentSelectivity` is set.
   * Hold'em only.
   */
  exactRange?: boolean
  /**
   * Per-opponent weighted ranges: one weight per two-card combo (`combos.ts`),
   * any scale, and each opponent's holding is sampled in proportion to it.
   * Replaces `opponentSelectivity` for every opponent that has one; a missing
   * entry is a random hand. Hold'em only, ignored elsewhere. Built by
   * `ai/weightedRange.ts` for the AI's `weightedRanges` experiment.
   */
  opponentRanges?: readonly (Float64Array | null | undefined)[]
  /**
   * Per-opponent percentile range before the flop: an entry of 0.06 deals that
   * opponent a hand drawn evenly from the top 6% of starting hands (by
   * `holeStrength`), in place of their `opponentSelectivity`. Missing entries
   * keep the selectivity read. Hold'em preflop only, ignored elsewhere.
   */
  opponentTopShare?: readonly (number | undefined)[]
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
 * Each opponent takes the best (by `strength`) of `1 + floor(sel * MAX)`
 * random candidate holdings, so tighter selectivity concentrates their range on
 * stronger hands. Cards are consumed without replacement across opponents+board.
 */
function drawRangedHoles(
  base: readonly Card[],
  opponents: number,
  holeSize: number,
  boardNeeded: number,
  selectivity: readonly number[],
  community: readonly Card[],
  strength: (hole: readonly Card[], community: readonly Card[]) => number,
  rng: Rng,
  topRanges?: readonly (readonly (readonly Card[])[] | undefined)[],
  baseIndex?: ReadonlyMap<string, number>,
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
    const top = topRanges?.[o]
    if (top && baseIndex) {
      const chosen = drawFromTop(top, baseIndex, used, rng)
      if (chosen) {
        for (const i of chosen) used[i] = true
        oppHoles.push(chosen.map((i) => base[i]))
        continue
      }
    }
    const sel = Math.max(0, Math.min(1, selectivity[o] ?? 0))
    const candidates = 1 + Math.floor(sel * MAX_EXTRA_CANDIDATES)
    let best: number[] | null = null
    let bestScore = -1
    for (let c = 0; c < candidates; c++) {
      // Reserve each card as it is drawn so a holding never repeats one, then
      // release them all: only the winning holding is kept.
      const picked: number[] = []
      for (let k = 0; k < holeSize; k++) {
        const i = pickUnused()
        used[i] = true
        picked.push(i)
      }
      for (const i of picked) used[i] = false
      const score = strength(
        picked.map((i) => base[i]),
        community,
      )
      if (score > bestScore) {
        bestScore = score
        best = picked
      }
    }
    // `best` is always set: candidates >= 1.
    const chosen = best as number[]
    for (const i of chosen) used[i] = true
    oppHoles.push(chosen.map((i) => base[i]))
  }

  const board = [...community]
  for (let b = 0; b < boardNeeded; b++) {
    const i = pickUnused()
    used[i] = true
    board.push(base[i])
  }
  return { oppHoles, board }
}

/** How many colliding weighted deals to redraw before falling back to dealing in order. */
const WEIGHTED_RETRIES = 24

/**
 * A weighted range ready to sample: cumulative weights over the combos left
 * once the hero's cards and the board are out, or null for a random hand.
 */
interface RangeSampler {
  combos: Uint16Array
  cumulative: Float64Array
  total: number
}

function rangeSampler(weights: Float64Array, dead: Uint8Array): RangeSampler | null {
  const combos: number[] = []
  const cumulative: number[] = []
  let total = 0
  for (let c = 0; c < COMBOS; c++) {
    const w = weights[c]
    if (!(w > 0) || dead[COMBO_A[c]] || dead[COMBO_B[c]]) continue
    total += w
    combos.push(c)
    cumulative.push(total)
  }
  if (combos.length === 0) return null
  return { combos: Uint16Array.from(combos), cumulative: Float64Array.from(cumulative), total }
}

/** One combo from a sampler, by binary search over the cumulative weights. */
function sampleCombo(s: RangeSampler, rng: Rng): number {
  const target = rng() * s.total
  let lo = 0
  let hi = s.combos.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (s.cumulative[mid] <= target) lo = mid + 1
    else hi = mid
  }
  return s.combos[lo]
}

/**
 * Deal each opponent from their weighted range and the rest of the board from
 * what is left. When two sampled holdings share a card the whole set is drawn
 * again, not just the later one: redrawing only the later hand would leave the
 * earlier ones at their unconditioned odds, and the answer would depend on the
 * order the opponents are listed in. After `WEIGHTED_RETRIES` collisions (ranges
 * that all but exclude each other) it falls back to dealing in order, with two
 * random live cards for any opponent whose range has nothing left.
 */
function drawWeightedHoles(
  live: readonly number[],
  dead: Uint8Array,
  samplers: readonly (RangeSampler | null)[],
  boardNeeded: number,
  community: readonly Card[],
  rng: Rng,
): { oppHoles: Card[][]; board: Card[] } {
  const n = live.length
  let used = dead.slice()
  const pickUnused = (): number => {
    let card = live[Math.floor(rng() * n)]
    while (used[card]) card = live[Math.floor(rng() * n)]
    return card
  }
  const randomHole = (): [number, number] => {
    const a = pickUnused()
    used[a] = 1
    const b = pickUnused()
    used[b] = 1
    return [a, b]
  }

  let holes: [number, number][] = []
  let dealt = false
  for (let tries = 0; tries < WEIGHTED_RETRIES && !dealt; tries++) {
    used = dead.slice()
    holes = []
    dealt = true
    for (const sampler of samplers) {
      if (!sampler) {
        holes.push(randomHole())
        continue
      }
      const c = sampleCombo(sampler, rng)
      if (used[COMBO_A[c]] || used[COMBO_B[c]]) {
        dealt = false
        break
      }
      used[COMBO_A[c]] = 1
      used[COMBO_B[c]] = 1
      holes.push([COMBO_A[c], COMBO_B[c]])
    }
  }
  if (!dealt) {
    used = dead.slice()
    holes = []
    for (const sampler of samplers) {
      let hole: [number, number] | null = null
      for (let tries = 0; sampler && tries < WEIGHTED_RETRIES && !hole; tries++) {
        const c = sampleCombo(sampler, rng)
        if (!used[COMBO_A[c]] && !used[COMBO_B[c]]) hole = [COMBO_A[c], COMBO_B[c]]
      }
      if (hole) {
        used[hole[0]] = 1
        used[hole[1]] = 1
      }
      holes.push(hole ?? randomHole())
    }
  }

  const oppHoles = holes.map(([a, b]) => [CARD_AT[a], CARD_AT[b]])
  const board = [...community]
  for (let i = 0; i < boardNeeded; i++) {
    const card = pickUnused()
    used[card] = 1
    board.push(CARD_AT[card])
  }
  return { oppHoles, board }
}

/**
 * One holding drawn evenly from a percentile range, as indices into the deck,
 * skipping any that share a card with the hero, the board or an opponent
 * already dealt. Null when a few tries find none free: the caller falls back to
 * the selectivity read rather than loop on a range the dead cards have emptied.
 */
function drawFromTop(
  top: readonly (readonly Card[])[],
  baseIndex: ReadonlyMap<string, number>,
  used: readonly boolean[],
  rng: Rng,
): number[] | null {
  for (let attempt = 0; attempt < 64; attempt++) {
    const hole = top[Math.floor(rng() * top.length)]
    const a = baseIndex.get(cardKey(hole[0]))
    const b = baseIndex.get(cardKey(hole[1]))
    if (a !== undefined && b !== undefined && !used[a] && !used[b]) return [a, b]
  }
  return null
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
  // Ranged at Hold'em and Omaha, each with its own idea of a strong holding.
  // Hi-lo and Short Deck stay raw: a hi-lo hand is strong two ways at once,
  // and Short Deck reorders the categories the strength read is built on.
  const strength =
    variant === 'holdem'
      ? opts.exactRange
        ? exactStrength
        : holeStrength
      : variant === 'omaha'
        ? omahaStrength
        : null
  const fast = !!opts.fastShowdown && variant === 'holdem'
  const topShare =
    variant === 'holdem' && community.length === 0 ? opts.opponentTopShare : undefined
  const topRanges = topShare?.map((share) => (share ? preflopTop(share) : undefined))
  const baseIndex = topRanges?.some(Boolean)
    ? new Map(base.map((c, i) => [cardKey(c), i]))
    : undefined
  const ranged =
    (!!strength && !!selectivity && selectivity.some((s) => s > 0)) || baseIndex !== undefined

  // Weighted ranges, when given, take the place of selectivity entirely.
  let weighted: {
    live: number[]
    dead: Uint8Array
    samplers: (RangeSampler | null)[]
  } | null = null
  if (variant === 'holdem' && opts.opponentRanges) {
    const dead = new Uint8Array(52)
    for (const c of [...opts.hole, ...community]) dead[cardIndex(c)] = 1
    const live: number[] = []
    for (let i = 0; i < 52; i++) if (!dead[i]) live.push(i)
    const samplers: (RangeSampler | null)[] = []
    for (let o = 0; o < opponents; o++) {
      const w = opts.opponentRanges[o]
      samplers.push(w ? rangeSampler(w, dead) : null)
    }
    weighted = { live, dead, samplers }
  }

  let wins = 0
  let ties = 0
  let equitySum = 0

  for (let it = 0; it < iterations; it++) {
    // Draw opponents' holes + the rest of the board. With per-opponent
    // selectivity, holdings are weighted toward stronger hands; otherwise every
    // opponent gets a uniformly random hand (classic raw equity).
    let oppHoles: Card[][]
    let board: Card[]
    if (weighted) {
      ;({ oppHoles, board } = drawWeightedHoles(
        weighted.live,
        weighted.dead,
        weighted.samplers,
        boardNeeded,
        community,
        rng,
      ))
    } else if (ranged) {
      ;({ oppHoles, board } = drawRangedHoles(
        base,
        opponents,
        holeSize,
        boardNeeded,
        selectivity ?? [],
        community,
        strength as NonNullable<typeof strength>,
        rng,
        topRanges,
        baseIndex,
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

    if (fast) {
      // The same tally as below, off one number per hand: the hero is among
      // the winners when nobody ranks above them, and splits with every equal.
      const mine = rankHoldem(opts.hole, board)
      let beaten = false
      let sharing = 1
      for (const hole of oppHoles) {
        const r = rankHoldem(hole, board)
        if (r > mine) {
          beaten = true
          break
        }
        if (r === mine) sharing++
      }
      if (!beaten) {
        if (sharing === 1) {
          wins++
          equitySum += 1
        } else {
          ties++
          equitySum += 1 / sharing
        }
      }
      continue
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
