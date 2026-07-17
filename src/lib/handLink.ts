// Hand permalinks — a completed hand encoded into a URL fragment, so a replay
// can be shared with no server and no account: the hand IS the link. Decoding
// is defensive (links arrive from the outside world); anything malformed
// returns null rather than throwing. Fragment, not query: it never appears in
// server logs even when Pip is hosted.

import type { HandEvent, HandRecord } from '@/store/game'
import { cardFromString, cardToString, RANKS, SUITS, type Card } from '@/lib/poker/cards'

/** Bumped if the wire format ever changes; old links refuse cleanly. */
const LINK_VERSION = 1

const ACTION_CODES = { fold: 'f', check: 'k', call: 'c', bet: 'b', raise: 'r' } as const
const CODE_ACTIONS = Object.fromEntries(
  Object.entries(ACTION_CODES).map(([k, v]) => [v, k]),
) as Record<string, keyof typeof ACTION_CODES>

interface WireHand {
  v: number
  /** Hand number + blinds. */
  n: number
  b: [number, number]
  /** Player names, in first-appearance order; `h` is the hero's index. */
  p: string[]
  h: number
  /** Events: [playerIndex, actionCode, amount?] or ['*', boardLabel, cards]. */
  e: (readonly (string | number)[])[]
  /** Community + reveals ([playerIndex, cards, handName?]) + summary. */
  c: string
  r: (readonly (string | number)[])[]
  s: string
}

/** Encode a completed hand for the /hand route. Returns a base64url token. */
export function encodeHand(record: HandRecord): string {
  const players: string[] = []
  const ids: string[] = []
  const indexOf = (id: string, name: string): number => {
    const existing = ids.indexOf(id)
    if (existing >= 0) return existing
    ids.push(id)
    players.push(name)
    return ids.length - 1
  }

  const events = record.events.map((ev) =>
    ev.kind === 'board'
      ? (['*', ev.label, ev.cards.map(cardToString).join('')] as const)
      : ([
          indexOf(ev.playerId, ev.playerName),
          ACTION_CODES[ev.type],
          ...(ev.amount !== undefined ? [ev.amount] : []),
        ] as const),
  )
  const reveals = record.reveals.map(
    (r) =>
      [
        indexOf(r.playerId, r.playerName),
        r.cards.map(cardToString).join(''),
        ...(r.handName ? [r.handName] : []),
      ] as const,
  )
  const wire: WireHand = {
    v: LINK_VERSION,
    n: record.handNo,
    b: [record.smallBlind, record.bigBlind],
    p: players,
    h: ids.indexOf('hero'),
    e: events,
    c: record.community.map(cardToString).join(''),
    r: reveals,
    s: record.summary,
  }
  return toBase64Url(new TextEncoder().encode(JSON.stringify(wire)))
}

/** Decode a /hand token back into a replayable record. Null if malformed. */
export function decodeHand(token: string): HandRecord | null {
  let wire: WireHand
  try {
    const bytes = fromBase64Url(token)
    if (!bytes) return null
    wire = JSON.parse(new TextDecoder().decode(bytes)) as WireHand
  } catch {
    return null
  }
  if (wire?.v !== LINK_VERSION) return null
  if (!Array.isArray(wire.p) || !wire.p.every((n) => typeof n === 'string')) return null
  if (!Array.isArray(wire.b) || wire.b.length !== 2) return null
  if (!Array.isArray(wire.e) || !Array.isArray(wire.r)) return null

  // Re-synthesise ids: the hero keeps the 'hero' id so UI styling carries over.
  const idFor = (i: number) => (i === wire.h ? 'hero' : `p${i}`)
  const nameFor = (i: number) => wire.p[i]

  const events: HandEvent[] = []
  for (const raw of wire.e) {
    if (raw[0] === '*') {
      const cards = parseCards(raw[2])
      if (typeof raw[1] !== 'string' || !cards) return null
      events.push({ kind: 'board', label: raw[1], cards })
    } else {
      const [pi, code, amount] = raw
      const type = typeof code === 'string' ? CODE_ACTIONS[code] : undefined
      if (typeof pi !== 'number' || !nameFor(pi) || !type) return null
      if (amount !== undefined && typeof amount !== 'number') return null
      events.push({
        kind: 'action',
        playerId: idFor(pi),
        playerName: nameFor(pi),
        type,
        ...(amount !== undefined ? { amount } : {}),
      })
    }
  }

  const community = parseCards(wire.c)
  if (!community) return null

  const reveals: HandRecord['reveals'] = []
  for (const raw of wire.r) {
    const [pi, cardStr, handName] = raw
    const cards = typeof cardStr === 'string' ? parseCards(cardStr) : null
    if (typeof pi !== 'number' || !nameFor(pi) || !cards || cards.length !== 2) return null
    if (handName !== undefined && typeof handName !== 'string') return null
    reveals.push({
      playerId: idFor(pi),
      playerName: nameFor(pi),
      cards,
      ...(handName !== undefined ? { handName } : {}),
    })
  }

  return {
    handNo: typeof wire.n === 'number' ? wire.n : 0,
    smallBlind: wire.b[0],
    bigBlind: wire.b[1],
    events,
    community,
    reveals,
    summary: typeof wire.s === 'string' ? wire.s : '',
  }
}

/** "AhKd" → cards, or null on any bad token. */
function parseCards(s: unknown): Card[] | null {
  if (typeof s !== 'string' || s.length % 2 !== 0) return null
  const cards: Card[] = []
  for (let i = 0; i < s.length; i += 2) {
    const card = cardFromString(s.slice(i, i + 2))
    if (!RANKS.includes(card.rank) || !SUITS.includes(card.suit)) return null
    cards.push(card)
  }
  return cards
}

// --- base64url, portable (browser + node test runner) -------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const B64_INDEX = new Map([...B64].map((ch, i) => [ch, i]))

function toBase64Url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)]
    if (b === undefined) break
    out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)]
    if (c === undefined) break
    out += B64[c & 63]
  }
  return out
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9\-_]*$/.test(s) || s.length % 4 === 1) return null
  const out: number[] = []
  for (let i = 0; i < s.length; i += 4) {
    const chunk = [...s.slice(i, i + 4)].map((ch) => B64_INDEX.get(ch) ?? 0)
    out.push((chunk[0] << 2) | (chunk[1] >> 4))
    if (s.length > i + 2) out.push(((chunk[1] & 15) << 4) | (chunk[2] >> 2))
    if (s.length > i + 3) out.push(((chunk[2] & 3) << 6) | chunk[3])
  }
  return new Uint8Array(out)
}
