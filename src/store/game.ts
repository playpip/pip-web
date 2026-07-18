// Transient game orchestration (not persisted). Wraps the pure engine into a
// winner-take-all SIT-AND-GO: the human buys in from their Roll, everyone sits
// with equal stacks (the buy-in), and play continues until one player is left.
// Bust and you're out; win the table and the prize is added to your Roll.

'use client'

import { create } from 'zustand'
import type { AvatarSpec } from '@/lib/avatar'
import { sound } from '@/lib/sound'
import { draftCast, profileFor, characterById } from '@/config/cast'
import { styleFor, randomBankroll } from '@/config/opponents'
import type { AiProfile } from '@/lib/poker/ai/policy'
import { blindsAt } from '@/config/blinds'
import { freerollOpen, type Venue } from '@/config/venues'
import { detectAwards, type AwardDef } from '@/lib/awards'
import { emptySeatStats, type SeatStats } from '@/lib/reads'
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
import { mulberry32, type Card, type Rng } from '@/lib/poker/cards'
import { dailyDateKey, dailyNumber, dailySeed, handSeed } from '@/lib/daily'
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
  /** Bounty chips collected on the just-finished hand (bounty tables). */
  lastBounty: number
  /** Observed tendencies per seat this tournament (feeds the reads in the player dialog). */
  seatStats: Record<string, SeatStats>
  /** One quiet line of character flavour, heavily rationed (see docs/cast.md). */
  talk: string | null

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
  /** Which day's Daily this table is — keeps the seed stable across midnight. */
  dailyDate?: string
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

/** Live tendency counters (mirrored into state at hand boundaries). */
let seatStatsLive: Record<string, SeatStats> = {}
/** Hero tendencies already pushed to the lifetime profile — the flush baseline. */
let heroTendencyFlushed: SeatStats = emptySeatStats()
/** Cast tendencies already pushed to career records — flush baselines by seat. */
let castFlushed: Record<string, SeatStats> = {}

// --- the Daily Deal ------------------------------------------------------------
// While a Daily table is live, decks come from a date-derived seed (hand n is
// mulberry32(handSeed(base, n)) — so a refresh re-deals hand n identically) and
// AI decisions draw from a seeded stream. Everything else is the normal loop.

let dailyBase: number | null = null
let dailyDay: string | null = null
let dailyAiRng: Rng | null = null

function armDaily(dateKey: string | null) {
  dailyDay = dateKey
  dailyBase = dateKey ? dailySeed(dateKey) : null
  dailyAiRng = dailyBase !== null ? mulberry32(dailyBase ^ 0x5f356495) : null
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
    })
    sound.play('deal')
    currentEvents = []
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
    // A refresh mid-hand resumes by re-dealing this hand from its start.
    saveTableSnapshot({
      venueId: venue!.id,
      seats: get().seats,
      buttonSeatId: configs[buttonIndex].id,
      handIndex,
      heroLow: heroLowTide,
      dailyDate: dailyDay ?? undefined,
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
      const seatAi = get().seats.find((s) => s.id === toAct.id)?.ai
      const action = decideAction(cur, seatAi ?? venue.ai, dailyAiRng ?? Math.random)
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
    if (result?.showdown) {
      for (const p of hand.players) {
        if (p.status !== 'folded' && p.status !== 'out') statsFor(p.id).showdowns++
      }
    }
    set({ lastHand: buildHandRecord(hand, get()), seatStats: { ...seatStatsLive } })
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

    // Career scalps: you took a character's last chip.
    if (knockedOut) {
      for (const s of eliminated) {
        if (s.characterId) profile.recordCastKnockout(s.characterId)
      }
    }

    // Tournament outcomes.
    if (!humanAlive) {
      clearTableSnapshot()
      const place = survivors.length + 1
      profile.recordVenueResult(venue.id, place, get().handIndex)
      if (venue.daily && dailyDay) profile.recordDailyResult(dailyDay, place, get().handIndex)
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
      if (venue.daily && dailyDay) profile.recordDailyResult(dailyDay, 1, get().handIndex)
      profile.recordRollPoint()
      if (venue.freeroll) profile.setCameFromFreeroll(true)
      const newAwards = grantEarnedAwards(hand, venue, heroWon, true, knockedOut, eliminatedCount)
      set({
        seats: nextSeats,
        hand,
        status: 'won',
        place: 1,
        aiThinkingId: null,
        message: null,
        newAwards,
        lastBounty: bountyWon,
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
      dailyDate: dailyDay ?? undefined,
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
    const earned = detectAwards(
      {
        venue,
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
    newAwards: [],
    lastBounty: 0,
    seatStats: {},
    talk: null,

    sitDown: (venue, human) => {
      clearTimers()
      const stack = venue.startingStack ?? venue.buyIn
      heroLowTide = stack
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
      const cast = draftCast(
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
        lastBounty: 0,
        seatStats: {},
        talk: null,
      })
      dealHand(seats[0].id)
      // Someone might say hello — one line at most, often nobody.
      const speaker = aiSeats[Math.floor(Math.random() * aiSeats.length)]
      const seatTalk = maybeTalk('seat', speaker, 0, 0.6)
      if (seatTalk) set({ talk: seatTalk })
    },

    resumeTable: (venue, snapshot) => {
      clearTimers()
      heroLowTide = snapshot.heroLow
      seatStatsLive = {}
      heroTendencyFlushed = emptySeatStats()
      castFlushed = {}
      lastTalkHand = -TALK_MIN_GAP_HANDS
      // Resume a Daily under its original day's seed, even across midnight.
      armDaily(venue.daily ? (snapshot.dailyDate ?? dailyDateKey()) : null)
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
        lastBounty: 0,
        talk: null,
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
      armDaily(null)
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
        lastBounty: 0,
        seatStats: {},
        talk: null,
      })
    },
  }
})

// --- helpers ---------------------------------------------------------------

// How "self-selected" an opponent's range looks, in [0, ~0.8]. Someone who's
// piled chips in — especially betting on later streets — is far likelier to
// hold a real hand than a random two cards, so the win % shouldn't treat them
// as random. Derived from chips committed this hand (in big blinds) plus a bump
// for putting money in postflop.
function opponentSelectivity(hand: HandState, opp: HandState['players'][number]): number {
  const bb = Math.max(hand.bigBlind, 1)
  const bbIn = opp.committedThisHand / bb
  let sel = bbIn / (bbIn + 5) // saturating: 1bb→0.17, 5bb→0.5, 15bb→0.75
  const backedItPostflop =
    hand.street !== 'preflop' && hand.currentBet > 0 && opp.committedThisStreet >= hand.currentBet
  if (backedItPostflop) sel += 0.1
  return Math.min(sel, 0.8)
}

function computeHeroEquity(hand: HandState): number | null {
  const hero = hand.players.find((p) => p.id === HUMAN_ID)
  if (!hero || hero.hole.length < 2) return null
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
    return `${names} wins ${formatChips(win.amount)} with ${handName}`
  }
  return `${names} wins ${formatChips(win.amount)}`
}
