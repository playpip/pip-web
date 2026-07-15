// Side-pot construction. Given how much each player has committed to the hand
// and whether they folded, split the chips into a main pot + side pots, each
// with its set of eligible (non-folded) winners. Folded players' chips still
// form part of the pots — they just can't win them.

export interface Contribution<T> {
  id: T
  /** Total chips this player has put into the hand. */
  committed: number
  /** Folded players contribute chips but are not eligible to win. */
  folded: boolean
}

export interface Pot<T> {
  amount: number
  /** Ids eligible to win this pot (never empty for a real pot). */
  eligible: T[]
}

/**
 * Build main + side pots from per-player contributions. Pots are returned
 * smallest-stake layer first (main pot first). Adjacent layers with identical
 * eligible sets are merged for tidiness.
 */
export function buildPots<T>(contributions: readonly Contribution<T>[]): Pot<T>[] {
  // Working copy of remaining chips to allocate per player.
  const remaining = contributions.filter((c) => c.committed > 0).map((c) => ({ ...c }))

  const pots: Pot<T>[] = []

  while (remaining.length > 0) {
    // The next layer is capped by the smallest remaining contribution.
    const layer = Math.min(...remaining.map((c) => c.committed))

    let amount = 0
    const eligible: T[] = []
    for (const c of remaining) {
      amount += layer
      c.committed -= layer
      if (!c.folded) eligible.push(c.id)
    }

    // A layer where everyone folded (impossible in a real hand, but be safe)
    // still holds chips; attach them to the previous pot if present.
    if (eligible.length === 0 && pots.length > 0) {
      pots[pots.length - 1].amount += amount
    } else {
      pots.push({ amount, eligible })
    }

    // Drop players who are now fully allocated.
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i].committed === 0) remaining.splice(i, 1)
    }
  }

  return mergeAdjacentEqualPots(pots)
}

function sameSet<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  const sb = new Set(b)
  return a.every((x) => sb.has(x))
}

function mergeAdjacentEqualPots<T>(pots: Pot<T>[]): Pot<T>[] {
  const merged: Pot<T>[] = []
  for (const pot of pots) {
    const prev = merged[merged.length - 1]
    if (prev && sameSet(prev.eligible, pot.eligible)) {
      prev.amount += pot.amount
    } else {
      merged.push({ amount: pot.amount, eligible: [...pot.eligible] })
    }
  }
  return merged
}

/** Total chips across all pots — handy for assertions. */
export function totalPot<T>(pots: readonly Pot<T>[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0)
}
