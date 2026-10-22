// New AI against old: two policies at one table, on the same cards, with the
// seats swapped and the deal played again, so the luck of the deal cancels and
// what is left is the difference between them.
//
//   pnpm bot-duel --a v1 --b v1                    # the null test: exactly 0, every deal
//   pnpm bot-duel --a fast --b v1 --venue mainevent
//   pnpm bot-duel --a v1:iterations=1800 --b v1 --iters 9999
//   pnpm bot-duel --a v1@garage --b v1@mainevent   # one rung's profile against another's
//   pnpm bot-duel --mode sng --deals 400           # sit-and-gos at the venue's blinds
//   pnpm bot-duel --layout solo                    # one A among B, A takes every seat in turn
//   pnpm bot-duel --seats 8 --bb 100               # table size and cash stack depth
//   pnpm bot-duel --json                           # machine-readable, for a report
//
// ## What a "deal" is
//
// One seed for the deck, one seed per seat for decisions, and two or more
// passes over them with different policies in the chairs:
//
// - `alternate` (default): A, B, A, B round the table, then B, A, B, A. Every
//   chair is played once by each side, against a mixed table.
// - `solo`: one A at a table of B, played once per chair so A sits in every one.
//   This is "how does a new bot do at a table of old ones", which is the
//   question a release actually asks.
//
// The deck is drawn whole before anyone acts (`startHand`), so every pass is
// dealt the same cards. Each *chair* draws its decisions from its own stream,
// whoever sits in it, so a side that plays exactly like the other produces
// exactly the same hand and the deal scores exactly 0. `tests/botDuel.test.ts`
// holds that, because it is the property the whole measurement rests on.
//
// `pnpm cash-sim` tried common random numbers and found they made things worse
// (2026-09-18). That experiment paired a hero with the table's own profile while
// every opponent drew from one shared stream, so the opponents' play diverged
// the moment the hero did something different. Here the opponents' streams
// belong to their chairs, so they only diverge where the hand itself does.
//
// ## What it reports
//
// - **cash**: A's chips per chair per 100 hands, in big blinds, with the 95%
//   interval from the spread *between deals*. B's is the same number with the
//   sign flipped, because chips are conserved.
// - **sng**: A's return per entry in a winner-take-all sit-and-go, in buy-ins.
//   0 is break-even whatever the layout: across the passes of a deal A has as
//   many entries as there are chairs, and the passes produce that many winners'
//   worth of prize between the sides.
//
// Cash hands are reset to the stack every hand and every pass starts with an
// empty table memory, so a deal is a closed system and a run splits across
// workers by deal index with the same result serially. A sit-and-go carries
// its memory through the tournament, as the game does.

import { spawn } from 'node:child_process'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { blindsAt } from '@/config/blinds'
import { type Venue, venueById } from '@/config/venues'
import type { AiProfile } from '@/lib/poker/ai/policy'
import {
  createTableMemory,
  observeAction,
  observeHandEnd,
  type TableMemory,
} from '@/lib/poker/ai/memory'
import { mulberry32, type Rng } from '@/lib/poker/cards'
import { applyAction, type HandState, isHandComplete, startHand } from '@/lib/poker/engine'
import { type Decider, POLICIES } from './ai-versions'
import {
  addSeatStats,
  createHandTracker,
  emptySeatStats,
  rate,
  STAT_KEYS,
  STAT_LABEL,
  type SeatStats,
} from './table-stats'

export interface Side {
  label: string
  profile: AiProfile
  decide: Decider
}

const NUMERIC_KEYS = ['tightness', 'aggression', 'bluff', 'iterations', 'skill'] as const

/**
 * `name[@venue][:key=value,...]`, e.g. `v1`, `v1@garage`, `v1:iterations=600`.
 * The venue names whose profile to start from (default: the duel's venue).
 */
export function parseSide(spec: string, venue: Venue): Side {
  const [head, overrides = ''] = spec.split(':')
  const [name, venueId] = head.split('@')
  const policy = POLICIES[name]
  if (!policy)
    throw new Error(`unknown policy "${name}"; known: ${Object.keys(POLICIES).join(', ')}`)
  const base = venueId ? venueById(venueId)?.ai : venue.ai
  if (!base) throw new Error(`unknown venue "${venueId}"`)
  let profile: AiProfile = policy.profile ? policy.profile({ ...base }) : { ...base }
  for (const pair of overrides.split(',').filter(Boolean)) {
    const [k, v] = pair.split('=')
    if (k === 'habit') {
      profile = { ...profile, habit: v as AiProfile['habit'] }
      continue
    }
    if (!(NUMERIC_KEYS as readonly string[]).includes(k) || !Number.isFinite(Number(v)))
      throw new Error(`bad override "${pair}" in "${spec}"`)
    profile = { ...profile, [k]: Number(v) }
  }
  return { label: spec, profile, decide: policy.decide }
}

export type Layout = 'alternate' | 'solo'
export type Mode = 'cash' | 'sng'

export interface DuelConfig {
  venue: Venue
  a: Side
  b: Side
  seats: number
  layout: Layout
  mode: Mode
  seed: number
  /** Cash stack depth in big blinds. */
  stackBb: number
  /** Cap on Monte-Carlo sims per decision, for both sides. */
  itersCap: number
}

/** Who sits where on each pass of a deal. */
export function seatPlan(layout: Layout, seats: number): ('a' | 'b')[][] {
  if (layout === 'solo') {
    return Array.from({ length: seats }, (_, pass) =>
      Array.from({ length: seats }, (_, chair) => (chair === pass ? 'a' : 'b')),
    )
  }
  const first = Array.from({ length: seats }, (_, chair) => (chair % 2 === 0 ? 'a' : 'b'))
  return [first, first.map((s) => (s === 'a' ? 'b' : 'a'))]
}

/** A 32-bit mix of the run seed, the deal and a stream tag. */
export function streamSeed(seed: number, deal: number, stream: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (deal + 1), 0xc2b2ae35) >>> 0
  h = Math.imul(h ^ (stream + 0x27d4eb2f), 0x165667b1) >>> 0
  return (h ^ (h >>> 15)) >>> 0
}

const DECK_STREAM = 0
/** Chair streams sit above the deck's; a sit-and-go hand offsets the deck by its index. */
const CHAIR_STREAM = 1_000_000

export interface DealResult {
  /** The deal's score for A: bb per chair-hand (cash) or buy-ins per entry (sng). */
  x: number
  /** Hands played across every pass. */
  hands: number
  /** Sit-and-gos that hit the hand cap and were given to the chip leader. */
  timeouts: number
  stats: { a: SeatStats; b: SeatStats }
}

function capped(side: Side, cap: number): AiProfile {
  return { ...side.profile, iterations: Math.min(side.profile.iterations, cap) }
}

const chairId = (chair: number) => `c${chair}`

/** Play one hand to the end with `plan` deciding who sits where. */
function playHand(
  cfg: DuelConfig,
  plan: ('a' | 'b')[],
  seats: { id: string; stack: number }[],
  buttonIndex: number,
  blinds: { smallBlind: number; bigBlind: number },
  deckRng: Rng,
  chairRngs: Rng[],
  memory: TableMemory,
  stats: { a: SeatStats; b: SeatStats },
): HandState {
  const sides = { a: cfg.a, b: cfg.b }
  const profiles = { a: capped(cfg.a, cfg.itersCap), b: capped(cfg.b, cfg.itersCap) }
  const chairOf = new Map(seats.map((s) => [s.id, Number(s.id.slice(1))]))
  const startStacks = Object.fromEntries(seats.map((s) => [s.id, s.stack]))
  let state = startHand({
    seats: seats.map((s) => ({ id: s.id, name: s.id, stack: s.stack })),
    buttonIndex,
    ...blinds,
    rng: deckRng,
  })
  const tracker = createHandTracker((id) => stats[plan[chairOf.get(id) ?? 0]])
  let guard = 0
  while (!isHandComplete(state)) {
    if (++guard > 400) throw new Error('hand never completed')
    const actor = state.players[state.toActIndex]
    const chair = chairOf.get(actor.id) ?? 0
    const who = plan[chair]
    const action = sides[who].decide(state, profiles[who], chairRngs[chair], memory)
    tracker.observe(state, action)
    observeAction(memory, state, action)
    state = applyAction(state, action)
  }
  observeHandEnd(memory, state)
  tracker.finish(state, startStacks)
  return state
}

function emptyStats() {
  return { a: emptySeatStats(), b: emptySeatStats() }
}

/** One cash deal: every pass is one hand, every chair on `stackBb`. */
export function playCashDeal(cfg: DuelConfig, deal: number): DealResult {
  const bb = 2
  const stack = cfg.stackBb * bb
  const stats = emptyStats()
  const plans = seatPlan(cfg.layout, cfg.seats)
  let aChips = 0
  for (const plan of plans) {
    const seats = Array.from({ length: cfg.seats }, (_, chair) => ({ id: chairId(chair), stack }))
    const chairRngs = seats.map((_, chair) =>
      mulberry32(streamSeed(cfg.seed, deal, CHAIR_STREAM + chair)),
    )
    const end = playHand(
      cfg,
      plan,
      seats,
      deal % cfg.seats,
      { smallBlind: bb / 2, bigBlind: bb },
      mulberry32(streamSeed(cfg.seed, deal, DECK_STREAM)),
      chairRngs,
      createTableMemory(),
      stats,
    )
    for (const p of end.players) {
      if (plan[Number(p.id.slice(1))] === 'a') aChips += p.stack - stack
    }
  }
  // Across the passes A fills `seats` chair-hands, whichever the layout.
  const aChairHands = plans.reduce((n, plan) => n + plan.filter((s) => s === 'a').length, 0)
  return { x: aChips / bb / aChairHands, hands: plans.length, timeouts: 0, stats }
}

const SNG_HAND_CAP = 2000

/** One sit-and-go deal: each pass is a whole tournament on the same seeds. */
export function playSngDeal(cfg: DuelConfig, deal: number): DealResult {
  const venue = cfg.venue
  const startingStack = venue.startingStack ?? venue.buyIn
  const stats = emptyStats()
  const plans = seatPlan(cfg.layout, cfg.seats)
  let aWins = 0
  let hands = 0
  let timeouts = 0
  for (const plan of plans) {
    const seats = Array.from({ length: cfg.seats }, (_, chair) => ({
      id: chairId(chair),
      stack: startingStack,
    }))
    const chairRngs = seats.map((_, chair) =>
      mulberry32(streamSeed(cfg.seed, deal, CHAIR_STREAM + chair)),
    )
    const memory = createTableMemory()
    let button = deal % cfg.seats
    let winner: string | null = null
    for (let h = 0; h < SNG_HAND_CAP; h++) {
      const live = seats.filter((s) => s.stack > 0)
      if (live.length === 1) {
        winner = live[0].id
        break
      }
      while (seats[button % cfg.seats].stack <= 0) button++
      const buttonId = seats[button % cfg.seats].id
      const blinds =
        venue.escalation === false
          ? { smallBlind: venue.smallBlind, bigBlind: venue.bigBlind }
          : blindsAt(venue, h)
      const end = playHand(
        cfg,
        plan,
        live,
        live.findIndex((s) => s.id === buttonId),
        blinds,
        mulberry32(streamSeed(cfg.seed, deal, DECK_STREAM + h)),
        chairRngs,
        memory,
        stats,
      )
      for (const p of end.players) {
        const seat = seats.find((s) => s.id === p.id)
        if (seat) seat.stack = p.stack
      }
      button++
      hands++
    }
    if (!winner) {
      timeouts++
      winner = seats.reduce((a, b) => (b.stack > a.stack ? b : a)).id
    }
    if (plan[Number(winner.slice(1))] === 'a') aWins++
  }
  // Each pass pays one prize of `seats` buy-ins. A's return per entry is what it
  // won over what it paid in, less the stake: 0 when A wins its share.
  const aEntries = plans.reduce((n, plan) => n + plan.filter((s) => s === 'a').length, 0)
  const x = (aWins * cfg.seats) / aEntries - 1
  return { x, hands, timeouts, stats }
}

export interface DuelTotals {
  deals: number
  sum: number
  sumSq: number
  hands: number
  timeouts: number
  stats: { a: SeatStats; b: SeatStats }
}

export function emptyTotals(): DuelTotals {
  return { deals: 0, sum: 0, sumSq: 0, hands: 0, timeouts: 0, stats: emptyStats() }
}

export function addTotals(x: DuelTotals, y: DuelTotals): DuelTotals {
  return {
    deals: x.deals + y.deals,
    sum: x.sum + y.sum,
    sumSq: x.sumSq + y.sumSq,
    hands: x.hands + y.hands,
    timeouts: x.timeouts + y.timeouts,
    stats: {
      a: addSeatStats(x.stats.a, y.stats.a),
      b: addSeatStats(x.stats.b, y.stats.b),
    },
  }
}

/** Deals `[start, end)`. Each deal depends on its index alone. */
export function runDuel(cfg: DuelConfig, start: number, end: number): DuelTotals {
  let totals = emptyTotals()
  for (let d = start; d < end; d++) {
    const r = cfg.mode === 'sng' ? playSngDeal(cfg, d) : playCashDeal(cfg, d)
    totals = addTotals(totals, {
      deals: 1,
      sum: r.x,
      sumSq: r.x * r.x,
      hands: r.hands,
      timeouts: r.timeouts,
      stats: r.stats,
    })
  }
  return totals
}

/**
 * How many deals are added up before being added to the run. Fixed, not
 * derived from the worker count: floating-point sums depend on their grouping,
 * so a run is only the same run to the last bit if it is always grouped the
 * same way, however many workers share it.
 */
export const CHUNK = 25

/** Totals for each chunk in `[chunkStart, chunkEnd)`, in order. */
export function runChunks(
  cfg: DuelConfig,
  deals: number,
  chunkStart: number,
  chunkEnd: number,
): DuelTotals[] {
  const out: DuelTotals[] = []
  for (let c = chunkStart; c < chunkEnd; c++) {
    out.push(runDuel(cfg, c * CHUNK, Math.min((c + 1) * CHUNK, deals)))
  }
  return out
}

/** A run's totals from its chunk totals, folded in chunk order. */
export function foldChunks(parts: readonly DuelTotals[]): DuelTotals {
  return parts.reduce(addTotals, emptyTotals())
}

export interface DuelSummary {
  deals: number
  /** A's mean: bb/100 per chair (cash) or ROI per entry as a fraction (sng). */
  mean: number
  /** Half-width of the 95% interval on `mean`. */
  ci95: number
  /** Spread of one deal's score. */
  sd: number
  straddlesZero: boolean
}

/** Mean, 95% interval and spread over deals; cash is scaled to bb/100. */
export function summarize(t: DuelTotals, mode: Mode): DuelSummary {
  const scale = mode === 'cash' ? 100 : 1
  if (t.deals === 0) {
    return { deals: 0, mean: 0, ci95: Number.POSITIVE_INFINITY, sd: 0, straddlesZero: true }
  }
  const m = t.sum / t.deals
  // Sample variance across deals; one deal has no spread to measure.
  const variance = t.deals > 1 ? Math.max(0, (t.sumSq - t.deals * m * m) / (t.deals - 1)) : 0
  const sd = Math.sqrt(variance)
  const ci95 = t.deals > 1 ? (1.96 * sd * scale) / Math.sqrt(t.deals) : Number.POSITIVE_INFINITY
  const mean = m * scale
  return { deals: t.deals, mean, ci95, sd: sd * scale, straddlesZero: Math.abs(mean) <= ci95 }
}

// --- workers -----------------------------------------------------------------

interface RunInput {
  venueId: string
  a: string
  b: string
  seats: number
  layout: Layout
  mode: Mode
  seed: number
  stackBb: number
  itersCap: number
}

interface SliceInput extends RunInput {
  deals: number
  chunkStart: number
  chunkEnd: number
}

export function configFrom(input: RunInput): DuelConfig {
  const venue = venueById(input.venueId)
  if (!venue) throw new Error(`unknown venue "${input.venueId}"`)
  // The hands are dealt as Hold'em, so another game's venue would be duelled at the wrong game.
  if ((venue.variant ?? 'holdem') !== 'holdem') {
    throw new Error(`${venue.name} is not Hold'em; bot-duel plays Hold'em venues only`)
  }
  return {
    venue,
    a: parseSide(input.a, venue),
    b: parseSide(input.b, venue),
    seats: input.seats,
    layout: input.layout,
    mode: input.mode,
    seed: input.seed,
    stackBb: input.stackBb,
    itersCap: input.itersCap,
  }
}

const IS_ENTRY =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (IS_ENTRY && process.env.DUEL_SLICE) {
  const input = JSON.parse(process.env.DUEL_SLICE) as SliceInput
  // A pipe takes 64 KB at a time and exit() drops the rest, so exit once it
  // has all been written.
  process.stdout.write(
    JSON.stringify(runChunks(configFrom(input), input.deals, input.chunkStart, input.chunkEnd)),
    () => process.exit(0),
  )
}

function runParallel(input: RunInput, deals: number, workers: number): Promise<DuelTotals> {
  const chunks = Math.ceil(deals / CHUNK)
  const per = Math.max(1, Math.ceil(chunks / workers))
  const jobs: Promise<DuelTotals[]>[] = []
  for (let chunkStart = 0; chunkStart < chunks; chunkStart += per) {
    const slice: SliceInput = {
      ...input,
      deals,
      chunkStart,
      chunkEnd: Math.min(chunkStart + per, chunks),
    }
    jobs.push(
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url)], {
          env: { ...process.env, DUEL_SLICE: JSON.stringify(slice) },
          stdio: ['ignore', 'pipe', 'inherit'],
        })
        let out = ''
        child.stdout.on('data', (d) => {
          out += d
        })
        child.on('error', reject)
        child.on('close', (code) => {
          if (code !== 0) return reject(new Error(`worker exited ${code}`))
          try {
            resolve(JSON.parse(out) as DuelTotals[])
          } catch (err) {
            reject(err)
          }
        })
      }),
    )
  }
  // Jobs hold consecutive chunks, so their results in job order are every
  // chunk in order.
  return Promise.all(jobs).then((parts) => foldChunks(parts.flat()))
}

// --- CLI ---------------------------------------------------------------------

const pct = (x: number | null) => (x === null ? '-' : `${(x * 100).toFixed(1)}%`)

function statRows(a: SeatStats, b: SeatStats): string[] {
  const rows = STAT_KEYS.map(
    (k) =>
      `  ${STAT_LABEL[k].padEnd(34)}${pct(rate(a.stat[k])).padStart(10)}${pct(rate(b.stat[k])).padStart(10)}`,
  )
  const mean = (m: SeatStats['betSize']) => (m.n ? (m.sum / m.n).toFixed(2) : '-')
  rows.push(
    `  ${'postflop bet size (x pot)'.padEnd(34)}${mean(a.betSize).padStart(10)}${mean(b.betSize).padStart(10)}`,
  )
  rows.push(
    `  ${'open size (bb)'.padEnd(34)}${mean(a.openSize).padStart(10)}${mean(b.openSize).padStart(10)}`,
  )
  const width = Math.max(a.openByBehind.length, b.openByBehind.length)
  for (let behind = width - 1; behind >= 1; behind--) {
    const cell = (x: SeatStats) => {
      const t = x.openByBehind[behind]
      return t ? `${pct(rate(t))}` : '-'
    }
    rows.push(
      `  ${`first-in raise, ${behind} behind`.padEnd(34)}${cell(a).padStart(10)}${cell(b).padStart(10)}`,
    )
  }
  return rows
}

if (IS_ENTRY && !process.env.DUEL_SLICE) {
  const args = process.argv.slice(2)
  const flag = (name: string) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : undefined
  }
  const venueId = flag('venue') ?? 'mainevent'
  const venue = venueById(venueId)
  if (!venue) throw new Error(`unknown venue "${venueId}"`)
  const mode = (flag('mode') ?? 'cash') as Mode
  if (mode !== 'cash' && mode !== 'sng') throw new Error(`--mode is cash or sng`)
  const layout = (flag('layout') ?? 'alternate') as Layout
  if (layout !== 'alternate' && layout !== 'solo') throw new Error(`--layout is alternate or solo`)
  const input = {
    venueId,
    a: flag('a') ?? 'v1',
    b: flag('b') ?? 'v1',
    seats: Number(flag('seats') ?? venue.seats),
    layout,
    mode,
    seed: Number(flag('seed') ?? 1),
    stackBb: Number(flag('bb') ?? 100),
    itersCap: Number(flag('iters') ?? 300),
  }
  if (!(input.seats >= 2 && input.seats <= 8)) throw new Error('--seats is 2 to 8')
  const cfg = configFrom(input) // validates both sides before any worker starts
  const deals = Number(flag('deals') ?? (mode === 'sng' ? 200 : 2000))
  const workers = Math.max(1, Number(flag('workers') ?? Math.min(os.cpus().length - 2, 14)))
  const t0 = Date.now()
  const totals = await runParallel(input, deals, workers)
  const s = summarize(totals, mode)
  const secs = (Date.now() - t0) / 1000

  if (args.includes('--json')) {
    console.log(JSON.stringify({ input, deals, secs, summary: s, totals }))
    process.exit(0)
  }

  const passes = seatPlan(layout, input.seats).length
  const what =
    mode === 'cash'
      ? `cash ${input.stackBb}bb, reset every hand`
      : `sit-and-go, ${venue.startingStack ?? venue.buyIn} chips, ${venue.escalation === false ? 'flat' : 'rising'} blinds`
  console.log(
    `bot-duel · ${venue.name} · ${what} · ${input.seats} seats · ${layout} (${passes} passes a deal) · sims capped at ${input.itersCap} · seed ${input.seed}`,
  )
  console.log(`  A = ${cfg.a.label}   B = ${cfg.b.label}\n`)
  const lo = s.mean - s.ci95
  const hi = s.mean + s.ci95
  if (mode === 'cash') {
    console.log(
      `  A ${s.mean >= 0 ? '+' : ''}${s.mean.toFixed(2)} bb/100 a chair   95% ${lo.toFixed(2)} to ${hi.toFixed(2)}   (B is the mirror)`,
    )
    console.log(
      `  ${s.deals} deals, ${totals.hands} hands, sd ${(s.sd / 100).toFixed(2)} bb a deal`,
    )
  } else {
    console.log(
      `  A ROI ${(s.mean * 100).toFixed(1)}% an entry   95% ${(lo * 100).toFixed(1)}% to ${(hi * 100).toFixed(1)}%   (0 = break-even)`,
    )
    console.log(
      `  ${s.deals} deals, ${totals.hands} hands, ${totals.timeouts} tournaments hit the ${SNG_HAND_CAP}-hand cap`,
    )
  }
  if (s.straddlesZero) console.log('  ~ the interval contains 0: no difference established')
  console.log(`\n  ${''.padEnd(34)}${'A'.padStart(10)}${'B'.padStart(10)}`)
  for (const row of statRows(totals.stats.a, totals.stats.b)) console.log(row)
  console.log(`\n  ${secs.toFixed(0)}s on ${workers} workers`)
}
