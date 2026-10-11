'use client'

// A multiplayer room, as the browser holds it: one socket to the room server
// and the last view it sent.
//
// **Nothing here decides anything.** The server deals, checks every move and
// runs the clock; this store sends what you pressed and draws what comes back.
// The one thing it does on its own is the Roll (lib/multiplayer/ledger), which
// is this device's to keep.

import { create } from 'zustand'
import { sessionToken, socketUrl } from '@/lib/multiplayer/client'
import { settle, type Ledger } from '@/lib/multiplayer/ledger'
import type {
  ClientMessage,
  MediaState,
  ReportReason,
  RTCIceServerLike,
  ServerError,
  ServerMessage,
} from '@/lib/multiplayer/protocol'
import type { RoomView } from '@/lib/multiplayer/view'
import type { Action } from '@/lib/poker/engine'
import { cuesFor } from '@/lib/multiplayer/cues'
import { haptics } from '@/lib/haptics'
import { legalActions, type HandState } from '@/lib/poker/engine'
import { type Cue, sound } from '@/lib/sound'
import { useProfile } from './profile'

export type RoomConnection = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'gone'

interface RoomStore {
  code: string | null
  connection: RoomConnection
  view: RoomView | null
  /** The server's clock minus this device's, so the turn timer reads true. */
  clockOffset: number
  error: ServerError | null
  /** Whose camera and mic are on, by seat. Private rooms only. */
  media: Record<string, MediaState>
  iceServers: RTCIceServerLike[]
  /** Set when this game has paid you, for the end card. */
  won: boolean
  /** Bumped each time a socket is seated, so anything per-connection can be sent again. */
  session: number
  /** Your move is on its way to the server: the buttons stand down until it answers. */
  pending: boolean
  enter: (code: string) => void
  /** Stand up: the seat is freed before the deal, folded for after it. */
  leave: () => void
  act: (action: Action) => void
  start: () => void
  addBots: (count: number) => void
  removeBot: (id: string) => void
  kick: (id: string) => void
  report: (id: string, reason: ReportReason) => void
  block: (id: string) => void
  setMedia: (media: MediaState) => void
  signal: (to: string, data: unknown) => void
  clearError: () => void
}

const LEDGER_KEY = 'pip.roomLedger'

function readLedger(): Ledger {
  try {
    return JSON.parse(localStorage.getItem(LEDGER_KEY) ?? '{}') as Ledger
  } catch {
    return {}
  }
}

function writeLedger(ledger: Ledger): void {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger))
  } catch {
    // Private mode: the books last as long as the tab, which is the game.
  }
}

/** Your own move's sound, played as you press it (the ladder's `playActionSound`). */
function soundForMove(action: Action, hand: HandState): Cue {
  if (action.type === 'draw') return 'draw'
  if (action.type === 'bet' || action.type === 'raise') {
    const legal = legalActions(hand)
    if (legal && action.amount === legal.maxRaiseTo) return 'allin'
    return action.type
  }
  return action.type
}

type SignalListener = (from: string, data: unknown) => void
const signalListeners = new Set<SignalListener>()

/** WebRTC's way in: offers, answers and candidates from the other seats. */
export function onSignal(listener: SignalListener): () => void {
  signalListeners.add(listener)
  return () => signalListeners.delete(listener)
}

let socket: WebSocket | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let attempts = 0
/** When this socket last heard anything from the server. */
let lastHeard = 0
/**
 * How often the socket is checked. A socket can die without closing (a phone
 * locking, a network that drops packets rather than refusing them), and a
 * browser may take minutes to notice. Until it does, nothing arrives: not the
 * bots' moves, not anybody's. So it is asked to answer every few seconds, and
 * one that has gone quiet is replaced rather than waited on.
 */
const PING_MS = 8_000
/** Silent for this long while pinging: the socket is dead. */
const STALE_MS = 20_000
/** Back on screen: a socket that cannot answer in this long is replaced. */
const WAKE_CHECK_MS = 3_000
/** The server said no for a reason a retry will not change. */
const FINAL_CLOSE = new Set([4000, 4001, 4004, 1000])

export const useRoom = create<RoomStore>((set, get) => {
  function send(msg: ClientMessage) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg))
  }

  function teardown() {
    if (pingTimer) clearInterval(pingTimer)
    if (retryTimer) clearTimeout(retryTimer)
    pingTimer = null
    retryTimer = null
    if (socket) {
      socket.onclose = null
      socket.onmessage = null
      socket.close()
    }
    socket = null
  }

  function onView(view: RoomView, now: number) {
    const prev = get().view
    // The Roll's books: the buy-in on the deal, the prize at the end.
    const result = settle(readLedger(), view, Date.now())
    writeLedger(result.ledger)
    if (result.delta !== 0) {
      const profile = useProfile.getState()
      profile.adjustRoll(result.delta)
      if (view.phase === 'finished') profile.recordRollPoint()
    }
    // The table's sounds and buzzes, as the ladder has them (lib/multiplayer/cues).
    const buzzing = useProfile.getState().haptics
    for (const cue of cuesFor(prev, view)) {
      if (cue === 'bust' || cue === 'finish') {
        if (buzzing) haptics.fire(cue)
      } else {
        sound.play(cue as Cue)
      }
    }
    set({
      view,
      clockOffset: now - Date.now(),
      won: get().won || result.won,
      pending: false,
    })
  }

  /** Drop a socket that has gone quiet and dial again now, not after a backoff. */
  function redial() {
    const code = get().code
    if (!code || get().connection === 'gone') return
    teardown()
    attempts = 0
    set({ connection: 'reconnecting' })
    void open(code)
  }

  /** Ask the server to answer; if it has not shortly, the socket is dead. */
  function check() {
    if (!get().code || get().connection === 'gone') return
    if (socket?.readyState !== WebSocket.OPEN) return
    const asked = Date.now()
    send({ t: 'ping' })
    setTimeout(() => {
      if (lastHeard < asked && socket?.readyState === WebSocket.OPEN) redial()
    }, WAKE_CHECK_MS)
  }

  // Coming back to the app (unlocking the phone, switching back to the tab)
  // and coming back online are when a dead socket is likeliest: checked then,
  // rather than at the next ping.
  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    window.addEventListener('online', check)
  }

  async function open(code: string) {
    const token = await sessionToken()
    if (get().code !== code) return
    if (!token) {
      set({ connection: 'gone', error: 'auth' })
      return
    }
    const ws = new WebSocket(socketUrl(`/rooms/${code}/ws`))
    socket = ws
    // The first view on a socket is the server saying you are seated on it.
    let seated = false
    ws.onopen = () => {
      attempts = 0
      lastHeard = Date.now()
      const { name, avatar, avatarRing } = useProfile.getState()
      ws.send(
        JSON.stringify({
          t: 'hello',
          token,
          name,
          avatar: avatar ?? { seed: name || 'pip', backgroundColor: 'b6e3f4' },
          ring: avatarRing,
        } satisfies ClientMessage),
      )
      set({ connection: 'open' })
      pingTimer = setInterval(() => {
        if (Date.now() - lastHeard > STALE_MS) redial()
        else send({ t: 'ping' })
      }, PING_MS)
    }
    ws.onmessage = (e) => {
      lastHeard = Date.now()
      let msg: ServerMessage
      try {
        msg = JSON.parse(String(e.data)) as ServerMessage
      } catch {
        return
      }
      switch (msg.t) {
        case 'room':
          if (!seated) {
            seated = true
            set({ session: get().session + 1 })
          }
          return onView(msg.view, msg.now)
        case 'error':
          // A refused move gives the buttons back.
          return set({ error: msg.error, pending: false })
        case 'media':
          return set({ media: msg.media })
        case 'ice':
          return set({ iceServers: msg.iceServers })
        case 'reported':
          // The sheet has already thanked them; this is the server agreeing.
          return
        case 'signal':
          for (const l of signalListeners) l(msg.from, msg.data)
          return
      }
    }
    ws.onclose = (e) => {
      if (pingTimer) clearInterval(pingTimer)
      pingTimer = null
      socket = null
      if (get().code !== code) return
      if (FINAL_CLOSE.has(e.code)) {
        set({ connection: 'gone' })
        return
      }
      // A dropped connection (a phone locking, a train going into a tunnel)
      // comes back by itself, sooner at first and then less often.
      set({ connection: 'reconnecting' })
      const wait = Math.min(15_000, 500 * 2 ** attempts++)
      retryTimer = setTimeout(() => void open(code), wait)
    }
  }

  return {
    code: null,
    connection: 'idle',
    view: null,
    clockOffset: 0,
    error: null,
    media: {},
    iceServers: [],
    won: false,
    session: 0,
    pending: false,

    enter: (code) => {
      if (get().code === code && get().connection !== 'gone') return
      teardown()
      attempts = 0
      set({
        code,
        connection: 'connecting',
        view: null,
        error: null,
        media: {},
        iceServers: [],
        won: false,
      })
      void open(code)
    },

    leave: () => {
      send({ t: 'leave' })
      teardown()
      set({ code: null, connection: 'idle', view: null, media: {}, error: null })
    },

    act: (action) => {
      // Sounded and cleared from the screen the moment it is pressed, as on the
      // ladder: the server's answer is a round trip away, and a tap that does
      // nothing until it lands feels like lag even when it is quick.
      const hand = get().view?.hand
      if (hand) sound.play(soundForMove(action, hand))
      set({ pending: true })
      send({ t: 'act', action })
    },
    start: () => send({ t: 'start' }),
    addBots: (count) => send({ t: 'bots', count }),
    removeBot: (id) => send({ t: 'unbot', id }),
    kick: (id) => send({ t: 'kick', id }),
    report: (id, reason) => send({ t: 'report', id, reason }),
    block: (id) => send({ t: 'block', id }),
    setMedia: (media) => send({ t: 'media', media }),
    signal: (to, data) => send({ t: 'signal', to, data }),
    clearError: () => set({ error: null }),
  }
})
