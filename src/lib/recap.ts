/**
 * The recap of the tournament you just played. One run, reported once.
 *
 * Shown on the end-of-tournament overlay: how the run went, the one moment
 * worth naming, how you played it, and the career numbers it moved. Then it is
 * gone. There is no recap inbox and nothing here remembers it, because a card
 * you can go back to is a history, and a history is the thing that turns a
 * report into pressure.
 *
 * **Nothing new is persisted.** Every fact below is derived at tournament end
 * from what the game store already tracks and what the profile already stores,
 * so this feature adds no `PERSIST_VERSION` traffic and cannot corrupt a save.
 * The run's own tallies (biggest pot, knockouts, bounty) ride in the existing
 * refresh-resume snapshot, which is transient by design.
 *
 * **It reports, it never nags.** No streaks, no "come back tomorrow", no
 * comparison with yesterday. `lib/daily.ts` is the house position and this
 * follows it.
 *
 * **Honest arithmetic only.** Every line is a count or a ratio of real hands,
 * with a noise floor under it. A three-hand run says less rather than saying
 * something confident and wrong: the style read wants `STYLE_MIN_HANDS` (the
 * same floor `/stats` uses), the comparison against your usual wants that much
 * history too, and none of it is invented.
 *
 * **One run, and it stays one run.** Coaching *across* runs (trends, leaks,
 * tracked progress) is the membership's surface. Widening this to "your last
 * ten sessions" is a monetisation decision, not a copy tweak, because the
 * standing rule says anything shipped free is free forever. Keeping the input
 * to a single `RunSummary` is the cheapest way to stop that boundary eroding
 * by accident: a trend needs a second run, and there is nowhere to put one.
 */

import { derivePlayStyle } from './playStyle'
import type { SeatStats } from './reads'
import { formatChips } from './useMoney'

/**
 * Everything the recap is allowed to know: one finished tournament, plus the
 * career numbers it is measured against. Assembled by the game store at the
 * moment the run ends (see `finishHand`).
 */
export interface RunSummary {
  /** Where it was played, for the career line. */
  venueName: string
  /** Finishing position, 1 = won it. */
  place: number
  /** Seats the tournament started with, so "3rd of 6" is the whole truth. */
  seats: number
  /** Hands dealt before it ended. */
  hands: number
  /** Roll change across the run: prize and bounties in, buy-in out. */
  rollDelta: number
  /** The hero's tendencies for this run alone. */
  runStats: SeatStats
  /** Lifetime tendencies as they stood *before* this run started. */
  lifetimeBefore: SeatStats
  /** Lifetime tendencies now, this run included. */
  lifetimeAfter: SeatStats
  /** The biggest pot the hero won this run, in chips. 0 if they won none. */
  biggestPot: number
  /** What the hero showed for that pot, when it went to showdown. */
  bigPotHand: { name: string; description: string } | null
  /** Who that pot busted, if anyone. Names, in seat order. */
  bigPotKos: string[]
  /** Did this run set a new peak Roll? */
  newPeak: boolean
  /** The peak Roll now. */
  peakRoll: number
  /** Best finish at this venue *before* this run; null on a first visit. */
  bestFinishBefore: number | null
}

/** A headline number, shown as a small labelled column. */
export interface RecapStat {
  label: string
  value: string
}

/** One sentence. `id` keys the list and lets tests assert on presence. */
export interface RecapLine {
  id: 'highlight' | 'style' | 'peak' | 'venue' | 'archetype'
  text: string
}

export interface Recap {
  stats: RecapStat[]
  lines: RecapLine[]
}

/**
 * Bets and calls needed before the aggression axis means anything. Looseness
 * has `STYLE_MIN_HANDS` hands under it; aggression is counted per action, and a
 * run where you folded almost everything can clear the hand floor with three
 * actions on the board. Two different samples, two different floors.
 */
const AGGRO_MIN_ACTIONS = 10

/**
 * How far a run has to sit from your usual before the recap calls it a
 * difference. Twenty hands puts roughly ±11 points of noise on a rate near a
 * half, so anything under this is the sample talking.
 */
const MIN_GAP = 0.1

export function buildRecap(s: RunSummary): Recap {
  return {
    stats: [
      { label: 'Finish', value: s.place === 1 ? 'Won it' : `${ordinal(s.place)} of ${s.seats}` },
      { label: 'Hands', value: String(s.hands) },
      { label: 'Roll', value: signedChips(s.rollDelta) },
    ],
    lines: [highlight(s), style(s), ...career(s)].filter((l): l is RecapLine => l !== null),
  }
}

/**
 * The run's one moment: the biggest pot you won, what you showed for it, and
 * whose chips it took.
 *
 * One moment rather than three separate bests on purpose. "Biggest pot", "best
 * hand" and "a knockout" are usually the same hand anyway, so listing them
 * separately reads as three achievements where there was one.
 */
function highlight(s: RunSummary): RecapLine | null {
  if (s.biggestPot <= 0) return null
  const made = s.bigPotHand ? handPhrase(s.bigPotHand) : null
  const won = made ? `, won with ${made}` : ''
  const took = s.bigPotKos.length > 0 ? ` It took ${nameList(s.bigPotKos)} out.` : ''
  return {
    id: 'highlight',
    text: `Your biggest pot was ${formatChips(s.biggestPot)} chips${won}.${took}`,
  }
}

/**
 * One read on how you played *this* run, against how you usually play.
 *
 * The axis shown is whichever moved further from your usual, so the line says
 * the most interesting true thing rather than always the same one. With too
 * little history to compare against, the run's own number is still a fact and
 * gets reported on its own. With too little of the run itself, nothing is said.
 */
function style(s: RunSummary): RecapLine | null {
  const run = derivePlayStyle(s.runStats)
  if (!run.ready) return null

  const usual = derivePlayStyle(s.lifetimeBefore)
  const looseGap = run.looseness - usual.looseness
  const aggroGap = run.aggression - usual.aggression
  // Aggression is only comparable when both samples have enough actions in
  // them; the run can clear the hand floor while barely committing a chip.
  const aggroReady =
    actions(s.runStats) >= AGGRO_MIN_ACTIONS && actions(s.lifetimeBefore) >= AGGRO_MIN_ACTIONS
  const comparable = usual.ready

  if (
    comparable &&
    aggroReady &&
    Math.abs(aggroGap) >= MIN_GAP &&
    Math.abs(aggroGap) > Math.abs(looseGap)
  ) {
    return {
      id: 'style',
      text:
        `You raised rather than called ${pct(run.aggression)} of the time this run, ` +
        `${aggroGap > 0 ? 'more' : 'less'} aggressive than your usual ${pct(usual.aggression)}.`,
    }
  }
  if (comparable && Math.abs(looseGap) >= MIN_GAP) {
    return {
      id: 'style',
      text:
        `You played ${pct(run.looseness)} of your hands this run, ` +
        `${looseGap > 0 ? 'looser' : 'tighter'} than your usual ${pct(usual.looseness)}.`,
    }
  }
  return { id: 'style', text: `You played ${pct(run.looseness)} of your hands this run.` }
}

/** Career context, and only where it actually moved. */
function career(s: RunSummary): RecapLine[] {
  const lines: RecapLine[] = []
  if (s.newPeak) {
    lines.push({ id: 'peak', text: `A new best Roll: ${formatChips(s.peakRoll)} chips.` })
  }
  if (s.bestFinishBefore !== null && s.place < s.bestFinishBefore) {
    lines.push({ id: 'venue', text: `Your best finish at ${s.venueName} yet.` })
  }
  const before = derivePlayStyle(s.lifetimeBefore)
  const after = derivePlayStyle(s.lifetimeAfter)
  if (before.ready && after.ready && before.key !== after.key) {
    lines.push({
      id: 'archetype',
      text: `Across everything you’ve played, you now read as ${after.name}.`,
    })
  }
  return lines
}

const actions = (t: SeatStats) => t.raises + t.calls

const pct = (x: number) => `${Math.round(x * 100)}%`

function signedChips(delta: number): string {
  if (delta === 0) return '0'
  return `${delta > 0 ? '+' : '-'}${formatChips(Math.abs(delta))}`
}

/**
 * "a full house" / "two pair". The article is part of the phrase because
 * English will not give it up. Names come from the evaluator (pokersolver via
 * `lib/poker/handEval`); anything unrecognised returns null and the clause is
 * simply left off, rather than shipping "won with undefined".
 */
const HAND_PHRASES: Record<string, string> = {
  'High Card': 'high card',
  Pair: 'a pair',
  'Two Pair': 'two pair',
  'Three of a Kind': 'three of a kind',
  Straight: 'a straight',
  Flush: 'a flush',
  'Full House': 'a full house',
  'Four of a Kind': 'four of a kind',
  // A royal is a straight flush by name; only the description tells them apart.
  'Straight Flush': 'a straight flush',
}

function handPhrase(hand: { name: string; description: string }): string | null {
  if (hand.description === 'Royal Flush') return 'a royal flush'
  return HAND_PHRASES[hand.name] ?? null
}

/** "Frank", "Frank and Vivienne", "Frank, Vivienne and Marta". */
function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** "1st", "2nd", "23rd". Shared with the end-of-tournament overlay. */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
