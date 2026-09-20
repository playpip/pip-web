// What the AI throws away at Five-Card Draw.
//
// **This is the whole of draw strategy that matters.** There is no board to
// read, no position to exploit and nothing to see: the only information anyone
// has is their own five cards and how many everybody else asked for. So the
// discard is the game, and a table that stood pat on everything — or drew five
// every time — would be transparently broken in a way the betting AI's
// occasional misread is not.
//
// It is deliberately simple and deliberately *standard*: keep the made hand,
// keep four to a flush or an open straight, otherwise keep the pair and draw
// three. That is the play from any beginner's chart, and it is the right level
// for the same reason the betting AI is solid rather than superhuman — the
// tables are meant to be beatable by a thinking player (docs/poker-engine.md).
//
// Pure, and given an `Rng` for the one decision that is genuinely a coin flip.

import type { Card, Rank, Rng } from '../cards'
import { evaluateHand } from '../handEval'

const ORDER: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

/** Indices grouped by rank, biggest group first, then highest rank. */
function rankGroups(hole: readonly Card[]): number[][] {
  const byRank = new Map<Rank, number[]>()
  hole.forEach((card, i) => {
    const seen = byRank.get(card.rank)
    if (seen) seen.push(i)
    else byRank.set(card.rank, [i])
  })
  return [...byRank.entries()]
    .sort((a, b) => b[1].length - a[1].length || ORDER[b[0]] - ORDER[a[0]])
    .map(([, indices]) => indices)
}

/** Four of one suit, when there are four. The indices to keep. */
function fourFlush(hole: readonly Card[]): number[] | null {
  const bySuit = new Map<string, number[]>()
  hole.forEach((card, i) => {
    const seen = bySuit.get(card.suit)
    if (seen) seen.push(i)
    else bySuit.set(card.suit, [i])
  })
  for (const indices of bySuit.values()) if (indices.length === 4) return indices
  return null
}

/**
 * Four to an open-ended straight — four consecutive ranks, no pairs.
 *
 * Only the open-ended shape, not gutshots. A gutshot draw is four outs against
 * eight and is not worth breaking a pair for, which is exactly the mistake this
 * function would cause if it were more generous.
 */
function fourStraight(hole: readonly Card[]): number[] | null {
  const values = hole.map((c, i) => ({ v: ORDER[c.rank], i })).sort((a, b) => a.v - b.v)
  for (let start = 0; start + 3 < values.length; start++) {
    const run = values.slice(start, start + 4)
    const consecutive = run.every((card, k) => k === 0 || card.v === run[k - 1].v + 1)
    if (consecutive) return run.map((card) => card.i)
  }
  return null
}

/**
 * Which cards to throw away, by index into the hand.
 *
 * The order of the checks is the strategy:
 *
 * 1. **A made hand stands pat.** A straight or better is already worth more
 *    than anything one card would turn it into.
 * 2. **Four to a flush or an open straight** beats holding a low pair, so the
 *    draw is kept and the odd card goes.
 * 3. **Trips or quads**: keep them, draw the rest.
 * 4. **Two pair**: throw the fifth card. One card, one chance at the boat.
 * 5. **A pair**: keep it, draw three. Even a pair of twos beats drawing four to
 *    an ace.
 * 6. **Nothing at all**: keep the ace if there is one and draw four, otherwise
 *    throw all five. Standing there with king-high helps nobody.
 */
export function decideDiscard(hole: readonly Card[], rng: Rng): number[] {
  if (hole.length < 5) return []
  const all = [0, 1, 2, 3, 4]
  const keepOnly = (keep: number[]) => all.filter((i) => !keep.includes(i))

  const made = evaluateHand(hole, [], 'draw')
  // pokersolver ranks straights and above from 4 upward on its own scale;
  // reading the name keeps this independent of that number.
  const STAND_PAT = ['Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush']
  if (STAND_PAT.includes(made.name)) return []

  const groups = rankGroups(hole)
  const biggest = groups[0]?.length ?? 1

  // A four-flush or four-straight is only worth chasing when it is not
  // breaking something better than a single low pair.
  if (biggest <= 2) {
    const flush = fourFlush(hole)
    if (flush) return keepOnly(flush)
    const straight = fourStraight(hole)
    // With a pair *and* an open-ended four-straight, either is defensible;
    // the pair is the safer hold, so it takes it more often than not.
    if (straight && (biggest < 2 || rng() < 0.35)) return keepOnly(straight)
  }

  if (biggest >= 3) return keepOnly(groups[0])
  if (biggest === 2) {
    const pairs = groups.filter((g) => g.length === 2)
    if (pairs.length === 2) return keepOnly([...pairs[0], ...pairs[1]])
    return keepOnly(groups[0])
  }

  const ace = hole.findIndex((c) => c.rank === 'A')
  return ace >= 0 ? keepOnly([ace]) : all
}
