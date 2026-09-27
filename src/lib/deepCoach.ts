import type { LifetimeStats, RollPoint, VenueRecord } from '@/store/profile'
import type { SeatStats } from '@/lib/reads'
import type { PricedStreet } from '@/lib/coach'
import { bbPer100, emptyReviewStats, type EvidenceKey, type ReviewStats } from '@/lib/review/stats'
import { rollTrend } from '@/lib/rollRange'

// Coaching across hands — the membership's half of the coaching line.
//
// **The split, settled long before this file (Will, 2026-07-30): the hand is
// free, the player is paid.** `lib/coach.ts` reads one hand and stays
// `HandRecord -> HandRead | null`, and it must not grow a paid branch inside
// it. This module reads what you have done across every hand you have ever
// played and names what it costs you.
//
// The rule used to be written as "nothing here imports it", and that was a
// proxy for the real one rather than the thing itself. This file now takes the
// `PricedStreet` type from there, because there is one set of four streets and
// two spellings of it would be worse. **The property being protected is that
// `lib/coach.ts` never behaves differently for a member** — it holds by there
// being nothing in that file to gate, not by an import graph. See
// docs/membership.md.
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
// - `reviewStats` — every priced decision, scored at the moment it was made
//   and summed in big blinds, since v20 (see lib/review/stats). The one input
//   that can say *where* the money goes rather than how often you fold.
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
/** How many priced decisions on a street before its cost is worth naming. */
export const DEEP_MIN_PRICED = 25
/**
 * Big blinds per hundred hands before a street is worth naming as *the* one.
 *
 * Under this it is noise dressed as a finding: the estimates behind it each
 * carry a band, and a street that has cost you a blind and a half over two
 * hundred hands has told you nothing you can act on.
 */
export const COSTLY_STREET_BB100 = 1.5

/**
 * Where a healthy number sits, per thing this file measures.
 *
 * **Named, because the report draws them.** Each finding below used to compare
 * against a literal, and the screen showed the sentence the comparison
 * produced. It now shows the number *on the band as well*, and a band typed out
 * a second time in a component is a band that disagrees with the sentence
 * beside it the first time somebody tunes one. So the meter and the verdict
 * read the same four numbers.
 *
 * `scale` is how much of the axis to draw — not a judgement, just the range a
 * human number lives in, so a marker at the far right means something.
 */
export const BANDS = {
  /** Hands entered voluntarily. */
  vpip: { band: [0.16, 0.55] as const, costlyAbove: 0.68, scale: [0, 1] as const },
  /** Share of continues that are bets or raises. */
  aggression: { band: [0.28, 0.72] as const, costlyBelow: 0.2, scale: [0, 1] as const },
  /** Share of bets faced that get folded to. */
  foldToBet: {
    band: [0.3, 0.62] as const,
    costlyAbove: 0.72,
    costlyBelow: 0.2,
    scale: [0, 1] as const,
  },
  /** Share of showdowns reached that are won. */
  showdown: { band: [0.4, 0.75] as const, costlyBelow: 0.32, scale: [0, 1] as const },
} as const

export type LeakSeverity = 'watch' | 'costly'

/**
 * The number behind a finding, ready to draw.
 *
 * Optional because not every finding has one: "you have entered The Pub nine
 * times and never won it" is a fact, not a position on a scale, and a meter
 * under it would be decoration.
 */
export interface LeakMetric {
  /**
   * What is being measured, in two or three words.
   *
   * Not the finding's title: that is a verdict ("you enter too many pots") and
   * a verdict is the wrong thing to write beside a marker on a scale. The
   * meter says *what* is plotted; the card around it says what it means.
   */
  label: string
  value: number
  /** Where a healthy number sits, from `BANDS`. */
  band: readonly [number, number]
  /** The axis to draw it on. */
  scale: readonly [number, number]
  unit: 'percent' | 'bb'
}

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
  metric?: LeakMetric
  /**
   * Which bucket of kept hands proves it, if any.
   *
   * The report's answer to "says who?" — the worst few hands this has actually
   * happened in, kept as `/hand` tokens (see lib/review/stats). A finding with
   * none is not weaker, it just is not the kind of claim a single hand can show.
   */
  evidence?: EvidenceKey
}

export interface DeepCoachInput {
  tendencies: SeatStats
  stats: LifetimeStats
  venueRecords: Record<string, VenueRecord>
  rollHistory: readonly RollPoint[]
  /**
   * The career table of priced decisions. Optional so a caller that predates it
   * — or a profile synced from a device that does — still gets a report, minus
   * the findings that need it.
   */
  reviewStats?: ReviewStats
}

/** One street's share of what the priced decisions cost. */
export interface StreetCost {
  street: PricedStreet
  /** Big blinds given up per hundred hands. */
  bbPer100: number
  /** Decisions the price could settle: right plus wrong, never the close ones. */
  settled: number
  right: number
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
  /**
   * What the priced decisions have cost, in big blinds per hundred hands, and
   * the sample under it. Null until there are enough of them.
   */
  cost: {
    bbPer100: number
    right: number
    wrong: number
    /** Inside the noise floor — neither right nor wrong, and said so. */
    close: number
    hands: number
  } | null
  /** The same, split by street, worst first. Empty below the sample. */
  streets: StreetCost[]
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
  const review = input.reviewStats ?? emptyReviewStats()
  const hands = t.handsDealt

  if (hands < DEEP_MIN_HANDS) {
    return {
      leaks: [],
      strengths: [],
      hands: null,
      cost: null,
      streets: [],
      waitingFor: `Your report opens at ${DEEP_MIN_HANDS} hands. You have played ${hands}. Anything said before that would be about the cards, not about you.`,
    }
  }

  const leaks: Leak[] = []
  const strengths: Leak[] = []

  // --- how many hands you enter --------------------------------------------
  // The bands are the ones `lib/reads.ts` already uses on opponents, so the
  // coach and the player dialog cannot describe the same behaviour two ways.
  const vpip = t.vpipHands / hands
  const vpipMetric: LeakMetric = {
    label: 'Hands entered',
    value: vpip,
    band: BANDS.vpip.band,
    scale: BANDS.vpip.scale,
    unit: 'percent',
  }
  if (vpip > BANDS.vpip.band[1]) {
    leaks.push({
      id: 'too-loose',
      title: 'You enter too many pots',
      finding: `You put chips in voluntarily on ${pct(vpip)} of hands, over ${hands} of them.`,
      advice:
        'Fold your weakest opening hands from early seats. The pots you are giving up are the ones you were going to have the worst of anyway.',
      severity: vpip > BANDS.vpip.costlyAbove ? 'costly' : 'watch',
      sample: hands,
      metric: vpipMetric,
      evidence: 'preflop-call',
    })
  } else if (vpip < BANDS.vpip.band[0]) {
    leaks.push({
      id: 'too-tight',
      title: 'You are folding your way out',
      finding: `You enter only ${pct(vpip)} of hands, over ${hands} of them.`,
      advice:
        'The blinds cost you whether you play or not. Open more hands on the button, where position pays for a weaker holding.',
      severity: 'watch',
      sample: hands,
      metric: vpipMetric,
    })
  } else {
    strengths.push({
      id: 'selection',
      title: 'Your hand selection is sound',
      finding: `You enter ${pct(vpip)} of hands, which is where it should be.`,
      advice: 'Nothing to change here.',
      severity: 'watch',
      sample: hands,
      metric: vpipMetric,
    })
  }

  // --- betting versus calling ----------------------------------------------
  const actions = t.raises + t.calls
  if (actions >= 40) {
    const aggression = t.raises / actions
    const aggressionMetric: LeakMetric = {
      label: 'Bets and raises',
      value: aggression,
      band: BANDS.aggression.band,
      scale: BANDS.aggression.scale,
      unit: 'percent',
    }
    if (aggression < BANDS.aggression.band[0]) {
      leaks.push({
        id: 'passive',
        title: 'You call far more than you bet',
        finding: `Only ${pct(aggression)} of your continues are bets or raises, over ${actions} of them.`,
        advice:
          'When you would call, ask whether betting wins the pot outright. Calling can only win a showdown; betting can win two ways.',
        severity: aggression < BANDS.aggression.costlyBelow ? 'costly' : 'watch',
        sample: actions,
        metric: aggressionMetric,
      })
    } else if (aggression > BANDS.aggression.band[1]) {
      leaks.push({
        id: 'over-aggressive',
        title: 'You bet almost everything',
        finding: `${pct(aggression)} of your continues are bets or raises, over ${actions} of them.`,
        advice:
          'Against players who do not fold, a bet with nothing is just a bigger loss. Check back your weakest hands on the river.',
        severity: 'watch',
        sample: actions,
        metric: aggressionMetric,
      })
    } else {
      strengths.push({
        id: 'aggression',
        title: 'You bet when you continue',
        finding: `${pct(aggression)} of your continues are bets or raises.`,
        advice: 'Nothing to change here.',
        severity: 'watch',
        sample: actions,
        metric: aggressionMetric,
      })
    }
  }

  // --- folding to bets ------------------------------------------------------
  if (t.betsFaced >= 40) {
    const foldRate = t.foldsToBet / t.betsFaced
    const foldMetric: LeakMetric = {
      label: 'Folds to a bet',
      value: foldRate,
      band: BANDS.foldToBet.band,
      scale: BANDS.foldToBet.scale,
      unit: 'percent',
    }
    if (foldRate > BANDS.foldToBet.band[1]) {
      leaks.push({
        id: 'folds-to-pressure',
        title: 'You are bet off too many pots',
        finding: `You fold to ${pct(foldRate)} of the bets you face, over ${t.betsFaced} of them.`,
        advice:
          'Pick one hand a session you would normally fold and call it down. Folding everything but the top of your range is the easiest thing at a table to exploit.',
        severity: foldRate > BANDS.foldToBet.costlyAbove ? 'costly' : 'watch',
        sample: t.betsFaced,
        metric: foldMetric,
        evidence: 'tight-fold',
      })
    } else if (foldRate < BANDS.foldToBet.band[0]) {
      leaks.push({
        id: 'cannot-fold',
        title: 'You do not fold enough',
        finding: `You fold to only ${pct(foldRate)} of the bets you face, over ${t.betsFaced} of them.`,
        advice:
          'Count what the pot is charging before you call. A call that is wrong by a little, made often, is the most expensive habit in the game.',
        severity: foldRate < BANDS.foldToBet.costlyBelow ? 'costly' : 'watch',
        sample: t.betsFaced,
        metric: foldMetric,
        evidence: 'loose-call',
      })
    } else {
      strengths.push({
        id: 'discipline',
        title: 'You fold about as often as you should',
        finding: `You fold to ${pct(foldRate)} of the bets you face, over ${t.betsFaced} of them.`,
        advice: 'Nothing to change here.',
        severity: 'watch',
        sample: t.betsFaced,
        metric: foldMetric,
      })
    }
  }

  // --- what happens when you get there -------------------------------------
  // Both directions are real findings, and the high one is the counter-intuitive
  // one worth paying for: winning almost every showdown means the hands you
  // folded on the way were winners too.
  if (t.showdowns >= DEEP_MIN_SHOWDOWNS) {
    const winRate = stats.showdownsWon / t.showdowns
    const showdownMetric: LeakMetric = {
      label: 'Showdowns won',
      value: winRate,
      band: BANDS.showdown.band,
      scale: BANDS.showdown.scale,
      unit: 'percent',
    }
    if (winRate < BANDS.showdown.band[0]) {
      leaks.push({
        id: 'paying-off',
        title: 'You pay off too often at the end',
        finding: `You win ${pct(winRate)} of the ${t.showdowns} hands you take to showdown.`,
        advice:
          'The river call is the one that costs most. If the only hands that bet there beat you, the call is losing however big the pot is.',
        severity: winRate < BANDS.showdown.costlyBelow ? 'costly' : 'watch',
        sample: t.showdowns,
        metric: showdownMetric,
        evidence: 'river-call',
      })
    } else if (winRate > BANDS.showdown.band[1]) {
      leaks.push({
        id: 'too-selective-late',
        title: 'You only show down the nuts',
        finding: `You win ${pct(winRate)} of the ${t.showdowns} hands you take to showdown, which is higher than it should be.`,
        advice:
          'That number means you are folding winners earlier. Take a medium-strength hand to the river more often and find out.',
        severity: 'watch',
        sample: t.showdowns,
        metric: showdownMetric,
      })
    } else {
      strengths.push({
        id: 'showdown',
        title: 'You show down the right hands',
        finding: `You win ${pct(winRate)} of your ${t.showdowns} showdowns.`,
        advice: 'Nothing to change here.',
        severity: 'watch',
        sample: t.showdowns,
        metric: showdownMetric,
      })
    }
  }

  // --- where the money actually leaves by -----------------------------------
  //
  // **This is the finding none of the rates above can make.** "You win 38% of
  // your showdowns" is true and it does not say that the river is costing four
  // big blinds a hundred hands while the flop is costing nothing. Every number
  // here is a sum of decisions that were each priced at the moment they were
  // made (lib/review/stats) — counted, not modelled.
  const streets: StreetCost[] = (['preflop', 'flop', 'turn', 'river'] as const)
    .map((street) => {
      const tally = review.byStreet[street]
      const rate = bbPer100(tally, review.hands)
      // Settled, not priced: a spot the estimate could not call is in neither
      // column, so "51 of 80" would be quietly counting it as a failure.
      const settled = tally.priced - (tally.close ?? 0)
      return rate === null ? null : { street, bbPer100: rate, settled, right: tally.right }
    })
    .filter((s): s is StreetCost => s !== null && s.settled >= DEEP_MIN_PRICED)
    .sort((a, b) => b.bbPer100 - a.bbPer100)

  const leakiest = streets[0]
  if (leakiest && leakiest.bbPer100 >= COSTLY_STREET_BB100) {
    leaks.push({
      id: `leaky-${leakiest.street}`,
      title: `The ${leakiest.street} is where it goes`,
      finding: `Your ${leakiest.street} calls have given up ${leakiest.bbPer100.toFixed(1)} big blinds per hundred hands, over ${leakiest.settled} priced decisions.`,
      advice:
        leakiest.street === 'river'
          ? 'The last call is the one with nothing behind it. Fold the hands that only beat a bluff.'
          : `Take one ${leakiest.street} spot a session that you would normally continue, and work out what the pot is charging before you do.`,
      severity: leakiest.bbPer100 >= 4 ? 'costly' : 'watch',
      sample: leakiest.settled,
      evidence: leakiest.street === 'river' ? 'river-call' : undefined,
    })
  }

  // Which way the mistakes go, when there are enough of them to have a shape.
  const calls = review.calls
  const folds = review.folds
  if (calls.priced + folds.priced >= DEEP_MIN_PRICED * 2) {
    const callCost = calls.bbLost
    const foldCost = folds.bbLost
    if (callCost > foldCost * 2) {
      leaks.push({
        id: 'costly-calls',
        title: 'Your mistakes are calls',
        finding: `Of the big blinds you have given up at priced spots, ${pct(callCost / (callCost + foldCost))} went on calls rather than folds, over ${calls.priced + folds.priced} decisions.`,
        advice:
          'You are not folding too much — you are calling too much. The cheapest fix in poker is one more fold a session with the hand you talked yourself into.',
        severity: 'watch',
        sample: calls.priced + folds.priced,
        evidence: 'loose-call',
      })
    } else if (foldCost > callCost * 2) {
      leaks.push({
        id: 'costly-folds',
        title: 'Your mistakes are folds',
        finding: `Of the big blinds you have given up at priced spots, ${pct(foldCost / (callCost + foldCost))} went on folds rather than calls, over ${calls.priced + folds.priced} decisions.`,
        advice:
          'The pots you are laying down were worth the price. When the pot is big and the bet is small, the odds do not care how much you dislike your hand.',
        severity: 'watch',
        sample: calls.priced + folds.priced,
        evidence: 'tight-fold',
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
    // The same function the graph's own sentence uses (lib/rollRange), so a
    // finding here and the line above the chart cannot disagree about which
    // way a run of results went.
    const trend = rollTrend(rollHistory)
    if (trend === 'up') {
      strengths.push({
        id: 'trending-up',
        title: 'You are moving in the right direction',
        finding: `Across your last ${rollHistory.length} results, your Roll has averaged higher in the second half than the first.`,
        advice: 'Whatever changed, keep doing it.',
        severity: 'watch',
        sample: rollHistory.length,
      })
    } else if (trend === 'down') {
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

  const close = (calls.close ?? 0) + (folds.close ?? 0)
  const settled = calls.priced + folds.priced - close
  const cost =
    settled >= DEEP_MIN_PRICED
      ? {
          bbPer100: ((calls.bbLost + folds.bbLost) / review.hands) * 100,
          right: calls.right + folds.right,
          wrong: settled - (calls.right + folds.right),
          close,
          hands: review.hands,
        }
      : null

  return { leaks, strengths, hands, waitingFor: null, cost, streets }
}
