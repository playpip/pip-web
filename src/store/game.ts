// Transient game orchestration (not persisted). Wraps the pure engine into a
// winner-take-all SIT-AND-GO: the human buys in from their Roll, everyone sits
// with equal stacks (the buy-in), and play continues until one player is left.
// Bust and you're out; win the table and the prize is added to your Roll.

'use client'

import { create } from 'zustand'
import type { AvatarSpec } from '@/lib/avatar'
import { randomAvatar } from '@/lib/avatar'
import { sound } from '@/lib/sound'
import { pickNames } from '@/config/names'
import { pickBio, styleFor, randomBankroll } from '@/config/opponents'
import { blindsAt } from '@/config/blinds'
import { freerollOpen, type Venue } from '@/config/venues'
import { detectAwards, type AwardDef } from '@/lib/awards'
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
import { decideAction } from '@/lib/poker/ai/policy'
import { estimateEquity } from '@/lib/poker/equity'
import type { Card } from '@/lib/poker/cards'
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
}

export type GameStatus = 'idle' | 'playing' | 'handover' | 'busted' | 'won'

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
  summary: string
}

const HUMAN_ID = 'hero'
// AI acts a touch slower while the human is still contesting the pot (so it's
// followable), and briskly once the human has folded and is just spectating.
const AI_DELAY_IN_HAND = 1050
const AI_DELAY_FOLDED = 450

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
  /** Award chips earned on the just-finished hand (for the quiet earn line). */
  newAwards: AwardDef[]

  sitDown: (venue: Venue, human: { name: string; avatar: AvatarSpec }) => void
  /** Rebuild an interrupted table from its snapshot (no buy-in taken). */
  resumeTable: (venue: Venue, snapshot: TableSnapshot) => void
  act: (action: Action) => void
  nextHand: () => void
  leave: () => void
}

let turnTimer: ReturnType<typeof setTimeout> | null = null

function clearTimers() {
  if (turnTimer) clearTimeout(turnTimer)
  turnTimer = null
}

// --- table snapshot ----------------------------------------------------------
// The game store is transient, but a hard refresh mid-tournament must not eat
// the buy-in. The live table (stacks, button, hand number) is snapshotted to
// localStorage at every deal and hand end; the play page resumes from it
// instead of buying in again. Cleared on every legitimate exit (leave, bust,
// win) and overwritten when a new table starts.

const TABLE_KEY = 'pip.table'

export interface TableSnapshot {
  venueId: string
  /** Stacks as of the coming (re-)deal. */
  seats: SeatMeta[]
  /** Button to use for the (re-)deal on resume. */
  buttonSeatId: string
  handIndex: number
  heroLow: number
}

function saveTableSnapshot(snap: TableSnapshot) {
  try {
    localStorage.setItem(TABLE_KEY, JSON.stringify(snap))
  } catch {
    /* storage unavailable — refresh-resume simply won't work */
  }
}

function clearTableSnapshot() {
  try {
    localStorage.removeItem(TABLE_KEY)
  } catch {}
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
    })
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

  function dealHand(buttonSeatId: string) {
    const configs = liveSeatConfigs()
    const buttonIndex = Math.max(0, configs.findIndex((c) => c.id === buttonSeatId))
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
    })
    sound.play('deal')
    currentEvents = []
    set({
      hand,
      status: 'playing',
      newAwards: [],
      buttonSeatId: configs[buttonIndex].id,
      smallBlind: blinds.smallBlind,
      bigBlind: blinds.bigBlind,
      blindLevel: blinds.level,
      handIndex: handIndex + 1,
    })
    // A refresh mid-hand resumes by re-dealing this hand from its start.
    saveTableSnapshot({
      venueId: venue!.id,
      seats: get().seats,
      buttonSeatId: configs[buttonIndex].id,
      handIndex,
      heroLow: heroLowTide,
    })
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
      const action = decideAction(cur, venue.ai)
      playActionSound(action, cur)
      const next = applyAction(cur, action)
      recordStep(cur, action, next)
      set({ hand: next })
      progress()
    }, delay)
  }

  function finishHand() {
    const { hand, seats, venue } = get()
    if (!hand || !venue) return

    const stackById = new Map(hand.players.map((p) => [p.id, p.stack]))
    const nextSeats = seats.map((s) => ({ ...s, stack: stackById.get(s.id) ?? s.stack }))

    const result = hand.result
    set({ lastHand: buildHandRecord(hand, get()) })
    const heroWon = !!result && (result.payouts[HUMAN_ID] ?? 0) > 0
    const pot = potSize(hand)

    const profile = useProfile.getState()
    profile.mergeStats({
      handsPlayed: 1,
      handsWon: heroWon ? 1 : 0,
      biggestPot: heroWon ? pot : 0,
      showdownsWon: heroWon && result?.showdown ? 1 : 0,
    })

    if (result) sound.play(heroWon ? 'win' : result.showdown ? 'lose' : 'tap')

    const survivors = nextSeats.filter((s) => s.stack > 0)
    const humanAlive = (stackById.get(HUMAN_ID) ?? 0) > 0
    const tournamentWon = humanAlive && survivors.length === 1

    // The Bouncer: an opponent busted this hand and every pot went to the hero.
    const opponentBusted = seats.some(
      (s) => s.id !== HUMAN_ID && s.stack > 0 && (stackById.get(s.id) ?? 0) === 0,
    )
    const heroTookAll =
      !!result && Object.entries(result.payouts).every(([id, amt]) => id === HUMAN_ID || amt === 0)
    const knockedOut = heroWon && opponentBusted && heroTookAll

    // Tournament outcomes.
    if (!humanAlive) {
      clearTableSnapshot()
      const place = survivors.length + 1
      profile.recordVenueResult(venue.id, place, get().handIndex)
      profile.recordRollPoint()
      // Busting back below the ladder resets the freeroll comeback story.
      if (profile.cameFromFreeroll && freerollOpen(profile.roll)) {
        profile.setCameFromFreeroll(false)
      }
      set({ seats: nextSeats, hand, status: 'busted', place, aiThinkingId: null, message: null })
      return
    }
    if (tournamentWon) {
      clearTableSnapshot()
      profile.adjustRoll(venue.prize)
      profile.mergeStats({ tournamentsWon: 1 })
      profile.recordVenueResult(venue.id, 1, get().handIndex)
      profile.recordRollPoint()
      if (venue.freeroll) profile.setCameFromFreeroll(true)
      const newAwards = grantEarnedAwards(hand, venue, heroWon, true, knockedOut)
      set({ seats: nextSeats, hand, status: 'won', place: 1, aiThinkingId: null, message: null, newAwards })
      return
    }

    // Otherwise: pause on the result until the player taps "Next hand".
    const newAwards = grantEarnedAwards(hand, venue, heroWon, false, knockedOut)
    heroLowTide = Math.min(heroLowTide, stackById.get(HUMAN_ID) ?? 0)
    // A refresh during the handover resumes with the next hand, chips intact.
    saveTableSnapshot({
      venueId: venue.id,
      seats: nextSeats,
      buttonSeatId: nextButtonSeatId(nextSeats, get().buttonSeatId, nextSeats.filter((s) => s.stack > 0)),
      handIndex: get().handIndex,
      heroLow: heroLowTide,
    })
    set({
      seats: nextSeats,
      hand,
      status: 'handover',
      aiThinkingId: null,
      message: describeResult(hand),
      newAwards,
    })
  }

  /** Detect + persist chips earned on this hand; returns them for the UI. */
  function grantEarnedAwards(
    hand: HandState,
    venue: Venue,
    heroWon: boolean,
    tournamentWon: boolean,
    knockedOut: boolean,
  ): AwardDef[] {
    const profile = useProfile.getState() // re-read: the prize may have just landed
    const earned = detectAwards(
      {
        venue,
        heroWon,
        showdown: hand.result?.showdown === true,
        heroHand: hand.result?.evaluations?.[HUMAN_ID],
        heroHole: hand.players.find((p) => p.id === HUMAN_ID)?.hole,
        knockedOut,
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
    newAwards: [],

    sitDown: (venue, human) => {
      clearTimers()
      const stack = venue.startingStack ?? venue.buyIn
      heroLowTide = stack
      const aiCount = venue.seats - 1
      const names = pickNames(aiCount)
      const aiSeats: SeatMeta[] = names.map((name, i) => ({
        id: `ai${i}`,
        name,
        avatar: randomAvatar(i),
        isHuman: false,
        stack,
        style: styleFor(venue.ai),
        bio: pickBio(),
        bankroll: randomBankroll(venue),
      }))
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
      profile.adjustRoll(-venue.buyIn) // pay the buy-in
      profile.mergeStats({ tournamentsEntered: 1 })
      profile.recordVenueEntry(venue.id)

      set({
        venue,
        seats,
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
        newAwards: [],
      })
      dealHand(seats[0].id)
    },

    resumeTable: (venue, snapshot) => {
      clearTimers()
      heroLowTide = snapshot.heroLow
      set({
        venue,
        seats: snapshot.seats,
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
        newAwards: [],
      })
      dealHand(snapshot.buttonSeatId)
    },

    act: (action) => {
      const { hand } = get()
      if (!hand || isHandComplete(hand)) return
      const toAct = hand.players[hand.toActIndex]
      if (!toAct || toAct.id !== HUMAN_ID) return
      playActionSound(action, hand)
      const next = applyAction(hand, action)
      recordStep(hand, action, next)
      set({ hand: next, heroEquity: null })
      progress()
    },

    nextHand: dealNextHand,

    leave: () => {
      clearTimers()
      clearTableSnapshot()
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
        newAwards: [],
      })
    },
  }
})

// --- helpers ---------------------------------------------------------------

function computeHeroEquity(hand: HandState): number | null {
  const hero = hand.players.find((p) => p.id === HUMAN_ID)
  if (!hero || hero.hole.length < 2) return null
  const opponents = hand.players.filter(
    (p) => p.id !== HUMAN_ID && p.status !== 'folded' && p.status !== 'out',
  ).length
  if (opponents <= 0) return 1
  return estimateEquity({
    hole: hero.hole,
    community: hand.community,
    opponents,
    iterations: 800,
  }).equity
}

function playActionSound(action: Action, hand: HandState) {
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
  ctx: { handIndex: number; smallBlind: number; bigBlind: number },
): HandRecord {
  const showdown = hand.result?.showdown === true
  const reveals = hand.players
    .filter(
      (p) =>
        p.hole.length === 2 &&
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
    summary: describeResult(hand),
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
    return `${names} wins ${win.amount} with ${handName}`
  }
  return `${names} wins ${win.amount}`
}
