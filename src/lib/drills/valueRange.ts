import type { Card } from '@/lib/poker/cards'
import { categoryOf, fastScore, type riverRange } from './riverRange'

// Who calls a river bet, as a set of hands you can count.
//
// The river pack's range (./riverRange) answers "what bets like this". This is
// the same range read from the other side of the table: you have a hand, it is
// checked to you on the river, and the question is what calls if you bet. It is
// built on the same list of hands — `riverRange`, with the line read as what
// *they* did with their chips — so the two packs can never describe the same
// player two ways.
//
// **The line, read for a caller.** A street where you bet and they called is a
// street where they put chips in, and `riverRange` already says what that
// means: a pair of their own or a draw (`hasSomething`). Calling a bet with
// nothing is a float; it happens, and leaving it out is the cautious direction
// here, because a float that missed is a hand you beat. A street checked
// through removes nothing, and **nor does their check on the river** — the
// river model's own rule (a check tells you nothing), and in their favour: it
// keeps their strong hands in the range, which only ever makes a value bet
// look worse.
//
// **The model, in the words the lesson uses.** A river bet is called by:
//
// 1. **The better part of their made hands** — a pair or better that uses one
//    of their own cards — taken strongest first. How much of them depends on
//    the size: a bigger bet is called by fewer. See {@link CALL_SHARES}.
// 2. **A few hands that missed**, at a small weight. Every one of them is a
//    hand you beat (you have a pair of your own and they do not), so this is
//    the only part of the model that can make a bet look better, and it is
//    kept small for that reason. See {@link MISSED_CALLS}.
//
// Nobody raises. They do sometimes (about one river bet in twelve, measured
// below), and a raise can only cost a value bet, so leaving it out is the one
// simplification in the bettor's favour — the margin is there to pay for it.
//
// **Where the shares come from: measured, not chosen.** 12,000 heads-up hands
// per profile between the app's own bots (`decideAction`, the Garage's, the
// Casino's and the Main Event's profiles, iterations held at 300 for time,
// 2026-09-24), counting every river bet into an unbet pot and what the player
// facing it did, placed against this model's range for the cards the bettor
// held. "Share" is the cut that, taken strongest first, calls exactly as many of
// the made hands the bots actually held as the bots called with:
//
// | bet | the Garage | the Casino | the Main Event | made hands called, all three |
// |---|---|---|---|---|
// | about half the pot       | 73% (n=340) | 83% (n=163) | 86% (n=212) | 49–54% |
// | two-thirds to three-quarters | 70% (n=372) | 60% (n=493) | 61% (n=322) | 38–45% |
// | the pot or more          | —           | —           | 64% (n=124) | 35% |
//
// And of the hands that missed, 2–14% called by room and size (55 of 622 at half
// the pot, 65 of 1,093 at two-thirds and up, across the three). 313 of the
// 3,765 bets were raised. The bots almost never bet a
// third of the pot, so that size is not offered: a share for it would be a
// guess.
//
// So each size carries a band rather than a number ({@link CALL_SHARES}), wide
// enough to hold all three rooms, and the pack only asks a spot whose answer
// is the same at every cut inside the band and at both ends of the missed-hand
// weight — the river pack's rule, that the answer may not depend on who is
// sitting there.
//
// **The criterion.** Betting B into a pot P, against their range split into
// hands that call (C) and hands that fold (F), with e your share of the pot
// against each hand (1 a win, ½ a tie, 0 a loss):
//
//     EV(bet) − EV(check) = B × Σ_C (2e − 1)  +  P × Σ_F (1 − e)
//
// The first term is value: each caller pays B when you win and takes B when
// you lose, so it is positive exactly when you win **more than half** of the
// calls. The second is what folding hands would have won at showdown, which is
// never negative. So a bet is right whenever you beat more than half of what
// calls ({@link valueCount}'s `equity` > ½), and the pack asks it as a bet only
// then, clear of the margin. It asks a check only when the whole difference —
// folds included — is negative by the margin, so a check is never marked right
// on a spot where betting would have won through folds.

/** A bet as a share of the pot, and the band of their made hands that call it. */
export interface CallShare {
  /** Bets at or under this fraction of the pot take this band. */
  upTo: number
  tight: number
  loose: number
}

/**
 * How much of their made hands call, by bet size: strongest first, a band
 * rather than a number. Read off the table in the header, rounded out to hold
 * all three rooms.
 */
export const CALL_SHARES: readonly CallShare[] = [
  { upTo: 0.55, tight: 0.7, loose: 0.9 },
  { upTo: 0.8, tight: 0.55, loose: 0.75 },
  { upTo: Number.POSITIVE_INFINITY, tight: 0.45, loose: 0.7 },
]

/** How much each hand that missed counts as a caller: the measured 2–14%, pulled in a little. */
export const MISSED_CALLS = { low: 0.02, typical: 0.07, high: 0.12 } as const

/** The band for a bet of this size. */
export function callShare(fraction: number): CallShare {
  return CALL_SHARES.find((band) => fraction <= band.upTo) as CallShare
}

type Combo = ReturnType<typeof riverRange>[number]

/** Your hand against their range, sorted and counted once, before any cut. */
export interface Counted {
  /** Their made hands, strongest first, each with your share of the pot against it. */
  made: { score: number; e: number }[]
  /** How many hands that missed (you beat every one). */
  missed: number
}

/**
 * Your hand against every hand in their range, once. Split from the cut below
 * because the generator asks the same count at every size and every cut.
 */
export function countAgainst(
  hero: readonly Card[],
  board: readonly Card[],
  range: readonly Combo[],
): Counted {
  const mine = fastScore([...hero, ...board])
  const made = range
    .filter((combo) => combo.made)
    .map((combo) => ({
      score: combo.score,
      e: mine > combo.score ? 1 : mine === combo.score ? 0.5 : 0,
    }))
    .sort((x, y) => y.score - x.score)
  // A hand that missed has nothing of its own, so it is the board's hand plus
  // kickers; yours is a category above the board (the generator only deals
  // those), so you beat all of them. tests/valueRange.test.ts holds it.
  const missed = range.filter((combo) => !combo.made).length
  return { made, missed }
}

/** How many of the made hands a share keeps: never splitting a tie, never none. */
export function keepCount(made: Counted['made'], share: number): number {
  if (made.length === 0) return 0
  const keep = Math.max(1, Math.ceil(made.length * share))
  const cut = made[Math.min(keep, made.length) - 1].score
  let n = keep
  while (n < made.length && made[n].score === cut) n++
  return n
}

/** Your hand against one calling range: a cut of the made hands and a weight on the misses. */
export interface ValueCount {
  /** Hands that call, weighted (the misses count at their weight). */
  calls: number
  /** Of those, the ones you beat (a tie counts half). */
  beaten: number
  /** Your share of the pot against the calling hands. */
  equity: number
  /**
   * `EV(bet) − EV(check)`, in chips, for a bet of `bet` into `pot`. The line in
   * the header, term for term.
   */
  gain: number
  /**
   * The gain said as a share, so it sits on the same scale as `equity`: half,
   * plus the gain over what the callers put in. Equal to `equity` when nothing
   * that folds would have beaten you, and never below it.
   */
  effective: number
  /** How many made hands call (unweighted), strongest first: the cut. */
  madeCalls: number
}

/** The count at one cut of the made hands and one weight on the misses. */
export function valueCount(
  counted: Counted,
  keep: number,
  missedWeight: number,
  bet: number,
  pot: number,
): ValueCount {
  let beatenMade = 0
  let valueTerm = 0
  let foldTerm = 0
  counted.made.forEach((hand, i) => {
    if (i < keep) {
      beatenMade += hand.e
      valueTerm += 2 * hand.e - 1
    } else {
      foldTerm += 1 - hand.e
    }
  })
  const missedCalls = counted.missed * missedWeight
  // A miss that calls is a win (2e − 1 = 1); one that folds would have lost at
  // showdown anyway (1 − e = 0).
  valueTerm += missedCalls
  const calls = keep + missedCalls
  const beaten = beatenMade + missedCalls
  const gain = bet * valueTerm + pot * foldTerm
  return {
    calls,
    beaten,
    equity: calls === 0 ? 0 : beaten / calls,
    gain,
    effective: calls === 0 ? 0.5 : 0.5 + gain / (2 * bet * calls),
    madeCalls: keep,
  }
}

/** The whole band for one size: every cut from tight to loose, at both miss weights, and the typical one. */
export interface ValueBand {
  typical: ValueCount
  /** Every count inside the band. The answer has to hold at all of them. */
  all: ValueCount[]
}

/**
 * Every calling range the model allows for this size, counted. The cut moves
 * one hand at a time from the tight end to the loose, so nothing between the
 * two ends goes unchecked; the miss weight only ever pushes one way (every miss
 * is a hand you beat), so its two ends are enough.
 */
export function valueBand(counted: Counted, bet: number, pot: number): ValueBand {
  const band = callShare(bet / pot)
  const lo = keepCount(counted.made, band.tight)
  const hi = keepCount(counted.made, band.loose)
  const all: ValueCount[] = []
  for (let keep = lo; keep <= hi; keep++) {
    for (const w of [MISSED_CALLS.low, MISSED_CALLS.high]) {
      all.push(valueCount(counted, keep, w, bet, pot))
    }
  }
  const middle = keepCount(counted.made, (band.tight + band.loose) / 2)
  return { typical: valueCount(counted, middle, MISSED_CALLS.typical, bet, pot), all }
}

/** The hands that call at a cut, grouped the way a player names them. */
export function callingGroups(
  counted: Counted,
  keep: number,
  missedWeight: number,
): { label: string; hands: number; beaten: number }[] {
  const labels: Record<number, string> = {
    2: 'One pair',
    3: 'Two pair',
    4: 'Three of a kind',
    5: 'Straights',
    6: 'Flushes',
  }
  const groups = new Map<string, { label: string; hands: number; beaten: number }>()
  for (const hand of counted.made.slice(0, keep)) {
    const label = labels[categoryOf(hand.score)] ?? 'Full house or better'
    const group = groups.get(label) ?? { label, hands: 0, beaten: 0 }
    group.hands += 1
    group.beaten += hand.e
    groups.set(label, group)
  }
  // Strongest first, because the made hands were; the misses, all beaten, last.
  const out = [...groups.values()]
  const misses = counted.missed * missedWeight
  if (misses > 0) out.push({ label: 'Missed', hands: misses, beaten: misses })
  return out
}
