// Hand permalinks — a completed hand encoded into a URL fragment, so a replay
// can be shared with no server and no account: the hand IS the link. Decoding
// is defensive (links arrive from the outside world); anything malformed
// returns null rather than throwing. Fragment, not query: it never appears in
// server logs even when Pip is hosted.

//
// Two versions are live. **v1** is the hand as the table showed it: the action,
// the board, and whatever was turned over. **v2** is v1 plus everything the
// session review needs to put the hand back on the felt — who sat where and
// what they looked like, every hole card, the pot and stacks after each move,
// the button, and the price on each of your calls — so a shared hand opens as
// a public review of that one hand. v1 is still what gets written when there is
// nothing extra to carry, so links out in the world and the report's evidence
// tokens (synced with the profile, where size matters) keep decoding anywhere.

import type { HandEvent, HandRecord } from '@/store/game'
import type { GradedDecision, Grade } from '@/lib/review/grade'
import { verdictOf } from '@/lib/review/grade'
import type { PricedStreet } from '@/lib/coach'
import { cardFromString, cardToString, RANKS, SUITS, type Card } from '@/lib/poker/cards'

/** Bumped if the wire format ever changes; unknown versions refuse cleanly. */
const LINK_VERSION = 1
/** The same hand, with what the review reads riding along. */
const REVIEW_VERSION = 2

// One letter per action. `d` is Five-Card Draw's discard, added with the
// variant: an old reader meeting a new link fails on a code it does not
// recognise, which is a clean failure, rather than on a shape it did not expect.
const ACTION_CODES = {
  fold: 'f',
  check: 'k',
  call: 'c',
  bet: 'b',
  raise: 'r',
  draw: 'd',
} as const
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
  // --- v2 only -------------------------------------------------------------
  /** Where it was played. */
  vn?: string
  /** Seats, in seat order, as player indexes; `a` is each one's avatar. */
  t?: number[]
  a?: [string, string][]
  /** Every hole card, per player index ('' where nobody knows). */
  o?: string[]
  /** Button, as a player index. */
  k?: number
  /** The table as the cards landed, then after each event: [pot, stacks, committed]. */
  st?: Snapshot
  x?: (Snapshot | 0)[]
  /** Your graded calls and folds: [event, street, folded, required, equity, toCall, pot, margin, bb, grade]. */
  d?: (readonly (string | number)[])[]
}

/** Pot, then stacks and chips in front indexed by player. */
type Snapshot = [number, number[], number[]]

/** What a shared hand carries besides the record itself. */
export interface SharedHand {
  record: HandRecord
  /** Your priced decisions, graded — the review's second opinion. Empty on v1. */
  decisions: GradedDecision[]
  /** The table it was played at, when the sharer knew. */
  venueName: string | null
}

const STREETS: readonly PricedStreet[] = ['preflop', 'flop', 'turn', 'river']
const GRADES: readonly Grade[] = ['sharp', 'sound', 'close', 'slip', 'costly']
/** Fractions to three places: a percentage on screen never needs more. */
const frac = (n: number) => Math.round(n * 1000) / 1000

/**
 * Encode a completed hand for the /hand route. Returns a base64url token.
 *
 * Pass `review` to carry what the public review needs. Without it — or for a
 * hand that never recorded the table (an old record, a Draw or Omaha hand the
 * review cannot grade) — the token is a plain v1 link.
 */
export function encodeHand(
  record: HandRecord,
  review?: { decisions?: readonly GradedDecision[]; venueName?: string },
): string {
  const players: string[] = []
  const ids: string[] = []
  const indexOf = (id: string, name: string): number => {
    const existing = ids.indexOf(id)
    if (existing >= 0) return existing
    ids.push(id)
    players.push(name)
    return ids.length - 1
  }
  const full = review !== undefined && reviewable(record)
  // Seats first, so everybody who sat down has an index — including anybody
  // who never spoke in the hand.
  if (full) for (const seat of record.seats ?? []) indexOf(seat.id, seat.name)

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

  if (full && review) {
    const seats = record.seats ?? []
    const byIndex = (map: Record<string, number> | undefined) => ids.map((id) => map?.[id] ?? 0)
    const snap = (
      pot: number,
      stacks?: Record<string, number>,
      committed?: Record<string, number>,
    ) => [pot, byIndex(stacks), byIndex(committed)] as Snapshot
    wire.v = REVIEW_VERSION
    if (review.venueName) wire.vn = review.venueName
    wire.t = seats.map((seat) => ids.indexOf(seat.id))
    wire.a = seats.map((seat) => [seat.avatar.seed, seat.avatar.backgroundColor])
    wire.o = ids.map(
      (id) =>
        record.hole
          ?.find((h) => h.playerId === id)
          ?.cards.map(cardToString)
          .join('') ?? '',
    )
    if (record.buttonId) wire.k = ids.indexOf(record.buttonId)
    if (record.start) wire.st = snap(record.start.pot, record.start.stacks, record.start.committed)
    wire.x = record.events.map((ev) =>
      ev.kind === 'action' && ev.pot !== undefined ? snap(ev.pot, ev.stacks, ev.committed) : 0,
    )
    wire.d = (review.decisions ?? []).map((d) => [
      d.eventIndex,
      STREETS.indexOf(d.street),
      d.folded ? 1 : 0,
      frac(d.required),
      frac(d.equity),
      d.toCall,
      d.pot,
      Math.round(d.margin),
      Math.round(d.bb * 100) / 100,
      GRADES.indexOf(d.grade),
    ])
  }
  return toBase64Url(new TextEncoder().encode(JSON.stringify(wire)))
}

/**
 * Can this hand go out as a review?
 *
 * It needs the table it was played at (seats, and the chips recorded on each
 * move — what `gradeable` in lib/review/moveGrade asks for) and two-card hands,
 * because the review's arithmetic is Hold'em equity: an Omaha hand graded by it
 * would be confidently wrong, which is worse than a plain replay.
 */
export function reviewable(record: HandRecord): boolean {
  if (!record.seats?.length || !record.hole?.length) return false
  if (!record.hole.every((h) => h.cards.length === 2)) return false
  return record.events.some((ev) => ev.kind === 'action' && ev.committed !== undefined)
}

/** Decode a /hand token back into a replayable record. Null if malformed. */
export function decodeHand(token: string): HandRecord | null {
  return decodeShared(token)?.record ?? null
}

/** Decode a /hand token with everything it carries. Null if malformed. */
export function decodeShared(token: string): SharedHand | null {
  let wire: WireHand
  try {
    const bytes = fromBase64Url(token)
    if (!bytes) return null
    wire = JSON.parse(new TextDecoder().decode(bytes)) as WireHand
  } catch {
    return null
  }
  if (wire?.v !== LINK_VERSION && wire?.v !== REVIEW_VERSION) return null
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

  const record: HandRecord = {
    handNo: typeof wire.n === 'number' ? wire.n : 0,
    smallBlind: wire.b[0],
    bigBlind: wire.b[1],
    events,
    community,
    reveals,
    summary: typeof wire.s === 'string' ? wire.s : '',
  }
  if (wire.v === LINK_VERSION) return { record, decisions: [], venueName: null }

  // v2: the review's half. Any of it malformed and the whole link is refused —
  // a review drawn from half a table would be wrong in ways nobody could see.
  return decodeReview(wire, record, idFor)
}

function decodeReview(
  wire: WireHand,
  record: HandRecord,
  idFor: (i: number) => string,
): SharedHand | null {
  const count = wire.p.length
  const isIndex = (i: unknown): i is number =>
    typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < count
  const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
  const toMap = (values: unknown): Record<string, number> | null => {
    if (!Array.isArray(values) || values.length !== count || !values.every(isNum)) return null
    return Object.fromEntries(values.map((v, i) => [idFor(i), v]))
  }
  const snapshot = (raw: unknown) => {
    if (!Array.isArray(raw) || raw.length !== 3 || !isNum(raw[0])) return null
    const stacks = toMap(raw[1])
    const committed = toMap(raw[2])
    return stacks && committed ? { pot: raw[0], stacks, committed } : null
  }

  const { t, a, o, x, d } = wire
  if (!Array.isArray(t) || !t.every(isIndex) || !Array.isArray(a) || a.length !== t.length) {
    return null
  }
  if (!Array.isArray(o) || o.length !== count) return null
  if (!Array.isArray(x) || x.length !== record.events.length) return null
  if (!Array.isArray(d)) return null

  const seats: NonNullable<HandRecord['seats']> = []
  for (let s = 0; s < t.length; s++) {
    const [seed, backgroundColor] = Array.isArray(a[s]) ? a[s] : []
    if (typeof seed !== 'string' || typeof backgroundColor !== 'string') return null
    seats.push({ id: idFor(t[s]), name: wire.p[t[s]], avatar: { seed, backgroundColor } })
  }

  const hole: NonNullable<HandRecord['hole']> = []
  for (let i = 0; i < count; i++) {
    if (o[i] === '') continue
    const cards = parseCards(o[i])
    if (!cards || cards.length !== 2) return null
    hole.push({ playerId: idFor(i), cards })
  }

  for (let i = 0; i < x.length; i++) {
    if (x[i] === 0) continue
    const ev = record.events[i]
    const snap = snapshot(x[i])
    if (!snap || ev.kind !== 'action') return null
    record.events[i] = { ...ev, ...snap }
  }

  if (wire.st !== undefined) {
    const start = snapshot(wire.st)
    if (!start) return null
    record.start = start
  }
  if (wire.k !== undefined) {
    if (!isIndex(wire.k)) return null
    record.buttonId = idFor(wire.k)
  }
  record.seats = seats
  record.hole = hole

  const decisions: GradedDecision[] = []
  for (const raw of d) {
    if (!Array.isArray(raw) || raw.length !== 10 || !raw.every(isNum)) return null
    const [eventIndex, street, folded, required, equity, toCall, pot, margin, bb, grade] = raw
    if (!STREETS[street] || !GRADES[grade] || !record.events[eventIndex]) return null
    decisions.push({
      eventIndex,
      street: STREETS[street],
      folded: folded === 1,
      required,
      equity,
      toCall,
      pot,
      margin,
      bb,
      grade: GRADES[grade],
      verdict: verdictOf(GRADES[grade]),
    })
  }

  return {
    record,
    decisions,
    venueName: typeof wire.vn === 'string' && wire.vn ? wire.vn : null,
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
