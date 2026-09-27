// Cash / ring table simulation harness. `scripts/sim.ts` plays every venue as a
// freezeout, last player standing, which is the wrong question for a ring table:
// nobody is ever eliminated from one, and `prize` is 0, so its win-rate and EV
// columns said nothing about the eight rooms on the Rail (technology#81).
//
//   pnpm cash-sim                     # every ring table, competent hero
//   pnpm cash-sim ring-micro          # specific venue ids
//   pnpm cash-sim ring --hands 10000  # hands per room (default 2000)
//   pnpm cash-sim --hero casual       # beginner | casual | competent | best
//   pnpm cash-sim --seed 7            # deterministic; same seed = same result
//   pnpm cash-sim --workers 2         # default is one core short of the box
//
// ## What it measures
//
// Chips per 100 big blinds at a fixed stack depth. Every seat is reset to the
// table stack at the start of every hand, which is what reloading opponents are
// and removes stack drift as a confound, and the button advances one seat a
// hand so the hero plays every position an equal number of times.
//
// **Cash has a true zero.** In the freezeout harness the reference is 1/seats,
// a rate that has to be argued about. Here, chips are conserved and the hero
// rotates through every position, so a hero playing the table's own profile
// earns 0 bb/100 in expectation and anything else is an edge in one direction or
// the other. That is an argument from the two exact properties, not a measured
// result: `tests/cashSim.test.ts` holds conservation and the orbit, and the
// expectation follows. It is deliberately not asserted by simulation, because at
// the spread below no sample a test run can afford would distinguish zero from a
// large edge.
//
// ## What it does not measure
//
// - **Nothing about busting, rebuying or standing up.** The hero is reset to a
//   full stack every hand, so it never runs out of money and never plays short.
//   Real Rail sessions do both.
// - **Nothing about who beats what.** `skill` is an information advantage
//   (technology#82), so a hero above the table reads hands it cannot. A number
//   here is a statement about two profiles, never about a person.
//
// ## Reading the output
//
// **Never quote bb/100 without the band beside it.** Poker per-hand results are
// heavy-tailed: most hands are worth nothing and a few are worth a hundred
// blinds, so the sample size needed is far larger than it looks. The harness
// measures the standard deviation rather than assuming one, prints the 95%
// interval next to every rate, and prints the hand count that a stated
// precision would have needed. A rate whose band straddles 0 has not
// established a direction, and saying so is the entire point of this file.
//
// **The spread is bigger than technology#81 assumed and the estimate of it is
// itself unstable.** Micro Ring against the competent hero measured a per-hand
// standard deviation of 9.6bb over 100 hands and 17.5bb over 300 (2026-09-18),
// which is the signature of the tail rather than a contradiction. Even the lower
// figure puts +/- 10 bb/100 at roughly 35,000 hands a room, against the 10,000
// the issue budgeted: it dropped the 1.96 and the per-hand-to-per-100
// conversion. Treat any budget printed below as a lower bound until a long run
// has pinned the spread down.
//
// **Common random numbers were tried and do not work here.** Playing each hand
// twice off one seed, once with the hero and once with the hero replaced by the
// table's own profile, and differencing, should cancel the dealt cards, which
// are identical because the deck is drawn before anyone acts. Measured, it made
// the variance *worse*: a ratio of 0.73x at n=300 (2026-09-18), because the
// opponents' decision draws diverge the moment the hero acts differently and
// that noise costs more than the matched cards save. It also costs two hands per
// sample. Do not re-derive this; it is a dead end.

import { spawn } from 'node:child_process'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { decideAction, type AiProfile } from '@/lib/poker/ai/policy'
import { mulberry32 } from '@/lib/poker/cards'
import { applyAction, isHandComplete, startHand } from '@/lib/poker/engine'
import {
  KITCHEN_TABLE,
  RING_TABLES,
  SIDE_TABLES,
  VENUES,
  venueById,
  type Venue,
} from '@/config/venues'

export const HERO_ID = 'hero'

/**
 * Proxy players, identical to `scripts/sim.ts`. "beginner" is a label and not a
 * calibration: the floor here is skill 0.50 and ten shipped tables sit below it,
 * so on the soft end every hero out-reads the table it is playing.
 */
export const HEROES: Record<string, AiProfile> = {
  beginner: { tightness: 0.2, aggression: 0.3, bluff: 0.04, iterations: 200, skill: 0.5 },
  casual: { tightness: 0.3, aggression: 0.4, bluff: 0.06, iterations: 300, skill: 0.7 },
  competent: { tightness: 0.35, aggression: 0.5, bluff: 0.08, iterations: 400, skill: 0.85 },
  best: { tightness: 0.4, aggression: 0.55, bluff: 0.1, iterations: 600, skill: 1 },
}

/** Every seat's chip delta for one hand. Keyed by seat id; sums to exactly 0. */
export type HandDeltas = Record<string, number>

/**
 * The button advances one seat a hand, so over any `seats` consecutive hands the
 * hero occupies every position exactly once. Position is worth real money, so a
 * run that is not a whole number of orbits is a position bias dressed as a rate.
 */
export function buttonForHand(handIndex: number, seats: number): number {
  return ((handIndex % seats) + seats) % seats
}

/** Round a requested hand count up to a whole orbit, never below one. */
export function orbitHands(requested: number, seats: number): number {
  if (!Number.isFinite(requested) || requested < seats) return seats
  return Math.ceil(requested / seats) * seats
}

/**
 * One hand at `venue`, every seat starting on the table stack. Returns each
 * seat's chip delta. Nothing carries over: the hand is a closed system, which is
 * what makes a session shardable by hand index.
 */
export function playCashHand(
  venue: Venue,
  hero: AiProfile,
  rng: () => number,
  buttonIndex: number,
): HandDeltas {
  const stack = venue.startingStack ?? venue.buyIn
  const seats = Array.from({ length: venue.seats }, (_, i) => ({
    id: i === 0 ? HERO_ID : `ai${i}`,
    name: i === 0 ? 'Hero' : `AI ${i}`,
    stack,
  }))

  let state = startHand({
    seats,
    buttonIndex: buttonForHand(buttonIndex, venue.seats),
    smallBlind: venue.smallBlind,
    bigBlind: venue.bigBlind,
    rng,
  })

  let guard = 0
  while (!isHandComplete(state)) {
    if (++guard > 400) throw new Error(`hand never completed at ${venue.id}`)
    const actor = state.players[state.toActIndex]
    const profile = actor?.id === HERO_ID ? hero : venue.ai
    state = applyAction(state, decideAction(state, profile, rng))
  }

  const deltas: HandDeltas = {}
  for (const p of state.players) deltas[p.id] = p.stack - stack
  return deltas
}

/** Totals for a run of hands. Shards sum field by field. */
export interface CashResult {
  hands: number
  /** Sum of the hero's per-hand chip deltas. */
  chips: number
  /** Sum of their squares, so a shard carries everything the standard error needs. */
  chipsSq: number
}

export const EMPTY: CashResult = { hands: 0, chips: 0, chipsSq: 0 }

export function addResults(a: CashResult, b: CashResult): CashResult {
  return {
    hands: a.hands + b.hands,
    chips: a.chips + b.chips,
    chipsSq: a.chipsSq + b.chipsSq,
  }
}

/**
 * Play hands `[handStart, handEnd)` at `venue`. Each hand's RNG and button are
 * keyed on its index alone, so slicing the range across workers is deterministic
 * and the union of slices is identical to running the range serially.
 */
export function runCashSession(
  venue: Venue,
  hero: AiProfile,
  seed: number,
  handStart: number,
  handEnd: number,
): CashResult {
  let result = EMPTY
  for (let h = handStart; h < handEnd; h++) {
    const rng = mulberry32((hash(venue.id) + seed * 1_000_003 + h) >>> 0)
    const delta = playCashHand(venue, hero, rng, h)[HERO_ID] ?? 0
    result = {
      hands: result.hands + 1,
      chips: result.chips + delta,
      chipsSq: result.chipsSq + delta * delta,
    }
  }
  return result
}

/** What a `CashResult` is allowed to say out loud. */
export interface CashStats {
  hands: number
  /** Chips per 100 hands, expressed in big blinds. */
  bb100: number
  /** Half-width of the 95% interval on `bb100`, in the same units. */
  ci95: number
  /** Per-hand standard deviation in big blinds; the number that sets the budget. */
  sdBb: number
  /** True when the interval contains 0, i.e. no direction has been established. */
  straddlesZero: boolean
}

export function cashStats(result: CashResult, bigBlind: number): CashStats {
  const { hands, chips, chipsSq } = result
  if (hands === 0)
    return { hands: 0, bb100: 0, ci95: Number.POSITIVE_INFINITY, sdBb: 0, straddlesZero: true }
  const meanChips = chips / hands
  // Population variance of the per-hand delta. With one hand there is no spread
  // to measure, so the interval is honestly infinite rather than zero.
  const varChips = Math.max(0, chipsSq / hands - meanChips * meanChips)
  const sdBb = Math.sqrt(varChips) / bigBlind
  const bb100 = (meanChips / bigBlind) * 100
  const ci95 = hands < 2 ? Number.POSITIVE_INFINITY : 1.96 * (sdBb / Math.sqrt(hands)) * 100
  return { hands, bb100, ci95, sdBb, straddlesZero: Math.abs(bb100) <= ci95 }
}

/** Hands needed to resolve a rate to +/- `targetBb100`, given a measured spread. */
export function handsForPrecision(sdBb: number, targetBb100: number): number {
  if (targetBb100 <= 0) return Number.POSITIVE_INFINITY
  return Math.ceil(((1.96 * sdBb * 100) / targetBb100) ** 2)
}

/** Small deterministic hash so each venue gets its own RNG stream per seed. */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// --- worker: run one venue's slice and report back --------------------------

interface WorkerInput {
  venueId: string
  heroName: string
  seed: number
  handStart: number
  handEnd: number
}

// True only when this file is the process entry point. Everything above is
// imported by `tests/cashSim.test.ts`, and without this guard an import runs the
// whole CLI: the first draft quietly started a full eight-room measurement
// inside the test worker.
const IS_ENTRY =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

// A child process replays this file with CASH_SLICE set, runs its slice of hands
// and writes the totals back as JSON. (worker_threads can't be used: the thread
// wouldn't inherit tsx's TS loader.)
if (IS_ENTRY && process.env.CASH_SLICE) {
  const { venueId, heroName, seed, handStart, handEnd } = JSON.parse(
    process.env.CASH_SLICE,
  ) as WorkerInput
  const venue = venueById(venueId)
  const heroProfile = HEROES[heroName]
  if (!venue || !heroProfile) throw new Error(`worker: bad venue/hero ${venueId}/${heroName}`)
  process.stdout.write(JSON.stringify(runCashSession(venue, heroProfile, seed, handStart, handEnd)))
  process.exit(0)
}

function runVenueParallel(
  venue: Venue,
  seed: number,
  heroName: string,
  hands: number,
  workers: number,
): Promise<CashResult> {
  // Chunk on a multiple of `seats` so every shard is position-balanced too, and
  // a partial run is never quietly biased towards the button.
  const raw = Math.ceil(hands / workers)
  const chunk = Math.max(venue.seats, Math.ceil(raw / venue.seats) * venue.seats)
  const ranges: Array<[number, number]> = []
  for (let start = 0; start < hands; start += chunk) {
    ranges.push([start, Math.min(start + chunk, hands)])
  }
  const scriptPath = fileURLToPath(import.meta.url)

  return Promise.all(
    ranges.map(
      ([handStart, handEnd]) =>
        new Promise<CashResult>((resolve, reject) => {
          const input: WorkerInput = { venueId: venue.id, heroName, seed, handStart, handEnd }
          const child = spawn(process.execPath, ['--import', 'tsx', scriptPath], {
            env: { ...process.env, CASH_SLICE: JSON.stringify(input) },
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
              resolve(JSON.parse(out) as CashResult)
            } catch (err) {
              reject(err)
            }
          })
        }),
    ),
  ).then((parts) => parts.reduce(addResults, EMPTY))
}

// --- CLI ---------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const flags = new Map<string, string>()
  const names: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      flags.set(a.slice(2), argv[i + 1] ?? '')
      i++
    } else {
      names.push(a)
    }
  }
  return { flags, names }
}

function resolveVenues(names: string[]): Venue[] {
  if (names.length === 0) return [...RING_TABLES]
  const all = [KITCHEN_TABLE, ...VENUES, ...SIDE_TABLES, ...RING_TABLES]
  const picked: Venue[] = []
  for (const name of names) {
    if (name === 'ring') picked.push(...RING_TABLES)
    else if (name === 'all') picked.push(...all)
    else {
      const venue = all.find((v) => v.id === name)
      if (!venue) {
        console.error(
          `Unknown venue "${name}". Ids: ${all.map((v) => v.id).join(', ')} (or: ring, all)`,
        )
        process.exit(1)
      }
      picked.push(venue)
    }
  }
  return [...new Set(picked)]
}

if (IS_ENTRY && !process.env.CASH_SLICE) {
  const { flags, names } = parseArgs(process.argv.slice(2))
  const requested = Number(flags.get('hands') ?? 2000)
  const seed = Number(flags.get('seed') ?? 1)
  const heroName = flags.get('hero') ?? 'competent'
  const hero = HEROES[heroName]
  if (!hero) {
    console.error(`Unknown hero "${heroName}". Heroes: ${Object.keys(HEROES).join(', ')}`)
    process.exit(1)
  }
  const venues = resolveVenues(names)
  // One core short of the box by default, so an interactive session stays usable.
  // A long unattended measurement should be given every core with --workers.
  const workers = Math.max(1, Number(flags.get('workers') ?? os.cpus().length - 1))

  console.log(
    `Cash sessions · hero: ${heroName} (skill ${hero.skill}) · seed ${seed} · ${workers} worker(s)\n`,
  )

  const pad = (s: string, w: number) => s.padEnd(w)
  const num = (s: string, w: number) => s.padStart(w)
  console.log(
    `  ${pad('venue', 14)}` +
      num('seats', 6) +
      num('ai skill', 9) +
      num('hands', 8) +
      num('chips', 12) +
      num('bb/100', 10) +
      num('95% band', 18) +
      num('sd bb/hand', 12),
  )

  let sawStraddle = false
  let worstBudget = 0
  for (const venue of venues) {
    const hands = orbitHands(requested, venue.seats)
    const started = Date.now()
    const result = await runVenueParallel(venue, seed, heroName, hands, workers)
    const s = cashStats(result, venue.bigBlind)
    const secs = ((Date.now() - started) / 1000).toFixed(0)
    const lo = s.bb100 - s.ci95
    const hi = s.bb100 + s.ci95
    console.log(
      (s.straddlesZero ? '~ ' : '  ') +
        pad(venue.name, 14) +
        num(String(venue.seats), 6) +
        num((venue.ai.skill ?? 1).toFixed(2), 9) +
        num(String(s.hands), 8) +
        num(result.chips.toLocaleString(), 12) +
        num((s.bb100 >= 0 ? '+' : '') + s.bb100.toFixed(1), 10) +
        num(`${lo.toFixed(1)} to ${hi.toFixed(1)}`, 18) +
        num(s.sdBb.toFixed(1), 12) +
        `   (${secs}s)`,
    )
    sawStraddle ||= s.straddlesZero
    worstBudget = Math.max(worstBudget, handsForPrecision(s.sdBb, 10))
  }

  if (sawStraddle) {
    console.log(
      [
        '',
        '~: the 95% band contains 0, so this run has not established that the hero wins or',
        'loses at that table. Quote the band, never the point estimate on its own.',
      ].join('\n'),
    )
  }

  console.log(
    [
      '',
      `Budget: resolving a rate to +/- 10 bb/100 at the widest spread measured above needs`,
      `about ${worstBudget.toLocaleString()} hands per room. Standard deviation is measured here,`,
      'not assumed, so re-read it after any AI change rather than reusing this figure.',
      '',
      'This harness resets every seat to the table stack each hand, so it says nothing about',
      'busting, rebuying or standing up, and `skill` is an information advantage, so no row',
      'is evidence about a person (technology#82).',
    ].join('\n'),
  )
}
