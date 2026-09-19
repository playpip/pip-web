import type { LifetimeStats, RollPoint, VenueRecord } from '@/store/profile'
import type { SeatStats } from '@/lib/reads'

// Coaching across hands — the membership's half of the coaching line.
//
// **The split, settled long before this file (Will, 2026-07-30): the hand is
// free, the player is paid.** `lib/coach.ts` reads one hand and stays
// `HandRecord -> HandRead | null`; it must not grow a paid branch inside it,
// and nothing here imports it. This module reads what you have done across
// every hand you have ever played and names what it costs you.
//
// **This was left unspecced on purpose** (technology#56) until there was data
// to write it against, because a spec written first would have been a list of
// features we hoped the numbers supported. So everything below is derived from
// fields that are already persisted and already counted:
//
// - `tendencies`  — lifetime SeatStats for the hero. VPIP, aggression,
//   fold-to-bet and showdowns, counted hand by hand since v9.
// - `stats`       — lifetime counters, including showdowns actually won.
// - `venueRecords`— entries, wins and best finish per table.
// - `rollHistory` — the Roll sampled at every result since v7.
//
// Nothing here is a model, a simulation or a guess. Every number is a ratio of
// two things that were counted.
//
// **Two rules this file holds itself to, and they are the reason it is worth
// paying for rather than just longer:**
//
// 1. **A leak carries its own sample.** Every finding says how many hands it is
//    drawn from, and none appears below its own minimum. A confident sentence
//    about eleven hands is worse than silence — it is the same mistake the
//    odds calculator prints an error bar to avoid.
// 2. **It never tells you to play more.** Not one finding here can be resolved
//    by sitting at another table, and none of them is a streak, a goal, or
//    anything you can be behind on. It is a mirror, not a lever — the rule
//    `lib/drills/rating.ts` already sets for progress, applied to coaching.

/** How many hands before this file will say anything at all about your play. */
export const DEEP_MIN_HANDS = 120
/** How many showdowns before the showdown findings are worth reading. */
export const DEEP_MIN_SHOWDOWNS = 25
/** How many results before the trend is a trend rather than a fortnight. */
export const DEEP_MIN_RESULTS = 12

export type LeakSeverity = 'watch' | 'costly'

export interface Leak {
  id: string
  /** What it is, in four or five words. */
  title: string
  /** The number, stated plainly, with the sample it came from. */
  finding: string
  /** What to do differently. One sentence, actionable at a table. */
  advice: string
  severity: LeakSeverity
  /** Hands (or showdowns, or results) this is drawn from. */
  sample: number
}

export interface DeepCoachInput {
  tendencies: SeatStats
  stats: LifetimeStats
  venueRecords: Record<string, VenueRecord>
  rollHistory: readonly RollPoint[]
}

export interface DeepRead {
  /** Findings, worst first. Empty when there is nothing worth saying. */
  leaks: Leak[]
  /** What is going right, so a report is not only a list of faults. */
  strengths: Leak[]
  /** Hands counted. Null when there are too few to say anything. */
  hands: number | null
  /**
   * Why there is nothing to report, when there is nothing to report. Null once
   * the sample is there. A blank screen with no explanation is the worst thing
   * a paid feature can render.
   */
  waitingFor: string | null
}

const pct = (n: number) => `${Math.round(n * 100)}%`

/**
 * Read a player across every hand they have played.
 *
 * Pure: it is handed the four persisted shapes and returns findings. No store,
 * no clock, no randomness, so the same profile always produces the same report
 * and it can be tested without a browser.
 */
export function deepRead(input: DeepCoachInput): DeepRead {
  const { tendencies: t, stats, venueRecords, rollHistory } = input
  const hands = t.handsDealt

  if (hands < DEEP_MIN_HANDS) {
    return {
      leaks: [],
      strengths: [],
      hands: null,
      waitingFor: `Your report opens at ${DEEP_MIN_HANDS} hands. You have played ${hands}. Anything said before that would be about the cards, not about you.`,
    }
  }

  const leaks: Leak[] = []
  const strengths: Leak[] = []

  // --- how many hands you enter --------------------------------------------
  // The bands are the ones `lib/reads.ts` already uses on opponents, so the
  // coach and the player dialog cannot describe the same behaviour two ways.
  const vpip = t.vpipHands / hands
  if (vpip > 0.55) {
    leaks.push({
      id: 'too-loose',
      title: 'You enter too many pots',
      finding: `You put chips in voluntarily on ${pct(vpip)} of hands, over ${hands} of them.`,
      advice:
        'Fold your weakest opening hands from early seats. The pots you are giving up are the ones you were going to have the worst of anyway.',
      severity: vpip > 0.68 ? 'costly' : 'watch',
      sample: hands,
    })
  } else if (vpip < 0.16) {
    leaks.push({
      id: 'too-tight',
      title: 'You are folding your way out',
      finding: `You enter only ${pct(vpip)} of hands, over ${hands} of them.`,
      advice:
        'The blinds cost you whether you play or not. Open more hands on the button, where position pays for a weaker holding.',
      severity: 'watch',
      sample: hands,
    })
  } else {
    strengths.push({
      id: 'selection',
      title: 'Your hand selection is sound',
      finding: `You enter ${pct(vpip)} of hands, which is where it should be.`,
      advice: 'Nothing to change here.',
      severity: 'watch',
      sample: hands,
    })
  }

  // --- betting versus calling ----------------------------------------------
  const actions = t.raises + t.calls
  if (actions >= 40) {
    const aggression = t.raises / actions
    if (aggression < 0.28) {
      leaks.push({
        id: 'passive',
        title: 'You call far more than you bet',
        finding: `Only ${pct(aggression)} of your continues are bets or raises, over ${actions} of them.`,
        advice:
          'When you would call, ask whether betting wins the pot outright. Calling can only win a showdown; betting can win two ways.',
        severity: aggression < 0.2 ? 'costly' : 'watch',
        sample: actions,
      })
    } else if (aggression > 0.72) {
      leaks.push({
        id: 'over-aggressive',
        title: 'You bet almost everything',
        finding: `${pct(aggression)} of your continues are bets or raises, over ${actions} of them.`,
        advice:
          'Against players who do not fold, a bet with nothing is just a bigger loss. Check back your weakest hands on the river.',
        severity: 'watch',
        sample: actions,
      })
    } else {
      strengths.push({
        id: 'aggression',
        title: 'You bet when you continue',
        finding: `${pct(aggression)} of your continues are bets or raises.`,
        advice: 'Nothing to change here.',
        severity: 'watch',
        sample: actions,
      })
    }
  }

  // --- folding to bets ------------------------------------------------------
  if (t.betsFaced >= 40) {
    const foldRate = t.foldsToBet / t.betsFaced
    if (foldRate > 0.62) {
      leaks.push({
        id: 'folds-to-pressure',
        title: 'You are bet off too many pots',
        finding: `You fold to ${pct(foldRate)} of the bets you face, over ${t.betsFaced} of them.`,
        advice:
          'Pick one hand a session you would normally fold and call it down. Folding everything but the top of your range is the easiest thing at a table to exploit.',
        severity: foldRate > 0.72 ? 'costly' : 'watch',
        sample: t.betsFaced,
      })
    } else if (foldRate < 0.3) {
      leaks.push({
        id: 'cannot-fold',
        title: 'You do not fold enough',
        finding: `You fold to only ${pct(foldRate)} of the bets you face, over ${t.betsFaced} of them.`,
        advice:
          'Count what the pot is charging before you call. A call that is wrong by a little, made often, is the most expensive habit in the game.',
        severity: foldRate < 0.2 ? 'costly' : 'watch',
        sample: t.betsFaced,
      })
    }
  }

  // --- what happens when you get there -------------------------------------
  // Both directions are real findings, and the high one is the counter-intuitive
  // one worth paying for: winning almost every showdown means the hands you
  // folded on the way were winners too.
  if (t.showdowns >= DEEP_MIN_SHOWDOWNS) {
    const winRate = stats.showdownsWon / t.showdowns
    if (winRate < 0.4) {
      leaks.push({
        id: 'paying-off',
        title: 'You pay off too often at the end',
        finding: `You win ${pct(winRate)} of the ${t.showdowns} hands you take to showdown.`,
        advice:
          'The river call is the one that costs most. If the only hands that bet there beat you, the call is losing however big the pot is.',
        severity: winRate < 0.32 ? 'costly' : 'watch',
        sample: t.showdowns,
      })
    } else if (winRate > 0.75) {
      leaks.push({
        id: 'too-selective-late',
        title: 'You only show down the nuts',
        finding: `You win ${pct(winRate)} of the ${t.showdowns} hands you take to showdown, which is higher than it should be.`,
        advice:
          'That number means you are folding winners earlier. Take a medium-strength hand to the river more often and find out.',
        severity: 'watch',
        sample: t.showdowns,
      })
    } else {
      strengths.push({
        id: 'showdown',
        title: 'You show down the right hands',
        finding: `You win ${pct(winRate)} of your ${t.showdowns} showdowns.`,
        advice: 'Nothing to change here.',
        severity: 'watch',
        sample: t.showdowns,
      })
    }
  }

  // --- the table you keep going back to ------------------------------------
  // Entries and wins are counted per venue, so this is arithmetic rather than a
  // judgement. Only fires on a real sample at one table, because "0 from 3" is
  // not a pattern.
  const worst = Object.entries(venueRecords)
    .filter(([, r]) => r.entered >= 10)
    .map(([id, r]) => ({ id, ...r, rate: r.won / r.entered }))
    .sort((a, b) => a.rate - b.rate)[0]
  if (worst && worst.won === 0) {
    leaks.push({
      id: 'wrong-table',
      title: 'One table keeps taking your money',
      finding: `You have entered ${worst.id} ${worst.entered} times and not won it.`,
      advice:
        'Drop a rung and win there first. A table you never take down is paying for the practice at the worst possible price.',
      severity: 'costly',
      sample: worst.entered,
    })
  }

  // --- which way it is going ------------------------------------------------
  // The Roll at every recorded result. Halves compared rather than a fitted
  // line: a line implies a precision this sample does not have.
  if (rollHistory.length >= DEEP_MIN_RESULTS) {
    const half = Math.floor(rollHistory.length / 2)
    const mean = (points: readonly RollPoint[]) =>
      points.reduce((sum, p) => sum + p.roll, 0) / points.length
    const before = mean(rollHistory.slice(0, half))
    const after = mean(rollHistory.slice(half))
    if (after > before * 1.15) {
      strengths.push({
        id: 'trending-up',
        title: 'You are moving in the right direction',
        finding: `Across your last ${rollHistory.length} results, your Roll has averaged higher in the second half than the first.`,
        advice: 'Whatever changed, keep doing it.',
        severity: 'watch',
        sample: rollHistory.length,
      })
    } else if (after < before * 0.85) {
      leaks.push({
        id: 'trending-down',
        title: 'You are going backwards',
        finding: `Across your last ${rollHistory.length} results, your Roll has averaged lower in the second half than the first.`,
        advice:
          'This is usually stakes rather than skill. Drop a rung until the findings above stop appearing, then climb back.',
        severity: 'watch',
        sample: rollHistory.length,
      })
    }
  }

  // Worst first, and within a severity the bigger sample first: a finding drawn
  // from 400 hands outranks one drawn from 45.
  const rank = (a: Leak, b: Leak) =>
    a.severity === b.severity ? b.sample - a.sample : a.severity === 'costly' ? -1 : 1
  leaks.sort(rank)

  return { leaks, strengths, hands, waitingFor: null }
}
