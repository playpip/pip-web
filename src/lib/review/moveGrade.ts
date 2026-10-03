/**
 * Every move you made, graded against the cards they actually held.
 *
 * **This is a different question from the one `lib/coach.ts` asks, and both are
 * worth asking.** The coach reads only what you could see — the pot, the price,
 * how tight their range looked — because that is the judgement that transfers
 * to the next hand, and it is what the report is built on. This reads the hand
 * with every card face up and asks what each move was actually worth. It is
 * hindsight, on purpose: a review is the one place hindsight is the point, and
 * it is the only way to say anything at all about a bet.
 *
 * **So bets do get graded here** (Will, 2026-09-21), and the thing that makes
 * that honest is that nothing is guessed. Two cases, both arithmetic:
 *
 * - **They folded.** You took the pot. Against a hand that was only worth
 *   `equity` of it, the bet made `pot × (1 − equity)` — which is why a bluff
 *   that works is worth *more* the worse your hand was. A good bluff is a real
 *   thing and this can prove it.
 * - **They called.** You are in a pot of `pot + 2B` having put in `B`, so
 *   against checking it behind the bet made `B × (2 × equity − 1)`. Positive
 *   above half, negative below — betting into a better hand costs you, and the
 *   number says how much.
 *
 * **One street, and the honest limits stated.** It assumes the hand plays no
 * further and prices no implied odds, the same simplification the free read
 * makes. A raise is read as a bet of what it added. And a check commits nothing,
 * so it cannot be graded at all — a missed value bet needs fold equity, and
 * that is the guess this file refuses to make.
 *
 * **Everybody at the table is graded, not only you** (Will, 2026-09-21).
 * Watching where the table went wrong is most of what makes a replay worth
 * stepping through, and it costs nothing extra: the price each player faced
 * comes off the same recorded `committed` maps, so nobody's turn needs a
 * snapshot of its own.
 */

import { showdownOdds, type ShowdownOdds } from '@/lib/poker/equity'
import type { Card } from '@/lib/poker/cards'
import type { HandRecord } from '@/store/game'
import { HERO_ID, handStateAt } from './handState'

export type MoveVerdict = 'brilliant' | 'good' | 'standard' | 'mistake' | 'blunder'

/**
 * Was this hand recorded with everything a rating needs?
 *
 * False for **every hand played before 2026-09-21**, when the chips in front of
 * each player started being kept. The symptom without this check was the
 * opponents' moves silently showing no rating while the player's own still did:
 * the hero's actions carry their own price snapshot, so they survived where
 * nobody else's could. The screen says the hand is too old instead.
 */
export function gradeable(record: HandRecord): boolean {
  return record.events.some((ev) => ev.kind === 'action' && ev.committed !== undefined)
}

export interface MoveGrade {
  eventIndex: number
  /** Whose move it was. */
  playerId: string
  verdict: MoveVerdict
  /** Big blinds the move gained (+) or cost (−) against the alternative. */
  bb: number
  /** Your exact share against the cards they actually held, 0–1. */
  equity: number
  /** Was that share dealt out exhaustively, or sampled? */
  exact: boolean
  /** One line, ready to render. */
  line: string
}

/**
 * Big blinds either way below which a move had no real edge in it.
 *
 * The label for that band is **"Standard"** rather than "Fine" (Will,
 * 2026-09-21): "fine" is what you say about something that was nearly a
 * mistake, and most moves in most hands land here honestly — a check, a call
 * that was neither here nor there. The word has to be neutral, because the
 * finding is.
 */
const STANDARD_BB = 0.5
/** And above which a mistake is a blunder. */
const BLUNDER_BB = 4
/**
 * How far behind you have to have been for a winning move to be brilliant.
 *
 * Betting 95% equity and getting paid is good play and it is not a moment of
 * inspiration. Taking a pot down with a third of it, or calling one off and
 * being right, is.
 */
const BRILLIANT_EQUITY = 0.35
/** And how much it has to have been worth. */
const BRILLIANT_BB = 2

export const MOVE_LABELS: Record<MoveVerdict, string> = {
  brilliant: 'Brilliant',
  good: 'Good',
  standard: 'Standard',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

function verdictFor(bb: number, equity: number): MoveVerdict {
  if (bb >= BRILLIANT_BB && equity < BRILLIANT_EQUITY) return 'brilliant'
  if (bb >= STANDARD_BB) return 'good'
  if (bb > -STANDARD_BB) return 'standard'
  return bb <= -BLUNDER_BB ? 'blunder' : 'mistake'
}

const pct = (n: number) => `${Math.round(n * 100)}%`

/**
 * A chip count, **in chips**, or null when there is nothing to report.
 *
 * The verdict bands are in big blinds, because four chips at Friends' Garage
 * and four at The Main Event are not the same mistake. The sentence is in
 * chips, because that is what the player actually pushed across the table and
 * because "24.3bb" means nothing at all to somebody who has not played before
 * (Will, 2026-09-21). One hand, one blind level — so the two never disagree
 * about which way it went.
 *
 * Under half a chip there is nothing to report, so the clause is dropped rather
 * than rounding to a number it does not mean.
 */
function chipsOf(chips: number, money: (n: number) => string): string | null {
  const size = Math.round(Math.abs(chips))
  if (size < 1) return null
  return `${money(size)} ${size === 1 ? 'chip' : 'chips'}`
}

/**
 * The sentence after the read: what the move made or lost, in chips.
 *
 * **Written for somebody in their first week** (Will, 2026-10-03). The old
 * lines — "Bet into a better hand — you had about 22% of it. It cost 68 chips."
 * — assumed the player already knew what "22% of it" was a share of. Each line
 * now says who held what, the chance to win as a plain percentage, and what the
 * move did to their chips.
 */
function chipsLine(
  chips: number,
  money: (n: number) => string,
  gained: (c: string) => string,
  lost: (c: string) => string,
): string {
  const c = chipsOf(chips, money)
  if (!c) return ''
  return ` ${chips >= 0 ? gained(c) : lost(c)}`
}

/**
 * Grade the action at `eventIndex`, whoever made it, or `null` where there is
 * nothing to grade: a board card, a discard, or a spot with nobody left to be
 * ahead of.
 *
 * Computed on demand rather than stored. It is a few hundred showdowns — the
 * same cost the seat badges already pay for the step you are looking at — and
 * storing it would put a number on the profile that a later change to this
 * arithmetic could not correct.
 */
export function gradeMove(
  record: HandRecord,
  eventIndex: number,
  /**
   * How to work out who is ahead. Defaults to dealing the boards out here.
   *
   * The screen passes a memoised one: a step already pays for this arithmetic
   * to draw the seat badges, and the answer only changes when the board or the
   * set of live hands does. Without that, holding the arrow key recomputed a
   * few thousand showdowns twice per press (Will, 2026-09-21).
   */
  solve: (
    hands: readonly { id: string; hole: readonly Card[] }[],
    board: readonly Card[],
  ) => ShowdownOdds = showdownOdds,
  /** How the player has chosen to see chips. */
  money: (n: number) => string = (n) => n.toLocaleString(),
): MoveGrade | null {
  const event = record.events[eventIndex]
  if (!event || event.kind !== 'action' || event.type === 'draw') return null

  const before = handStateAt(record, eventIndex)
  const actor = before.hand.players.find((p) => p.id === event.playerId)
  if (!actor || actor.hole.length < 2) return null
  const others = before.hand.players.filter(
    (p) => p.id !== actor.id && p.status !== 'folded' && p.hole.length >= 2,
  )
  if (others.length === 0) return null

  const pot = before.pot
  if (pot === null) return null
  const bb = record.bigBlind || 1
  const mine = actor.id === HERO_ID

  const odds = solve(
    [{ id: actor.id, hole: actor.hole }, ...others.map((p) => ({ id: p.id, hole: p.hole }))],
    before.hand.community,
  )
  const equity = odds.share[actor.id] ?? 0
  const about = odds.exact ? '' : 'about '
  const chance = `${about}${pct(equity)}`
  // "Your chance to win was 22%." / "Sam's chance to win was 22%."
  const theirChance = `${mine ? 'Your' : `${actor.name}’s`} chance to win was ${chance}.`
  const base = { eventIndex, playerId: actor.id, equity, exact: odds.exact }

  if (event.type === 'check') {
    return { ...base, verdict: 'standard', bb: 0, line: `No chips put in. ${theirChance}` }
  }

  // What it cost to stay in, from the chips already in front of everybody —
  // which is how every seat gets priced the same way rather than one of them
  // being a special case.
  //
  // **A record that never kept them is not priced at all**, rather than priced
  // at zero: "nothing to pay" is a claim, and a hand from before those maps
  // existed cannot support it. The hero's own snapshot is used where it exists,
  // since it is the authoritative number for that seat.
  const priceable = gradeable(record)
  const currentBet = Math.max(...before.hand.players.map((p) => p.committedThisStreet))
  //
  // A short stack calls for what it has, as the engine charges it
  // (`callAmount`), and the hero's snapshot is already that number.
  const facing = Math.max(0, currentBet - actor.committedThisStreet)
  const toCall =
    event.decision?.toCall ??
    (priceable ? (actor.stack > 0 ? Math.min(facing, actor.stack) : facing) : null)

  if (event.type === 'call' || event.type === 'fold') {
    if (toCall === null) return null
    if (toCall <= 0) {
      return { ...base, verdict: 'standard', bb: 0, line: `Nothing to pay. ${theirChance}` }
    }
    // What calling was worth, with every card face up. Chips bet this street
    // past what this call can match are a side pot this seat cannot win, so
    // they come out of the pot it is playing for.
    const reach = actor.committedThisStreet + toCall
    const uncalled = before.hand.players.reduce(
      (sum, p) => sum + (p.id === actor.id ? 0 : Math.max(0, p.committedThisStreet - reach)),
      0,
    )
    const callValue = equity * (pot - uncalled + toCall) - toCall
    const gained = event.type === 'call' ? callValue : -callValue
    const asBb = gained / bb
    const line =
      event.type === 'call'
        ? `${theirChance}${chipsLine(
            gained,
            money,
            (c) => `That was enough to call. On average, calling here wins ${c}.`,
            (c) => `That was too low to call. On average, calling here loses ${c}.`,
          )}`
        : `${theirChance}${chipsLine(
            gained,
            money,
            (c) => `That was too low to call, so folding saved ${c} on average.`,
            (c) => `That was enough to call. On average, folding here gives up ${c}.`,
          )}`
    return { ...base, verdict: verdictFor(asBb, equity), bb: asBb, line }
  }

  // --- bets and raises: what the chips going in actually did
  const put = Math.max(0, (event.amount ?? 0) - actor.committedThisStreet)
  if (put <= 0) return null
  const folds = everyoneFolded(
    record,
    eventIndex,
    actor.id,
    others.map((p) => p.id),
  )
  const gained = folds ? pot * (1 - equity) : put * (2 * equity - 1)
  const asBb = gained / bb
  const head = folds
    ? equity < 0.5
      ? `Everyone folded, so ${mine ? 'you' : actor.name} took the pot with the worse hand. ${theirChance}`
      : `Everyone folded, and ${mine ? 'you' : actor.name} had the best hand anyway. ${theirChance}`
    : equity >= 0.5
      ? `Called by a worse hand. ${theirChance}`
      : `Called by a better hand. ${theirChance}`
  const action = event.type === 'raise' ? 'raise' : 'bet'
  return {
    ...base,
    verdict: verdictFor(asBb, equity),
    bb: asBb,
    line: `${head}${chipsLine(
      gained,
      money,
      (c) =>
        folds
          ? `The ${action} won ${c} more than a showdown would have.`
          : `On average, a ${action} here wins ${c}.`,
      (c) => `On average, a ${action} here loses ${c}.`,
    )}`,
  }
}

/**
 * Did everybody else fold to this bet, before the street moved on?
 *
 * The street is the window because that is as far as this arithmetic reaches. A
 * player who folds on the next street folded to a different bet.
 */
function everyoneFolded(
  record: HandRecord,
  from: number,
  actorId: string,
  ids: readonly string[],
): boolean {
  const outstanding = new Set(ids)
  for (let i = from + 1; i < record.events.length; i++) {
    const ev = record.events[i]
    if (ev.kind === 'board') break
    if (ev.playerId === actorId) continue
    if (ev.type === 'fold') outstanding.delete(ev.playerId)
    // A call or a raise ends it: somebody is still there.
    else if (ev.type === 'call' || ev.type === 'bet' || ev.type === 'raise') return false
  }
  return outstanding.size === 0
}
