// Transient game orchestration (not persisted). Wraps the pure engine into a
// winner-take-all SIT-AND-GO: the human buys in from their Roll, everyone sits
// with equal stacks (the buy-in), and play continues until one player is left.
// Bust and you're out; win the table and the prize is added to your Roll.

'use client'

import { create } from 'zustand'
import type { AvatarSpec } from '@/lib/avatar'
import { sound } from '@/lib/sound'
import { haptics, type Buzz } from '@/lib/haptics'
import { trackOnce } from '@/lib/analytics'
import { draftCast, profileFor, characterById } from '@/config/cast'
import { styleFor, randomBankroll } from '@/config/opponents'
import type { AiProfile } from '@/lib/poker/ai/policy'
import { blindsAt } from '@/config/blinds'
import { cashOutValue, freerollOpen, reviewableVenue, type Venue } from '@/config/venues'
import { detectAwards, type AwardDef } from '@/lib/awards'
import { challengerFor, isChallengeTable } from '@/lib/challenge'
import { emptySeatStats, type SeatStats } from '@/lib/reads'
import {
  heroDecision,
  readFrom,
  scoreDecisions,
  type HandRead,
  type HeroDecision,
} from '@/lib/coach'
import {
  appendReviewHand,
  clearReview,
  endReviewSession,
  loadReview,
  startReviewSession,
} from '@/lib/review/session'
import { buildRecap, type Recap } from '@/lib/recap'
import { deviceId } from '@/lib/sync/client'
import { type Escrow, tableIsBacked } from '@/lib/sync/escrow'
import {
  startHand,
  applyAction,
  legalActions,
  isHandComplete,
  potSize,
  type Action,
  type HandState,
  type SeatConfig,
} from '@/lib/poker/engine'
import { decideAction, opponentSelectivity } from '@/lib/poker/ai/policy'
import { decideDiscard } from '@/lib/poker/ai/draw'
import { estimateEquity } from '@/lib/poker/equity'
import { mulberry32, type Card } from '@/lib/poker/cards'
import {
  dailyAiRng as dailyAiRngFor,
  dailyDateKey,
  dailyNumber,
  dailySeed,
  handSeed,
  type CountedRng,
} from '@/lib/daily'
import { formatChips } from '@/lib/useMoney'
import { useProfile } from './profile'

export interface SeatMeta {
  id: string
  name: string
  avatar: AvatarSpec
  isHuman: boolean
  /** Chip stack carried across hands (mirrors the engine between hands). */
  stack: number
  /** Flavour for opponents (shown when you tap them). */
  style?: string
  bio?: string
  bankroll?: number
  /** Which cast character sits here (see config/cast.ts). */
  characterId?: string
  /** This seat's AI profile: the venue's, nudged by the character. */
  ai?: AiProfile
}

export type GameStatus = 'idle' | 'playing' | 'handover' | 'busted' | 'won' | 'watching'

// --- hand history ------------------------------------------------------------
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
   * and a hand decoded from a `/hand` permalink never will — the wire format
   * does not carry them.
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
   * recorded before the review shipped has none, and one decoded from a
   * `/hand` link never will.
   */
  seats?: { id: string; name: string; avatar: AvatarSpec }[]
  /**
   * **Every** hand that was dealt, including the ones that folded and were
   * never shown.
   *
   * Separate from `reveals`, which is what the table actually turned over, and
   * deliberately not part of the `/hand` wire format: a shared hand shows what
   * the players showed. This is for the review, where the hand is over, the
   * result is recorded, and nothing anybody learns can be played — the same
   * argument that lets a busted player watch a tournament out.
   */
  hole?: { playerId: string; cards: Card[] }[]
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

const HUMAN_ID = 'hero'
/**
 * Priced decisions scored per hand.
 *
 * Higher than the free read's own cap, which keeps the four biggest pots
 * because it only ever names one of them. A review listing every hand has to
 * account for the hand where the fifth decision was the expensive one — that is
 * exactly the hand somebody opens the review to find. Eight is past the longest
 * raise war six-handed poker produces, so in practice nothing is dropped.
 */
const MAX_REVIEWED_DECISIONS = 8
// AI acts a touch slower while the human is still contesting the pot (so it's
// followable), and briskly once the human has folded and is just spectating.
const AI_DELAY_IN_HAND = 1050
const AI_DELAY_FOLDED = 450
/**
 * How long a spectator is left on a finished hand before the next is dealt.
 *
 * Longer than the AI's own beat because there is no button to press and nothing
 * to do: the only reason to pause is so the result can be read. Short enough
 * that a six-handed table does not take an evening to play down to one.
 */
const WATCH_HAND_PAUSE = 2200

interface GameState {
  venue: Venue | null
  seats: SeatMeta[]
  hand: HandState | null
  status: GameStatus
  buttonSeatId: string | null
  heroEquity: number | null
  aiThinkingId: string | null
  message: string | null
  /** Human's finishing position (1 = won it) once the game ends. */
  place: number | null
  smallBlind: number
  bigBlind: number
  /** 0-based escalation level (blinds rise every few hands — see config/blinds). */
  blindLevel: number
  /** Hands dealt this tournament (drives escalation). */
  handIndex: number
  /** Timeline of the previous completed hand (for the history dialog). */
  lastHand: HandRecord | null
  /**
   * One honest line on the hand just finished, or null when it had no lesson
   * in it (most hands) or the player has the setting off. Shown on the handover
   * banner and replaced at the end of the next hand.
   */
  lastRead: HandRead | null
  /** Award chips earned on the just-finished hand (for the quiet earn line). */
  newAwards: AwardDef[]
  /** Bounty chips collected on the just-finished hand (bounty tables). */
  lastBounty: number
  /** Observed tendencies per seat this tournament (feeds the reads in the player dialog). */
  seatStats: Record<string, SeatStats>
  /**
   * The recap of the run that just ended, or null at every other moment.
   * Tournaments only: a cash table has no finish and no run to sum up.
   * Derived at tournament end and never persisted (see lib/recap).
   */
  recap: Recap | null
  /** One quiet line of character flavour, heavily rationed (see docs/cast.md). */
  talk: string | null
  /** Chips bought in this session — the sit-in plus any rebuys. Drives the cash
   * table's cash-out P/L (which must count rebuys, not just the first buy-in). */
  cashInvested: number
  /**
   * Whether this table was sat down at by a member.
   *
   * **Handed in at sit-down rather than read from the entitlement store**, and
   * the reason is a rule rather than taste: nothing in the game loop asks
   * whether the player is a member (`tests/membershipSurfaces.test.ts` fails the
   * build on the import). A table is told what it is when it opens, the same
   * way it is told the venue, and it cannot re-derive entitlement mid-hand.
   *
   * It gates one thing: watching the tournament out after you bust.
   */
  member: boolean

  sitDown: (venue: Venue, human: { name: string; avatar: AvatarSpec; member: boolean }) => void
  /** Rebuild an interrupted table from its snapshot (no buy-in taken). */
  resumeTable: (venue: Venue, snapshot: TableSnapshot, member: boolean) => void
  act: (action: Action) => void
  nextHand: () => void
  /** Cash tables only: buy a fresh stack after busting and deal on. */
  rebuy: () => void
  /**
   * Tournaments only, members only: stay and watch it play out after busting.
   *
   * **Nothing about the run changes.** The place, the records, the recap and the
   * chips were all settled the moment the last chip went, and this is a
   * spectator seat at a game that is already over for the player. That is also
   * what makes it honest under "nothing you can buy changes a hand": watching
   * hands you are no longer in cannot be acted on.
   */
  watchItOut: () => void
  /**
   * A still-live player's chance of taking the pot, for the spectator view.
   *
   * Computed on demand rather than held in state: it is several Monte Carlo
   * estimates per player and almost nobody opens more than one seat at a time.
   * Returns null unless the player is actually watching, so this cannot become
   * a way to read equity while a hand is live.
   */
  spectatorEquity: (playerId: string) => number | null
  leave: () => void
}

let turnTimer: ReturnType<typeof setTimeout> | null = null
/** The pause between spectated hands, so leaving the table can cancel it. */
let watchTimer: ReturnType<typeof setTimeout> | null = null
/** Latched once the spectated table is down to one, so no stray timer deals on. */
let watchOver = false

function clearTimers() {
  if (turnTimer) clearTimeout(turnTimer)
  turnTimer = null
  if (watchTimer) clearTimeout(watchTimer)
  watchTimer = null
}

// --- table snapshot ----------------------------------------------------------
// The game store is transient, but a hard refresh mid-tournament must not eat
// the buy-in. The live table (stacks, button, hand number) is snapshotted to
// localStorage at every deal and hand end; the play page resumes from it
// instead of buying in again. Cleared on every legitimate exit (leave, bust,
// win) and overwritten when a new table starts.
//
// The snapshot also carries the hand in progress (`live`), rewritten after
// every action. It used to stop at the hand boundary, so a refresh re-dealt the
// current hand from scratch: you could shove, dislike the flop, refresh, and
// get both your chips and a fresh board back, or just keep refreshing until you
// were dealt something you liked (#22). Resuming into the exact hand closes
// that. Cards live in the browser either way (this is a single-player game with
// no server), so the point is to remove the accident, not to make the state
// tamper-proof.

const TABLE_KEY = 'pip.table'

/** The hand in progress, and the running counters that belong to it. */
export interface LiveHand {
  hand: HandState
  /** Timeline so far, so hand history survives the refresh. */
  events: HandEvent[]
  /** Who has already been counted as voluntarily in. VPIP is once per hand. */
  vpip: string[]
  /** Session tendency counters, plus the baselines their deltas flush against. */
  stats: Record<string, SeatStats>
  heroFlushed: SeatStats
  castFlushed: Record<string, SeatStats>
  /** Hand number on display. Blinds come off `hand`; the level does not. */
  handIndex: number
  blindLevel: number
  /** Daily only: draws taken from this hand's AI stream. Zero elsewhere. */
  aiDraws: number
}

export interface TableSnapshot {
  venueId: string
  /** Stacks as of the coming (re-)deal. */
  seats: SeatMeta[]
  /** Button to use for the (re-)deal on resume. */
  buttonSeatId: string
  handIndex: number
  heroLow: number
  /** Chips bought in so far (cash tables) — restored so P/L survives a refresh. */
  cashInvested?: number
  /** Which day's Daily this table is — keeps the seed stable across midnight. */
  dailyDate?: string
  /**
   * The run's recap tally so far. Optional: a snapshot written by an older
   * build has none, and a run resumed from one simply gets a recap built from
   * the hands it can still see.
   */
  run?: RunTally
  /**
   * Set between the deal and the hand ending; absent between hands. Present
   * means "play this hand on", absent means "deal hand `handIndex`".
   */
  live?: LiveHand
}

function saveTableSnapshot(snap: TableSnapshot) {
  // The account's half of the same fact: chips are out of the Roll and this
  // device is holding them (technology#90, lib/sync/escrow). It is written here
  // rather than at sit-down so that there is one place the snapshot and the
  // escrow can disagree, and there isn't one. `holdEscrow` writes nothing when
  // the record already says this, so the common case is a comparison.
  //
  // It also means a table started on a build that had no escrow claims itself
  // on its first save after the upgrade, which is why the migration can leave
  // the field null without ending anybody's tournament.
  useProfile.getState().holdEscrow({
    deviceId: deviceId(),
    chips: snap.cashInvested ?? 0,
    venueId: snap.venueId,
  })
  try {
    localStorage.setItem(TABLE_KEY, JSON.stringify(snap))
  } catch {
    /* storage unavailable — refresh-resume simply won't work */
  }
}

function clearTableSnapshot() {
  // Every way a table ends comes through here: busting, winning, cashing out
  // and walking away. So this is where the chips stop being out, and it is only
  // ever this device's claim that is dropped.
  useProfile.getState().releaseEscrow(deviceId())
  try {
    localStorage.removeItem(TABLE_KEY)
  } catch {}
}

/**
 * A pull has landed. Is the table this device is holding still backed by chips?
 *
 * Called from store/sync, which owns the pull; the rule is pure and lives in
 * lib/sync/escrow. False means the player sat down on another device, that
 * device took this buy-in back into the Roll, and playing this table on would
 * pay a prize out of a Roll that has already been refunded.
 *
 * Returns the venue that was dropped, or null if nothing was.
 */
export function dropUnbackedTable(escrow: Escrow | null): string | null {
  const snap = loadTableSnapshot()
  if (!snap) return null
  if (tableIsBacked(escrow, deviceId(), snap.venueId)) return null
  clearTableSnapshot()
  // If it is the table on screen, leaving it is the only honest thing to do:
  // the alternative is a tournament that pays out chips nobody is holding.
  if (useGame.getState().venue?.id === snap.venueId) useGame.getState().leave()
  return snap.venueId
}

export function loadTableSnapshot(): TableSnapshot | null {
  try {
    const raw = localStorage.getItem(TABLE_KEY)
    return raw ? (JSON.parse(raw) as TableSnapshot) : null
  } catch {
    return null
  }
}

/** Events of the hand currently being played (moved into `lastHand` when it ends). */
let currentEvents: HandEvent[] = []

/** Hero's lowest between-hands stack this tournament (drives The Comeback chip). */
let heroLowTide = Infinity

/**
 * What the end-of-run recap needs that no single hand can see: the run's best
 * moment, its knockouts, and the bounties banked along the way.
 *
 * Tallied hand by hand rather than reconstructed at the end, for the reason the
 * `HeroDecision` snapshot exists: the numbers are exact where they happen and
 * only approximable afterwards. Carried in the refresh-resume snapshot so a
 * reload mid-tournament does not silently produce a recap of half a run.
 */
export interface RunTally {
  /** Bounties banked this run (already added to the Roll, hand by hand). */
  bounty: number
  /** The biggest pot the hero has won this run, in chips. */
  biggestPot: number
  /** What the hero showed for it, when that pot went to showdown. */
  bigPotHand: { name: string; description: string } | null
  /** Who that pot busted, if anyone. */
  bigPotKos: string[]
  /** peakRoll as the run started, so "a new best" is a claim about the run. */
  peakAtStart: number
}

const emptyRunTally = (peakAtStart: number): RunTally => ({
  bounty: 0,
  biggestPot: 0,
  bigPotHand: null,
  bigPotKos: [],
  peakAtStart,
})

let runTally: RunTally = emptyRunTally(0)

/** Live tendency counters (mirrored into state at hand boundaries). */
let seatStatsLive: Record<string, SeatStats> = {}
/** Hero tendencies already pushed to the lifetime profile — the flush baseline. */
let heroTendencyFlushed: SeatStats = emptySeatStats()
/**
 * The table at the moment of the deal, for the review's opening step.
 *
 * Module-level like `currentEvents`, and for the same reason: it belongs to the
 * hand being played rather than to any screen, and the record is only built at
 * the end.
 */
let handStart: { stacks: Record<string, number>; committed: Record<string, number>; pot: number } =
  {
    stacks: {},
    committed: {},
    pot: 0,
  }

/** Cast tendencies already pushed to career records — flush baselines by seat. */
let castFlushed: Record<string, SeatStats> = {}

// --- the Daily Deal ------------------------------------------------------------
// While a Daily table is live, decks come from a date-derived seed (hand n is
// mulberry32(handSeed(base, n)) — so a refresh re-deals hand n identically) and
// AI decisions draw from their own per-hand stream off the same seed, so the
// opponents are as reproducible as the cards. Everything else is the normal
// loop.

let dailyBase: number | null = null
let dailyDay: string | null = null
/** The AI stream for the hand on the table. Null away from a Daily. */
let dailyAiRng: CountedRng | null = null

function armDaily(dateKey: string | null) {
  dailyDay = dateKey
  dailyBase = dateKey ? dailySeed(dateKey) : null
  dailyAiRng = null
}

/**
 * Point the AI stream at one hand, `from` draws in. Called on every deal, and
 * on a mid-hand resume with the draws the snapshot recorded, so the opponents
 * carry on from where they were instead of restarting (#25).
 */
function armDailyHand(handIndex: number, from = 0) {
  dailyAiRng = dailyBase === null ? null : dailyAiRngFor(dailyBase, handIndex, from)
}

// --- table talk ---------------------------------------------------------------
// Rationed hard: at most one line every few hands, and most moments pass in
// silence anyway. The writing bar is the feature — lines live in config/cast.ts.

const TALK_MIN_GAP_HANDS = 4
let lastTalkHand = -TALK_MIN_GAP_HANDS

function maybeTalk(
  kind: 'seat' | 'win' | 'bust',
  seat: SeatMeta | undefined,
  handIndex: number,
  chance: number,
): string | null {
  if (!useProfile.getState().tableTalk) return null
  if (handIndex - lastTalkHand < TALK_MIN_GAP_HANDS) return null
  if (Math.random() > chance) return null
  const lines = seat?.characterId ? characterById(seat.characterId)?.lines[kind] : undefined
  if (!lines || lines.length === 0) return null
  lastTalkHand = handIndex
  return lines[Math.floor(Math.random() * lines.length)]
}
/** Who has voluntarily put chips in this hand already (VPIP counts once per hand). */
let vpipThisHand = new Set<string>()

const statsFor = (id: string): SeatStats => (seatStatsLive[id] ??= emptySeatStats())

/** Record one action (and any board cards it dealt) into the running timeline. */
function recordStep(prev: HandState, action: Action, next: HandState) {
  const actor = prev.players[prev.toActIndex]
  if (actor) {
    const legal = legalActions(prev)
    const amount =
      action.type === 'call'
        ? legal?.callAmount
        : action.type === 'bet' || action.type === 'raise'
          ? action.amount
          : undefined
    currentEvents.push({
      kind: 'action',
      playerId: actor.id,
      playerName: actor.name,
      type: action.type,
      amount,
      decision:
        actor.id === HUMAN_ID ? heroDecision(prev, HUMAN_ID, legal?.callAmount ?? 0) : undefined,
      pot: potSize(next),
      stacks: Object.fromEntries(next.players.map((p) => [p.id, p.stack])),
      committed: Object.fromEntries(next.players.map((p) => [p.id, p.committedThisStreet])),
    })

    // Tendencies (feeds the reads in the player dialog).
    const stats = statsFor(actor.id)
    const facingBet = (legal?.callAmount ?? 0) > 0
    if (facingBet) stats.betsFaced++
    if (action.type === 'fold' && facingBet) stats.foldsToBet++
    if (action.type === 'call') stats.calls++
    if (action.type === 'bet' || action.type === 'raise') stats.raises++
    const voluntary =
      prev.street === 'preflop' &&
      (action.type === 'bet' || action.type === 'raise' || (action.type === 'call' && facingBet))
    if (voluntary && !vpipThisHand.has(actor.id)) {
      vpipThisHand.add(actor.id)
      stats.vpipHands++
    }
  }
  const dealt = next.community.length - prev.community.length
  if (dealt > 0) {
    const label =
      dealt > 1 && next.community.length === 5 && prev.community.length < 4
        ? 'Runout'
        : next.community.length === 3
          ? 'Flop'
          : next.community.length === 4
            ? 'Turn'
            : 'River'
    currentEvents.push({ kind: 'board', label, cards: next.community.slice() })
  }
}

export const useGame = create<GameState>((set, get) => {
  /** Seat configs (id/name/stack) for players still holding chips, in seat order. */
  function liveSeatConfigs(): SeatConfig[] {
    return get()
      .seats.filter((s) => s.stack > 0)
      .map((s) => ({ id: s.id, name: s.name, stack: s.stack }))
  }

  /**
   * Snapshot the hand in progress. Called on the deal and after every action so
   * that whenever the tab dies, the hand can be picked up exactly where it was
   * rather than re-dealt (#22).
   *
   * `seats` stay at their start-of-hand stacks. `finishHand` is what writes
   * stacks back, so the chips still in front of players live on `hand` alone.
   */
  function saveLiveHand() {
    const { venue, hand, seats, buttonSeatId, handIndex, blindLevel, cashInvested } = get()
    if (!venue || !hand || !buttonSeatId) return
    saveTableSnapshot({
      venueId: venue.id,
      seats,
      buttonSeatId,
      // The between-hands fallback: `handIndex` counts the hand just dealt, so
      // deal it again if `live` is ever missing.
      handIndex: handIndex - 1,
      heroLow: heroLowTide,
      cashInvested,
      dailyDate: dailyDay ?? undefined,
      run: { ...runTally },
      live: {
        hand,
        events: currentEvents.slice(),
        vpip: [...vpipThisHand],
        stats: { ...seatStatsLive },
        heroFlushed: { ...heroTendencyFlushed },
        castFlushed: { ...castFlushed },
        handIndex,
        blindLevel,
        aiDraws: dailyAiRng?.drawn() ?? 0,
      },
    })
  }

  function dealHand(buttonSeatId: string) {
    const configs = liveSeatConfigs()
    const buttonIndex = Math.max(
      0,
      configs.findIndex((c) => c.id === buttonSeatId),
    )
    const { venue, handIndex } = get()
    const blinds =
      venue!.escalation === false
        ? { smallBlind: venue!.smallBlind, bigBlind: venue!.bigBlind, level: 0 }
        : blindsAt(venue!, handIndex)
    const hand = startHand({
      seats: configs,
      buttonIndex,
      smallBlind: blinds.smallBlind,
      bigBlind: blinds.bigBlind,
      rng: dailyBase !== null ? mulberry32(handSeed(dailyBase, handIndex)) : undefined,
      // Four cards and pot-limit at an Omaha table. Absent everywhere else, so
      // every existing table deals exactly what it always did.
      variant: venue!.variant,
    })
    // The opponents get their own stream off the same per-hand seed as the deck.
    armDailyHand(handIndex)
    sound.play('deal')
    buzz('deal')
    // Engagement — someone actually started playing. Once per tab session so a
    // busy session doesn't drown the signal; anonymous.
    trackOnce('first-hand')
    currentEvents = []
    // The table as the cards land, before anybody has acted: stacks after the
    // blinds, and the blinds themselves sitting in front. The review's first
    // step draws from this — without it the felt opens on stacks of zero and an
    // empty pot, because nothing had been recorded yet.
    handStart = {
      stacks: Object.fromEntries(hand.players.map((p) => [p.id, p.stack])),
      committed: Object.fromEntries(hand.players.map((p) => [p.id, p.committedThisStreet])),
      pot: potSize(hand),
    }
    vpipThisHand = new Set()
    for (const c of configs) statsFor(c.id).handsDealt++
    set({
      hand,
      status: 'playing',
      newAwards: [],
      lastBounty: 0,
      talk: null,
      seatStats: { ...seatStatsLive },
      buttonSeatId: configs[buttonIndex].id,
      smallBlind: blinds.smallBlind,
      bigBlind: blinds.bigBlind,
      blindLevel: blinds.level,
      handIndex: handIndex + 1,
    })
    // A refresh from here on resumes into this exact hand.
    saveLiveHand()
    progress()
  }

  /** Advance the turn loop: schedule AI, or hand control to the human. */
  function progress() {
    const { hand } = get()
    if (!hand) return

    if (isHandComplete(hand)) {
      finishHand()
      return
    }

    const toAct = hand.players[hand.toActIndex]
    if (!toAct) return

    if (toAct.id === HUMAN_ID) {
      set({ aiThinkingId: null, heroEquity: computeHeroEquity(hand) })
      sound.play('turn')
      return
    }

    // AI to act — pause for feel, then decide. Slower while the human is live.
    const hero = hand.players.find((p) => p.id === HUMAN_ID)
    const heroLive = hero?.status === 'active' || hero?.status === 'allin'
    const delay = heroLive ? AI_DELAY_IN_HAND : AI_DELAY_FOLDED

    set({ aiThinkingId: toAct.id, heroEquity: null })
    turnTimer = setTimeout(() => {
      const cur = get().hand
      if (!cur || isHandComplete(cur)) return
      const venue = get().venue!
      const seatAi = get().seats.find((s) => s.id === toAct.id)?.ai
      const rng = dailyAiRng ?? Math.random
      // The draw round is not a betting round, so it does not go through the
      // betting policy. Everything after this — the sound, the history, the
      // snapshot — is identical, because to the rest of the loop a discard is
      // just another action somebody took.
      const action: Action =
        cur.street === 'draw'
          ? { type: 'draw', discard: decideDiscard(cur.players[cur.toActIndex].hole, rng) }
          : decideAction(cur, seatAi ?? venue.ai, rng)
      playActionSound(action, cur)
      const next = applyAction(cur, action)
      recordStep(cur, action, next)
      set({ hand: next })
      saveLiveHand()
      progress()
    }, delay)
  }

  function finishHand() {
    const { hand, seats, venue } = get()
    if (!hand || !venue) return

    const stackById = new Map(hand.players.map((p) => [p.id, p.stack]))
    const nextSeats = seats.map((s) => ({ ...s, stack: stackById.get(s.id) ?? s.stack }))

    const result = hand.result
    if (result?.showdown) {
      for (const p of hand.players) {
        if (p.status !== 'folded' && p.status !== 'out') statsFor(p.id).showdowns++
      }
    }
    // The scoring runs here rather than in the render path: it is several Monte
    // Carlo estimates and the hand is already over, so nobody is waiting on it.
    //
    // **One pass, two readers.** `scoreDecisions` prices every decision the
    // hero was charged for; the banner's free read takes the biggest of them
    // and the session being kept for review keeps all of them. Scoring twice
    // would be three thousand simulations a hand for one answer.
    const heroStackBefore = seats.find((s) => s.id === HUMAN_ID)?.stack ?? 0
    const record = buildHandRecord(hand, { ...get(), heroStackBefore })
    const scored = scoreDecisions(record, { max: MAX_REVIEWED_DECISIONS })
    set({
      lastHand: record,
      lastRead: useProfile.getState().handCoaching ? readFrom(scored, record) : null,
      seatStats: { ...seatStatsLive },
    })
    // No-ops at every table the review does not cover — nothing opened a
    // session there. The store never asks who is paying (see the `member`
    // field): collecting is free, the screen that reads it is not.
    const reviewed = appendReviewHand(record, scored)
    // The career table behind the report. Same rule: written at reviewed tables
    // only, for everybody, and the screen that reads it is the gated one.
    if (reviewed) useProfile.getState().recordReviewHand(reviewed)
    const heroWon = !!result && (result.payouts[HUMAN_ID] ?? 0) > 0
    const pot = potSize(hand)

    const profile = useProfile.getState()
    profile.mergeStats({
      handsPlayed: 1,
      handsWon: heroWon ? 1 : 0,
      biggestPot: heroWon ? pot : 0,
      showdownsWon: heroWon && result?.showdown ? 1 : 0,
    })

    // Flush the hero's tendencies for this hand — the session counter is
    // cumulative, so push only the delta since the last flush.
    const heroLive = seatStatsLive[HUMAN_ID]
    if (heroLive) {
      profile.mergeTendencies({
        handsDealt: heroLive.handsDealt - heroTendencyFlushed.handsDealt,
        vpipHands: heroLive.vpipHands - heroTendencyFlushed.vpipHands,
        raises: heroLive.raises - heroTendencyFlushed.raises,
        calls: heroLive.calls - heroTendencyFlushed.calls,
        betsFaced: heroLive.betsFaced - heroTendencyFlushed.betsFaced,
        foldsToBet: heroLive.foldsToBet - heroTendencyFlushed.foldsToBet,
        showdowns: heroLive.showdowns - heroTendencyFlushed.showdowns,
      })
      heroTendencyFlushed = { ...heroLive }
    }

    // Flush each character's tendencies into their career record — the reads
    // that persist across sessions (docs/cast.md). Delta since the last flush.
    const castDeltas: Record<string, Partial<SeatStats>> = {}
    for (const s of seats) {
      if (s.isHuman || !s.characterId) continue
      const live = seatStatsLive[s.id]
      if (!live) continue
      const base = castFlushed[s.id] ?? emptySeatStats()
      const delta = {
        handsDealt: live.handsDealt - base.handsDealt,
        vpipHands: live.vpipHands - base.vpipHands,
        raises: live.raises - base.raises,
        calls: live.calls - base.calls,
        betsFaced: live.betsFaced - base.betsFaced,
        foldsToBet: live.foldsToBet - base.foldsToBet,
        showdowns: live.showdowns - base.showdowns,
      }
      if (Object.values(delta).some((v) => v !== 0)) castDeltas[s.characterId] = delta
      castFlushed[s.id] = { ...live }
    }
    profile.mergeCastStats(castDeltas)

    if (result) sound.play(heroWon ? 'win' : result.showdown ? 'lose' : 'tap')
    // Only the win. A lost pot is the common case and does not want marking.
    if (result && heroWon) buzz('win')

    // Cash / ring tables: no prize, no elimination. Opponents rebuy so the
    // table stays full, and the hand simply resolves to a handover (or, if the
    // human is out of chips, a rebuy-or-stand-up prompt). None of the
    // tournament-outcome logic below applies.
    if (venue.cash) {
      finishCashHand(hand, nextSeats, stackById, heroWon, pot)
      return
    }

    const survivors = nextSeats.filter((s) => s.stack > 0)
    const humanAlive = (stackById.get(HUMAN_ID) ?? 0) > 0
    const tournamentWon = humanAlive && survivors.length === 1

    // Knockouts: opponents busted this hand with every pot going to the hero.
    const eliminated = seats.filter(
      (s) => s.id !== HUMAN_ID && s.stack > 0 && (stackById.get(s.id) ?? 0) === 0,
    )
    const eliminatedCount = eliminated.length
    const heroTookAll =
      !!result && Object.entries(result.payouts).every(([id, amt]) => id === HUMAN_ID || amt === 0)
    const knockedOut = heroWon && eliminatedCount > 0 && heroTookAll

    // Bounty tables pay per knockout, on the spot.
    const bountyWon = knockedOut && venue.bounty ? eliminatedCount * venue.bounty : 0
    if (bountyWon > 0) profile.adjustRoll(bountyWon)

    // Tally what the end-of-run recap will want. The highlight is one moment,
    // not three: the biggest pot the hero won, plus what they showed for it and
    // whose chips it took, which is usually the same hand anyway.
    runTally.bounty += bountyWon
    if (heroWon && pot > runTally.biggestPot) {
      const shown = result?.showdown ? result.evaluations?.[HUMAN_ID] : undefined
      runTally.biggestPot = pot
      runTally.bigPotHand = shown ? { name: shown.name, description: shown.description } : null
      runTally.bigPotKos = knockedOut ? eliminated.map((s) => s.name) : []
    }

    // Career scalps: you took a character's last chip.
    if (knockedOut) {
      for (const s of eliminated) {
        if (s.characterId) profile.recordCastKnockout(s.characterId)
      }
    }

    // Spectating: the run's outcome was settled the hand the player busted, so
    // none of the recording below may run a second time. What is left is to
    // play the table down to one and then stop.
    if (get().status === 'watching') {
      if (survivors.length <= 1) {
        clearTableSnapshot()
        set({
          seats: nextSeats,
          hand,
          status: 'watching',
          aiThinkingId: null,
          message: survivors[0] ? `${survivors[0].name} takes it.` : describeResult(hand),
          talk: null,
        })
        watchOver = true
        return
      }
      set({
        seats: nextSeats,
        hand,
        aiThinkingId: null,
        message: describeResult(hand),
        talk: maybeTalk('bust', eliminated[0], get().handIndex, 0.8),
      })
      // No "Next hand" button to wait for — there is nobody to press it. The
      // pause is so a spectator can read the result rather than watch a blur.
      watchTimer = setTimeout(() => {
        if (get().status !== 'watching' || watchOver) return
        const live = get().seats.filter((s) => s.stack > 0)
        if (live.length <= 1) return
        set({ message: null, talk: null })
        dealHand(nextButtonSeatId(get().seats, get().buttonSeatId, live))
      }, WATCH_HAND_PAUSE)
      return
    }

    // Tournament outcomes.
    if (!humanAlive) {
      clearTableSnapshot()
      const place = survivors.length + 1
      const bestFinishBefore = useProfile.getState().venueRecords[venue.id]?.bestFinish ?? null
      profile.recordVenueResult(venue.id, place, get().handIndex)
      recordChallengeResult(venue, false)
      if (venue.daily && dailyDay) profile.recordDailyResult(dailyDay, place, get().handIndex)
      profile.recordRollPoint()
      // Busting back below the ladder resets the freeroll comeback story.
      if (profile.cameFromFreeroll && freerollOpen(profile.roll)) {
        profile.setCameFromFreeroll(false)
      }
      buzz('bust')
      endReviewSession({ kind: 'busted', place, seats: seats.length })
      set({
        seats: nextSeats,
        hand,
        status: 'busted',
        place,
        aiThinkingId: null,
        message: null,
        recap: makeRecap(venue, place, bestFinishBefore),
      })
      return
    }
    if (tournamentWon) {
      clearTableSnapshot()
      profile.adjustRoll(venue.prize)
      profile.mergeStats({ tournamentsWon: 1 })
      const bestFinishBefore = useProfile.getState().venueRecords[venue.id]?.bestFinish ?? null
      profile.recordVenueResult(venue.id, 1, get().handIndex)
      recordChallengeResult(venue, true)
      if (venue.daily && dailyDay) profile.recordDailyResult(dailyDay, 1, get().handIndex)
      profile.recordRollPoint()
      if (venue.freeroll) profile.setCameFromFreeroll(true)
      const newAwards = grantEarnedAwards(hand, venue, heroWon, true, knockedOut, eliminatedCount)
      buzz('finish')
      endReviewSession({ kind: 'won', seats: seats.length })
      set({
        seats: nextSeats,
        hand,
        status: 'won',
        place: 1,
        aiThinkingId: null,
        message: null,
        newAwards,
        lastBounty: bountyWon,
        recap: makeRecap(venue, 1, bestFinishBefore),
      })
      return
    }

    // Otherwise: pause on the result until the player taps "Next hand".
    // A character moment, maybe: a bust-out line beats a big-pot gloat, and
    // most hands pass in silence (see maybeTalk's rationing).
    const winnerId = result?.potsAwarded[0]?.winners[0]
    const winnerSeat =
      winnerId && winnerId !== HUMAN_ID ? seats.find((s) => s.id === winnerId) : undefined
    const bigPot = pot >= get().bigBlind * 20
    const talk =
      maybeTalk('bust', eliminated[0], get().handIndex, 0.8) ??
      (bigPot ? maybeTalk('win', winnerSeat, get().handIndex, 0.5) : null)

    const newAwards = grantEarnedAwards(hand, venue, heroWon, false, knockedOut, eliminatedCount)
    heroLowTide = Math.min(heroLowTide, stackById.get(HUMAN_ID) ?? 0)
    // A refresh during the handover resumes with the next hand, chips intact.
    saveTableSnapshot({
      venueId: venue.id,
      seats: nextSeats,
      buttonSeatId: nextButtonSeatId(
        nextSeats,
        get().buttonSeatId,
        nextSeats.filter((s) => s.stack > 0),
      ),
      handIndex: get().handIndex,
      heroLow: heroLowTide,
      cashInvested: get().cashInvested,
      dailyDate: dailyDay ?? undefined,
      run: { ...runTally },
    })
    set({
      seats: nextSeats,
      hand,
      status: 'handover',
      aiThinkingId: null,
      message: describeResult(hand),
      newAwards,
      lastBounty: bountyWon,
      talk,
    })
  }

  /**
   * Resolve a hand at a cash table. Opponents who busted rebuy to a full stack
   * so the table stays full; the hand goes to a normal handover. If the human
   * is out of chips it's not "knocked out" — the overlay offers a rebuy or a
   * stand-up (or the freeroll when they can't afford either).
   */
  function finishCashHand(
    hand: HandState,
    nextSeats: SeatMeta[],
    stackById: Map<string, number>,
    heroWon: boolean,
    pot: number,
  ) {
    const venue = get().venue!
    const tableStack = venue.startingStack ?? venue.buyIn
    const humanAlive = (stackById.get(HUMAN_ID) ?? 0) > 0
    const rebought = nextSeats.map((s) =>
      !s.isHuman && s.stack <= 0 ? { ...s, stack: tableStack } : s,
    )
    const newAwards = grantEarnedAwards(hand, venue, heroWon, false, false, 0)

    if (!humanAlive) {
      clearTimers()
      // Nothing to resume — the buy-in is spent; a refresh re-seats fresh.
      clearTableSnapshot()
      useProfile.getState().recordRollPoint()
      set({
        seats: rebought,
        hand,
        status: 'busted',
        place: null,
        aiThinkingId: null,
        message: null,
        newAwards,
        lastBounty: 0,
        talk: null,
      })
      return
    }

    // A quiet win line, maybe — same rationing as the tournament handover.
    const winnerId = hand.result?.potsAwarded[0]?.winners[0]
    const winnerSeat =
      winnerId && winnerId !== HUMAN_ID ? get().seats.find((s) => s.id === winnerId) : undefined
    const bigPot = pot >= get().bigBlind * 20
    const talk = bigPot ? maybeTalk('win', winnerSeat, get().handIndex, 0.5) : null

    heroLowTide = Math.min(heroLowTide, stackById.get(HUMAN_ID) ?? 0)
    saveTableSnapshot({
      venueId: venue.id,
      seats: rebought,
      buttonSeatId: nextButtonSeatId(
        rebought,
        get().buttonSeatId,
        rebought.filter((s) => s.stack > 0),
      ),
      handIndex: get().handIndex,
      heroLow: heroLowTide,
      cashInvested: get().cashInvested,
    })
    set({
      seats: rebought,
      hand,
      status: 'handover',
      aiThinkingId: null,
      message: describeResult(hand),
      newAwards,
      lastBounty: 0,
      talk,
    })
  }

  /**
   * Who the player is challenging, or undefined at every other table.
   *
   * At a challenge table the one opponent *is* the challenger, so the seat
   * already carries the whole context. The scalp and the rotation both need
   * no extra state, and a table resumed from a snapshot still knows.
   */
  function challengerAtTable(venue: Venue): string | undefined {
    if (!isChallengeTable(venue)) return undefined
    return get().seats.find((s) => !s.isHuman)?.characterId
  }

  /**
   * A challenge is over. **Any completed one rotates the challenger; only a win
   * records the scalp**, the rule that stops a character you cannot beat
   * becoming a wall (technology#22).
   *
   * Standing up mid-tournament deliberately does not land here: an abandoned
   * table is not a completed challenge, so the same face is still waiting, the
   * same way an abandoned ladder run leaves that rung unbeaten.
   */
  function recordChallengeResult(venue: Venue, won: boolean) {
    const challengerId = challengerAtTable(venue)
    if (challengerId) useProfile.getState().recordChallenge(challengerId, won)
  }

  /**
   * Sum the finished tournament up for the recap (see lib/recap).
   *
   * Called at the two tournament endings, *after* the prize, the bounties and
   * the last hand's tendencies have landed on the profile and *before*
   * `recordVenueResult` overwrites the venue best this run is measured against
   * (hence `bestFinishBefore` coming in as an argument rather than being read
   * here). Nothing is persisted: the lifetime figure this run is compared with
   * is the current one minus this run, which is exact because the run's hands
   * are flushed into it one at a time.
   */
  function makeRecap(venue: Venue, place: number, bestFinishBefore: number | null): Recap {
    const profile = useProfile.getState() // re-read: the prize has just landed
    const runStats = seatStatsLive[HUMAN_ID] ?? emptySeatStats()
    return buildRecap({
      venueName: venue.name,
      place,
      seats: venue.seats,
      hands: get().handIndex,
      rollDelta: (place === 1 ? venue.prize : 0) + runTally.bounty - venue.buyIn,
      runStats,
      lifetimeBefore: subtractStats(profile.tendencies, runStats),
      lifetimeAfter: profile.tendencies,
      biggestPot: runTally.biggestPot,
      bigPotHand: runTally.bigPotHand,
      bigPotKos: runTally.bigPotKos,
      newPeak: profile.peakRoll > runTally.peakAtStart,
      peakRoll: profile.peakRoll,
      bestFinishBefore,
    })
  }

  /** Detect + persist chips earned on this hand; returns them for the UI. */
  function grantEarnedAwards(
    hand: HandState,
    venue: Venue,
    heroWon: boolean,
    tournamentWon: boolean,
    knockedOut: boolean,
    eliminatedCount: number,
  ): AwardDef[] {
    const profile = useProfile.getState() // re-read: the prize may have just landed
    const challengerId = challengerAtTable(venue)
    const earned = detectAwards(
      {
        venue,
        challengerId,
        heroWon,
        showdown: hand.result?.showdown === true,
        heroHand: hand.result?.evaluations?.[HUMAN_ID],
        heroHole: hand.players.find((p) => p.id === HUMAN_ID)?.hole,
        knockedOut,
        eliminatedCount,
        bigBlind: get().bigBlind,
        lowestStack: heroLowTide,
        startingStack: venue.startingStack ?? venue.buyIn,
        tournamentWon,
        cameFromFreeroll: profile.cameFromFreeroll,
        peakRoll: profile.peakRoll,
      },
      profile.awards,
    )
    if (earned.length > 0) profile.grantAwards(earned.map((a) => a.id))
    // The comeback chip consumes the flag: the story is complete.
    if (earned.some((a) => a.id === 'journey-kitchen')) profile.setCameFromFreeroll(false)
    return earned
  }

  function dealNextHand() {
    if (get().status !== 'handover') return
    const live = get().seats.filter((s) => s.stack > 0)
    const nextButton = nextButtonSeatId(get().seats, get().buttonSeatId, live)
    set({ message: null })
    dealHand(nextButton)
  }

  return {
    venue: null,
    seats: [],
    hand: null,
    status: 'idle',
    buttonSeatId: null,
    heroEquity: null,
    aiThinkingId: null,
    message: null,
    place: null,
    smallBlind: 0,
    bigBlind: 0,
    blindLevel: 0,
    handIndex: 0,
    lastHand: null,
    lastRead: null,
    newAwards: [],
    lastBounty: 0,
    seatStats: {},
    recap: null,
    talk: null,
    cashInvested: 0,
    member: false,

    sitDown: (venue, human) => {
      clearTimers()
      watchOver = false
      const stack = venue.startingStack ?? venue.buyIn
      heroLowTide = stack
      runTally = emptyRunTally(useProfile.getState().peakRoll)
      seatStatsLive = {}
      heroTendencyFlushed = emptySeatStats()
      castFlushed = {}
      lastTalkHand = -TALK_MIN_GAP_HANDS
      // The Daily deals from a date seed — and sitting down burns today's shot
      // (abandoning counts as played; the shuffle is knowable).
      armDaily(venue.daily ? dailyDateKey() : null)
      if (venue.daily && dailyDay) {
        useProfile.getState().recordDailyStart(dailyDay, dailyNumber(dailyDay))
      }
      const aiCount = venue.seats - 1
      // A challenge table seats no draw: the one chair opposite belongs to the
      // standing challenger, derived here from the persisted profile rather
      // than handed over by the card, so a deep link or a reload seats the
      // same face the home screen offered (see lib/challenge).
      const challenger = challengerFor(venue, useProfile.getState())
      const cast = challenger
        ? [challenger]
        : draftCast(
            venue,
            aiCount,
            dailyBase !== null ? mulberry32(dailyBase ^ 0x9e3779b9) : undefined,
          )
      const aiSeats: SeatMeta[] = cast.map((ch, i) => {
        const ai = profileFor(venue, ch)
        return {
          id: `ai${i}`,
          name: ch.name,
          avatar: ch.avatar,
          isHuman: false,
          stack,
          style: styleFor(ai),
          bio: ch.bio,
          bankroll: randomBankroll(venue),
          characterId: ch.id,
          ai,
        }
      })
      const humanSeat: SeatMeta = {
        id: HUMAN_ID,
        name: human.name,
        avatar: human.avatar,
        isHuman: true,
        stack,
      }
      // Human sits in the middle-ish of the table for a natural layout.
      const seats = [...aiSeats]
      seats.splice(Math.floor(aiSeats.length / 2), 0, humanSeat)

      const profile = useProfile.getState()
      // Chips this player left on a table on another device come home first,
      // and this is the only moment they do (lib/sync/escrow). Sitting down
      // here is the player asking for exactly that; a pull is not, which is why
      // merely opening the app on a second device leaves the first one's
      // tournament alone.
      profile.reclaimEscrow(deviceId())
      profile.adjustRoll(-venue.buyIn) // pay the buy-in (your stack on the table)
      // Cash tables aren't tournaments — they don't count as entries and their
      // ids don't belong in the per-venue win/finish records.
      if (!venue.cash) {
        profile.mergeStats({ tournamentsEntered: 1 })
        profile.recordVenueEntry(venue.id)
      }

      set({
        venue,
        seats,
        member: human.member,
        status: 'playing',
        place: null,
        message: null,
        heroEquity: null,
        aiThinkingId: null,
        smallBlind: venue.smallBlind,
        bigBlind: venue.bigBlind,
        blindLevel: 0,
        handIndex: 0,
        lastHand: null,
        lastRead: null,
        newAwards: [],
        lastBounty: 0,
        seatStats: {},
        recap: null,
        talk: null,
        cashInvested: venue.buyIn,
      })
      // Open the session the review will read, or throw away the last one: a
      // table that is not reviewed must not leave the previous table's session
      // sitting there looking like it belongs to this one.
      if (reviewableVenue(venue)) startReviewSession(venue)
      else clearReview()
      dealHand(seats[0].id)
      // Someone might say hello — one line at most, often nobody.
      const speaker = aiSeats[Math.floor(Math.random() * aiSeats.length)]
      const seatTalk = maybeTalk('seat', speaker, 0, 0.6)
      if (seatTalk) set({ talk: seatTalk })
    },

    resumeTable: (venue, snapshot, member) => {
      clearTimers()
      watchOver = false
      const live = snapshot.live
      heroLowTide = snapshot.heroLow
      // A snapshot written before the recap shipped carries no tally, so the
      // resumed run reports what it can still see rather than nothing.
      runTally = snapshot.run ? { ...snapshot.run } : emptyRunTally(useProfile.getState().peakRoll)
      // Mid-hand, the counters and their flush baselines both come back, so the
      // hand's actions so far still count and the hands before it don't count
      // twice.
      seatStatsLive = live ? { ...live.stats } : {}
      heroTendencyFlushed = live ? { ...live.heroFlushed } : emptySeatStats()
      castFlushed = live ? { ...live.castFlushed } : {}
      currentEvents = live ? live.events.slice() : []
      vpipThisHand = new Set(live?.vpip)
      lastTalkHand = -TALK_MIN_GAP_HANDS
      // Resume a Daily under its original day's seed, even across midnight.
      armDaily(venue.daily ? (snapshot.dailyDate ?? dailyDateKey()) : null)
      set({
        venue,
        seats: snapshot.seats,
        member,
        status: 'playing',
        place: null,
        message: null,
        heroEquity: null,
        aiThinkingId: null,
        smallBlind: venue.smallBlind,
        bigBlind: venue.bigBlind,
        blindLevel: 0,
        handIndex: snapshot.handIndex,
        lastHand: null,
        lastRead: null,
        newAwards: [],
        lastBounty: 0,
        recap: null,
        talk: null,
        cashInvested: snapshot.cashInvested ?? venue.buyIn,
      })
      // A refresh mid-run keeps the session it was collecting — the hands
      // already in it are this table's. Anything else (a stale session from
      // another venue, or none) starts over, because appending this run's hands
      // to another table's session would be the one way this feature could lie.
      if (reviewableVenue(venue)) {
        const open = loadReview()
        if (!open || open.venueId !== venue.id || open.endedAt !== null) startReviewSession(venue)
      } else clearReview()

      // Between hands: deal the next one. Mid-hand: pick the hand back up on
      // the street it was on, with the same deck (#22).
      if (!live) {
        dealHand(snapshot.buttonSeatId)
        return
      }
      // `snapshot.handIndex` is the index the hand was dealt at, which is what
      // seeds both the deck and the AI stream.
      armDailyHand(snapshot.handIndex, live.aiDraws)
      set({
        hand: live.hand,
        buttonSeatId: snapshot.buttonSeatId,
        handIndex: live.handIndex,
        smallBlind: live.hand.smallBlind,
        bigBlind: live.hand.bigBlind,
        blindLevel: live.blindLevel,
        seatStats: { ...seatStatsLive },
      })
      progress()
    },

    act: (action) => {
      const { hand } = get()
      if (!hand || isHandComplete(hand)) return
      const toAct = hand.players[hand.toActIndex]
      if (!toAct || toAct.id !== HUMAN_ID) return
      playActionSound(action, hand)
      // Chips going in, and only yours. An opponent's action buzzing would
      // mean a nine-handed table humming through every orbit.
      if (action.type === 'bet' || action.type === 'raise' || action.type === 'call') {
        buzz('commit')
      }
      const next = applyAction(hand, action)
      recordStep(hand, action, next)
      set({ hand: next, heroEquity: null })
      saveLiveHand()
      progress()
    },

    nextHand: dealNextHand,

    watchItOut: () => {
      const { venue, status, member, seats } = get()
      // Tournaments only: a cash table has no finish to watch, and busting at
      // one offers a rebuy rather than an ending.
      if (!venue || venue.cash) return
      if (status !== 'busted') return
      if (!member) return
      // Nothing left to watch. Can happen at a heads-up table, where busting
      // and the table being down to one are the same moment.
      const live = seats.filter((s) => s.stack > 0)
      if (live.length <= 1) return

      clearTimers()
      watchOver = false
      set({ status: 'watching', message: null, talk: null, recap: null })
      dealHand(nextButtonSeatId(seats, get().buttonSeatId, live))
    },

    spectatorEquity: (playerId) => {
      const { hand, status } = get()
      // The guard that makes this feature honest rather than a peek: outside
      // the spectator view there is no answer, whoever asks.
      if (status !== 'watching' || !hand) return null
      const player = hand.players.find((p) => p.id === playerId)
      if (!player || player.hole.length < 2) return null
      if (player.status === 'folded' || player.status === 'out') return null
      const opponents = hand.players.filter(
        (p) => p.id !== playerId && p.status !== 'folded' && p.status !== 'out',
      )
      if (opponents.length === 0) return 1
      return estimateEquity({
        hole: player.hole,
        community: hand.community,
        opponents: opponents.length,
        opponentSelectivity: opponents.map((p) => opponentSelectivity(hand, p)),
        iterations: 800,
      }).equity
    },

    rebuy: () => {
      const { venue, seats, status } = get()
      if (!venue?.cash || status !== 'busted') return
      const profile = useProfile.getState()
      if (profile.roll < venue.buyIn) return
      clearTimers()
      const tableStack = venue.startingStack ?? venue.buyIn
      profile.adjustRoll(-venue.buyIn) // buy a fresh stack from the Roll
      const nextSeats = seats.map((s) => (s.isHuman ? { ...s, stack: tableStack } : s))
      heroLowTide = Math.min(heroLowTide, tableStack)
      set({
        seats: nextSeats,
        status: 'playing',
        place: null,
        message: null,
        cashInvested: get().cashInvested + venue.buyIn,
      })
      const live = nextSeats.filter((s) => s.stack > 0)
      dealHand(nextButtonSeatId(nextSeats, get().buttonSeatId, live))
    },

    leave: () => {
      clearTimers()
      clearTableSnapshot()
      armDaily(null)
      // Standing up closes the session, unless it closed itself: busting and
      // winning are already stamped, and `endReviewSession` leaves those alone
      // rather than relabelling a knockout as a walk to the door.
      //
      // The P/L is the one `LeaveDialog` shows — what the stack cashes for,
      // less everything bought in, rebuys included. Not the stack: two venues
      // deal chips that are not Roll chips (see `cashOutValue`).
      const { venue: leaving, seats: leavingSeats, cashInvested: invested } = get()
      if (leaving) {
        const stack = leavingSeats.find((s) => s.id === HUMAN_ID)?.stack ?? 0
        endReviewSession({
          kind: 'stood-up',
          rollDelta: cashOutValue(leaving, stack) - invested,
        })
      }
      set({
        venue: null,
        seats: [],
        hand: null,
        status: 'idle',
        buttonSeatId: null,
        heroEquity: null,
        aiThinkingId: null,
        message: null,
        place: null,
        smallBlind: 0,
        bigBlind: 0,
        blindLevel: 0,
        handIndex: 0,
        lastHand: null,
        lastRead: null,
        newAwards: [],
        lastBounty: 0,
        seatStats: {},
        recap: null,
        talk: null,
        cashInvested: 0,
      })
    },
  }
})

// --- helpers ---------------------------------------------------------------

/**
 * Lifetime tendencies as they stood before this run: the current totals minus
 * the run itself. Exact rather than approximate, because the run's hands are
 * flushed onto the lifetime totals one at a time from the same counter.
 */
function subtractStats(total: SeatStats, part: SeatStats): SeatStats {
  return {
    handsDealt: total.handsDealt - part.handsDealt,
    vpipHands: total.vpipHands - part.vpipHands,
    raises: total.raises - part.raises,
    calls: total.calls - part.calls,
    betsFaced: total.betsFaced - part.betsFaced,
    foldsToBet: total.foldsToBet - part.foldsToBet,
    showdowns: total.showdowns - part.showdowns,
  }
}

function computeHeroEquity(hand: HandState): number | null {
  const hero = hand.players.find((p) => p.id === HUMAN_ID)
  if (!hero || hero.hole.length < 2) return null
  // **No number at all at Five-Card Draw**, which is better than a wrong one.
  // `estimateEquity` works by running out a board, and a draw hand has none:
  // asked anyway it deals five community cards onto five hole cards and
  // evaluates ten, which produces a confident percentage of nothing. The real
  // answer would have to model what four opponents are about to discard, and
  // until that exists the odds panel shows an em dash.
  if (hand.variant === 'draw') return null
  const opponents = hand.players.filter(
    (p) => p.id !== HUMAN_ID && p.status !== 'folded' && p.status !== 'out',
  )
  if (opponents.length === 0) return 1
  return estimateEquity({
    hole: hero.hole,
    community: hand.community,
    opponents: opponents.length,
    opponentSelectivity: opponents.map((p) => opponentSelectivity(hand, p)),
    iterations: 800,
    variant: hand.variant,
  }).equity
}

/**
 * Vibrate, if the player asked for it. Off by default, so this is silent for
 * everyone who has not been into Settings, and it does nothing at all outside
 * Android and desktop Chrome (see lib/haptics).
 */
function buzz(cue: Buzz) {
  if (useProfile.getState().haptics) haptics.fire(cue)
}

function playActionSound(action: Action, hand: HandState) {
  // Cards going away and coming back has its own cue; `action.type` is not a
  // sound name for this one because "draw" is the only action that is not
  // about chips.
  if (action.type === 'draw') {
    sound.play('draw')
    return
  }
  const legal = legalActions(hand)
  if (action.type === 'raise' || action.type === 'bet') {
    const allIn = legal && action.amount === legal.maxRaiseTo
    sound.play(allIn ? 'allin' : action.type === 'bet' ? 'bet' : 'raise')
  } else {
    sound.play(action.type)
  }
}

function nextButtonSeatId(
  allSeats: SeatMeta[],
  currentButton: string | null,
  live: SeatMeta[],
): string {
  if (live.length === 0) return allSeats[0]?.id ?? ''
  const order = allSeats.map((s) => s.id)
  const start = currentButton ? order.indexOf(currentButton) : 0
  for (let i = 1; i <= order.length; i++) {
    const id = order[(start + i) % order.length]
    if (live.some((s) => s.id === id)) return id
  }
  return live[0].id
}

function buildHandRecord(
  hand: HandState,
  ctx: {
    handIndex: number
    smallBlind: number
    bigBlind: number
    heroStackBefore: number
    seats: SeatMeta[]
  },
): HandRecord {
  const showdown = hand.result?.showdown === true
  const reveals = hand.players
    .filter(
      (p) =>
        p.hole.length >= 2 &&
        (p.id === HUMAN_ID || (showdown && p.status !== 'folded' && p.status !== 'out')),
    )
    .map((p) => ({
      playerId: p.id,
      playerName: p.name,
      cards: p.hole.slice(),
      handName: hand.result?.evaluations?.[p.id]?.name,
    }))
  return {
    handNo: ctx.handIndex, // already incremented at deal → 1-based
    smallBlind: ctx.smallBlind,
    bigBlind: ctx.bigBlind,
    events: currentEvents,
    community: hand.community.slice(),
    reveals,
    seats: ctx.seats.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar })),
    buttonId: hand.players[hand.buttonIndex]?.id,
    start: handStart,
    hole: hand.players
      .filter((p) => p.hole.length >= 2)
      .map((p) => ({ playerId: p.id, cards: p.hole.slice() })),
    summary: describeResult(hand),
    heroDelta:
      (hand.players.find((p) => p.id === HUMAN_ID)?.stack ?? ctx.heroStackBefore) -
      ctx.heroStackBefore,
  }
}

function describeResult(hand: HandState): string {
  const r = hand.result
  if (!r) return ''
  const win = r.potsAwarded[0]
  if (!win) return ''
  const names = win.winners
    .map((id) => hand.players.find((p) => p.id === id)?.name ?? id)
    .join(' & ')
  if (r.showdown && r.evaluations) {
    const handName = r.evaluations[win.winners[0]]?.name
    return `${names} wins ${formatChips(win.amount)} with ${handName}`
  }
  return `${names} wins ${formatChips(win.amount)}`
}
