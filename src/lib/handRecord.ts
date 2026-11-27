// The record of one finished hand: what the table keeps between hands, what
// the review replays and what a game on the account stores (docs/games.md).
// Types only, in a file of their own so the room server, which writes these
// for multiplayer hands, never reaches the game store to read them.

import type { AvatarSpec } from '@/lib/avatar'
import type { HeroDecision } from '@/lib/coach'
import type { Card } from '@/lib/poker/cards'
import type { Action } from '@/lib/poker/engine'

// A lightweight timeline of the previous hand, recorded as it plays so the
// player can review "wait, what just happened?" between hands.

export interface HandActionEvent {
  kind: 'action'
  playerId: string
  playerName: string
  type: Action['type']
  /** Chips: the call size, or the total a bet/raise was to. */
  amount?: number
  /**
   * What the hero could see as they made this call. The hero's actions only,
   * and only while the hand is live. Feeds the post-hand read (see lib/coach).
   *
   * Recorded here rather than worked out afterwards on purpose: the pot at a
   * given moment can be rebuilt from the event list, but only by replaying
   * blinds and per-street totals, and that arithmetic would go wrong silently.
   * Taken from the live `HandState`, it cannot. It is also the guardrail: the
   * snapshot holds what was on screen, so a read built from it cannot reach
   * for a card the player never saw.
   *
   * Not carried by the `/hand` permalink wire format, so a decoded hand has
   * none of these and gets no read. That is the intended behaviour.
   */
  decision?: HeroDecision
  /**
   * The pot, and every stack, immediately after this action.
   *
   * Recorded rather than rebuilt for the same reason `decision` is: the pot at
   * a given moment *can* be derived by replaying blinds and per-street totals
   * out of the event list, and that arithmetic goes quietly wrong. Taken off
   * the live `HandState` it cannot, and the review can draw the table exactly
   * as it stood at any step instead of approximately.
   *
   * Optional because a hand recorded before the review shipped has neither,
   * and a plain (v1) `/hand` permalink does not carry them. A review link (v2,
   * lib/handLink) does, which is what lets it open on the felt.
   */
  pot?: number
  stacks?: Record<string, number>
  /** Chips in front of each player this betting round, after this action. */
  committed?: Record<string, number>
}

export interface HandBoardEvent {
  kind: 'board'
  /** "Flop" | "Turn" | "River" | "Runout" (all-in deal-outs). */
  label: string
  cards: Card[]
}

export type HandEvent = HandActionEvent | HandBoardEvent

export interface HandRecord {
  handNo: number
  smallBlind: number
  bigBlind: number
  events: HandEvent[]
  community: Card[]
  /** Hole cards known at the end: the hero's always, everyone live at showdown. */
  reveals: { playerId: string; playerName: string; cards: Card[]; handName?: string }[]
  /**
   * Who was at the table, in seat order, with the avatar each of them wore.
   *
   * So the review can draw the hand as the table drew it. Optional: a hand
   * recorded before the review shipped has none, and nor does one decoded
   * from a plain (v1) `/hand` link.
   */
  seats?: { id: string; name: string; avatar: AvatarSpec }[]
  /**
   * **Every** hand that was dealt, including the ones that folded and were
   * never shown.
   *
   * Separate from `reveals`, which is what the table actually turned over. This
   * is for the review, where the hand is over, the result is recorded, and
   * nothing anybody learns can be played — the same argument that lets a busted
   * player watch a tournament out. A shared hand is a public review of that one
   * hand, so a v2 `/hand` link carries these too; a plain v1 link does not.
   */
  hole?: { playerId: string; cards: Card[] }[]
  /**
   * A Mystery Card hand: before the river each hand was one card its owner
   * could see, so the review draws it that way (`handStateAt`) and grades
   * nothing it could not have known.
   */
  mystery?: boolean
  /** Who had the button. Optional for the same reason `seats` is. */
  buttonId?: string
  /** The table as the cards landed: stacks and blinds before anybody acted. */
  start?: { stacks: Record<string, number>; committed: Record<string, number>; pot: number }
  summary: string
  /**
   * What the hand did to the hero's stack — chips won less chips put in.
   *
   * Recorded rather than derived, for the same reason `HeroDecision` is: it can
   * be rebuilt by walking the events and the pots, and that arithmetic goes
   * quietly wrong. Taken as the difference between the stack the hero sat down
   * with this hand and the one they have now, it cannot.
   *
   * Optional because a hand decoded from a `/hand` permalink has none: the wire
   * format predates it and does not carry it (see lib/handLink).
   */
  heroDelta?: number
}
