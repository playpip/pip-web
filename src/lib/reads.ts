// AI reads — plain-English tendencies observed about an opponent during a
// tournament. Pure: the game store records SeatStats as hands play out; this
// module turns them into the short reads shown in the player dialog. Watching
// opponents is a real poker skill — the reads reward it and teach it.

export interface SeatStats {
  /** Hands this player was dealt into. */
  handsDealt: number
  /** Hands where they voluntarily put chips in preflop (blinds don't count). */
  vpipHands: number
  /** Aggressive actions (bets + raises). */
  raises: number
  /** Passive continues (calls). */
  calls: number
  /** Times they faced a bet (fold, call or raise were on the table). */
  betsFaced: number
  /** Folds when facing a bet. */
  foldsToBet: number
  /** Showdowns reached. */
  showdowns: number
}

export const emptySeatStats = (): SeatStats => ({
  handsDealt: 0,
  vpipHands: 0,
  raises: 0,
  calls: 0,
  betsFaced: 0,
  foldsToBet: 0,
  showdowns: 0,
})

/** Hands observed before reads are worth showing. */
export const READS_MIN_HANDS = 8

export interface Read {
  label: string
  /** 0..1 — drives the quiet bar next to the label. */
  strength: number
}

/**
 * 2–3 plain-English reads, or null while there's too little to go on.
 * Each read needs its own minimum sample so early noise doesn't mislead.
 */
export function deriveReads(stats: SeatStats | undefined): Read[] | null {
  if (!stats || stats.handsDealt < READS_MIN_HANDS) return null

  const reads: Read[] = []

  // How many hands do they play?
  const vpip = stats.vpipHands / stats.handsDealt
  reads.push({
    label: vpip > 0.55 ? 'Plays most hands' : vpip >= 0.3 ? 'Picks their spots' : 'Waits for real hands',
    strength: vpip,
  })

  // Bettor or caller?
  const actions = stats.raises + stats.calls
  if (actions >= 4) {
    const aggression = stats.raises / actions
    reads.push({
      label:
        aggression > 0.55
          ? 'Raises more than calls'
          : aggression >= 0.3
            ? 'Mixes betting and calling'
            : 'Calls more than raises',
      strength: aggression,
    })
  }

  // Do they fold when bet at?
  if (stats.betsFaced >= 4) {
    const foldRate = stats.foldsToBet / stats.betsFaced
    reads.push({
      label:
        foldRate > 0.55
          ? 'Folds under pressure'
          : foldRate >= 0.3
            ? 'Gives up a fair share'
            : 'Hard to push off a hand',
      strength: foldRate,
    })
  }

  return reads
}
