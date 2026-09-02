// Difficulty simulation harness — plays full sit-and-go tournaments with a
// proxy human ("hero") against each venue's real AI, using the real engine,
// blinds and escalation. This is how skill numbers in config/venues.ts get
// validated: change a knob, re-run, read the win rates.
//
//   pnpm sim                        # kitchen + the ladder, competent hero
//   pnpm sim garage pub             # specific venue ids
//   pnpm sim side | ladder | all    # groups
//   pnpm sim garage --n 500         # tournaments per venue (default 200)
//   pnpm sim --hero casual          # beginner | casual | competent | best
//   pnpm sim --seed 7               # deterministic; same seed = same result
//   pnpm sim garage --skill 0.4     # try a different AI skill before editing config
//
// Reading the output: "fair" is 1/seats — the win rate of a hero no better
// than the field. A venue is beatable when the target player type clears fair
// comfortably, and hard when they sit near or below it.
//
// "won" is the raw count behind "win %", and it is the column to quote. A
// percentage hides its sample size: 47% off 200 tournaments and 47% off 15 read
// identically, and only one of them means anything. Every rate this harness has
// ever produced is a sample, so anything written down about a venue quotes the
// count. Percentages are here to be read at a glance, not repeated.

import { spawn } from 'node:child_process'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { mulberry32, type Rng } from '@/lib/poker/cards'
import { applyAction, isHandComplete, startHand } from '@/lib/poker/engine'
import { decideAction, type AiProfile } from '@/lib/poker/ai/policy'
import { blindsAt } from '@/config/blinds'
import {
  KITCHEN_TABLE,
  RING_TABLES,
  SIDE_TABLES,
  VENUES,
  venueById,
  type Venue,
} from '@/config/venues'

const HERO_ID = 'hero'

// Proxy players. "competent" is the calibration reference — a solid casual
// player who knows the game but isn't optimal. Venue difficulty targets are
// expressed against this hero.
//
// **"beginner" is a label, not a calibration, and the floor is higher than the
// catalogue's.** `skill` is the one knob that models being bad at poker: it is
// hand-reading accuracy (`misread` in ai/policy.ts) plus a give-up-under-pressure
// rate. The weakest hero here sits at 0.50, and **10 of the 29 tables in
// ALL_VENUES ship an AI below that**, the whole soft end of the ladder included
// (Friends' Garage 0.28, Micro Ring 0.24). So on the soft tables this hero reads
// hands roughly twice as accurately as the bots it is beating, and "the beginner
// won" is partly true by construction. No hero here is calibrated against a human
// beginner, because nobody has measured one. See the note under the table.
const HEROES: Record<string, AiProfile> = {
  beginner: { tightness: 0.2, aggression: 0.3, bluff: 0.04, iterations: 200, skill: 0.5 },
  casual: { tightness: 0.3, aggression: 0.4, bluff: 0.06, iterations: 300, skill: 0.7 },
  competent: { tightness: 0.35, aggression: 0.5, bluff: 0.08, iterations: 400, skill: 0.85 },
  best: { tightness: 0.4, aggression: 0.55, bluff: 0.1, iterations: 600, skill: 1 },
}

interface TourneyOutcome {
  heroWon: boolean
  hands: number
  timedOut: boolean
}

/** Button moves clockwise to the next seat still holding chips (as in game.ts). */
function nextButtonId(seats: { id: string; stack: number }[], current: string): string {
  const from = seats.findIndex((s) => s.id === current)
  for (let i = 1; i <= seats.length; i++) {
    const seat = seats[(from + i) % seats.length]
    if (seat.stack > 0) return seat.id
  }
  return current
}

/** One full sit-and-go at `venue`: play until the hero wins it or busts. */
function runTournament(venue: Venue, hero: AiProfile, rng: Rng): TourneyOutcome {
  const startingStack = venue.startingStack ?? venue.buyIn
  const seats = Array.from({ length: venue.seats }, (_, i) => ({
    id: i === 0 ? HERO_ID : `ai${i}`,
    name: i === 0 ? 'Hero' : `AI ${i}`,
    stack: startingStack,
  }))
  let buttonId = seats[Math.floor(rng() * seats.length)].id

  const MAX_HANDS = 2000 // flat-blind venues can theoretically ping-pong
  for (let handIndex = 0; handIndex < MAX_HANDS; handIndex++) {
    const live = seats.filter((s) => s.stack > 0)
    if (live.length === 1) {
      return { heroWon: live[0].id === HERO_ID, hands: handIndex, timedOut: false }
    }
    if (!live.some((s) => s.id === HERO_ID)) {
      return { heroWon: false, hands: handIndex, timedOut: false }
    }

    const blinds =
      venue.escalation === false
        ? { smallBlind: venue.smallBlind, bigBlind: venue.bigBlind }
        : blindsAt(venue, handIndex)

    const buttonIndex = Math.max(
      0,
      live.findIndex((s) => s.id === buttonId),
    )
    let state = startHand({
      seats: live.map((s) => ({ id: s.id, name: s.name, stack: s.stack })),
      buttonIndex,
      smallBlind: blinds.smallBlind,
      bigBlind: blinds.bigBlind,
      rng,
    })

    let guard = 0
    while (!isHandComplete(state)) {
      if (++guard > 400) throw new Error(`hand never completed at ${venue.id}`)
      const actor = state.players[state.toActIndex]
      const profile = actor?.id === HERO_ID ? hero : venue.ai
      state = applyAction(state, decideAction(state, profile, rng))
    }

    for (const p of state.players) {
      const seat = seats.find((s) => s.id === p.id)
      if (seat) seat.stack = p.stack
    }
    buttonId = nextButtonId(seats, buttonId)
  }
  return { heroWon: false, hands: MAX_HANDS, timedOut: true }
}

interface SliceResult {
  wins: number
  hands: number
  timeouts: number
}

/**
 * Run tournaments `[tStart, tEnd)` for one venue. Each tournament's RNG is keyed
 * on its index, so slicing the range across workers is deterministic — the union
 * of slices is byte-identical to running the whole range serially.
 */
function simulateSlice(venue: Venue, hero: AiProfile, seed: number, tStart: number, tEnd: number) {
  let wins = 0
  let hands = 0
  let timeouts = 0
  for (let t = tStart; t < tEnd; t++) {
    const rng = mulberry32((hash(venue.id) + seed * 1_000_003 + t) >>> 0)
    const outcome = runTournament(venue, hero, rng)
    if (outcome.heroWon) wins++
    if (outcome.timedOut) timeouts++
    hands += outcome.hands
  }
  return { wins, hands, timeouts } satisfies SliceResult
}

// --- worker: run one venue's slice and report back --------------------------

interface WorkerInput {
  venueId: string
  skill?: number
  heroName: string
  seed: number
  tStart: number
  tEnd: number
}

// Worker mode: a child process replays `node <tsx-cli> sim.ts` with SIM_SLICE
// set, runs its tournament slice, and writes the totals back as JSON on stdout.
// (worker_threads can't be used: the thread wouldn't inherit tsx's TS loader.)
if (process.env.SIM_SLICE) {
  const { venueId, skill, heroName, seed, tStart, tEnd } = JSON.parse(
    process.env.SIM_SLICE,
  ) as WorkerInput
  const base = venueById(venueId)
  const heroProfile = HEROES[heroName]
  if (!base || !heroProfile) throw new Error(`worker: bad venue/hero ${venueId}/${heroName}`)
  const venue = skill === undefined ? base : { ...base, ai: { ...base.ai, skill } }
  process.stdout.write(JSON.stringify(simulateSlice(venue, heroProfile, seed, tStart, tEnd)))
  process.exit(0)
}

/** Fan a venue's `n` tournaments across `workers` child processes; sum the totals. */
function runVenueParallel(
  venue: Venue,
  seed: number,
  heroName: string,
  n: number,
  workers: number,
): Promise<SliceResult> {
  const chunk = Math.ceil(n / workers)
  const ranges: Array<[number, number]> = []
  for (let start = 0; start < n; start += chunk) ranges.push([start, Math.min(start + chunk, n)])
  const scriptPath = fileURLToPath(import.meta.url)

  return Promise.all(
    ranges.map(
      ([tStart, tEnd]) =>
        new Promise<SliceResult>((resolve, reject) => {
          const input: WorkerInput = {
            venueId: venue.id,
            skill: venue.ai.skill,
            heroName,
            seed,
            tStart,
            tEnd,
          }
          const child = spawn(process.execPath, ['--import', 'tsx', scriptPath], {
            env: { ...process.env, SIM_SLICE: JSON.stringify(input) },
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
              resolve(JSON.parse(out) as SliceResult)
            } catch (err) {
              reject(err)
            }
          })
        }),
    ),
  ).then((parts) =>
    parts.reduce<SliceResult>(
      (acc, p) => ({
        wins: acc.wins + p.wins,
        hands: acc.hands + p.hands,
        timeouts: acc.timeouts + p.timeouts,
      }),
      { wins: 0, hands: 0, timeouts: 0 },
    ),
  )
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
  if (names.length === 0) return [KITCHEN_TABLE, ...VENUES]
  const picked: Venue[] = []
  for (const name of names) {
    if (name === 'all') picked.push(KITCHEN_TABLE, ...VENUES, ...SIDE_TABLES, ...RING_TABLES)
    else if (name === 'ladder') picked.push(...VENUES)
    else if (name === 'side') picked.push(...SIDE_TABLES)
    else if (name === 'ring') picked.push(...RING_TABLES)
    else {
      const venue = [...VENUES, ...SIDE_TABLES, ...RING_TABLES, KITCHEN_TABLE].find(
        (v) => v.id === name,
      )
      if (!venue) {
        const ids = [KITCHEN_TABLE, ...VENUES, ...SIDE_TABLES, ...RING_TABLES]
          .map((v) => v.id)
          .join(', ')
        console.error(`Unknown venue "${name}". Ids: ${ids} (or: all, ladder, side)`)
        process.exit(1)
      }
      picked.push(venue)
    }
  }
  return [...new Set(picked)]
}

/** Small deterministic hash so each venue gets its own RNG stream per seed. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

if (!process.env.SIM_SLICE) {
  const { flags, names } = parseArgs(process.argv.slice(2))
  const n = Number(flags.get('n') ?? 200)
  const seed = Number(flags.get('seed') ?? 1)
  const heroName = flags.get('hero') ?? 'competent'
  const hero = HEROES[heroName]
  if (!hero) {
    console.error(`Unknown hero "${heroName}". Heroes: ${Object.keys(HEROES).join(', ')}`)
    process.exit(1)
  }
  const skillOverride = flags.has('skill') ? Number(flags.get('skill')) : undefined
  const venues = resolveVenues(names).map((v) =>
    skillOverride === undefined ? v : { ...v, ai: { ...v.ai, skill: skillOverride } },
  )

  // Fan each venue's tournaments across cores. Sharding is by tournament index,
  // so results are identical to a serial run — just N× faster. Leave a couple of
  // cores free for the OS; never spin up more workers than there are tournaments.
  const workers = Math.max(1, Math.min(os.cpus().length - 2, n))

  console.log(
    `Simulating ${n} tournaments per venue · hero: ${heroName} (skill ${hero.skill}) · seed ${seed} · ${workers} workers\n`,
  )

  const pad = (s: string, w: number) => s.padEnd(w)
  const num = (s: string, w: number) => s.padStart(w)
  console.log(
    `  ${pad('venue', 18)}` +
      num('seats', 6) +
      num('ai skill', 9) +
      num('won', 10) +
      num('win %', 8) +
      num('fair %', 8) +
      num('avg hands', 11) +
      num('EV/entry', 10),
  )

  let sawCash = false
  let sawOutskilled = false
  for (const venue of venues) {
    const started = Date.now()
    const { wins, hands, timeouts } = await runVenueParallel(venue, seed, heroName, n, workers)
    const winRate = wins / n
    const fair = 1 / venue.seats
    // Expected chips per entry, ignoring bounties and mid-game cash-outs.
    const ev = winRate * venue.prize - venue.buyIn
    const secs = ((Date.now() - started) / 1000).toFixed(0)
    // A cash table has no prize and nobody is ever eliminated from it, so both
    // outcome columns are answering a question the venue does not ask. See the
    // note printed below the table.
    const cash = venue.cash === true
    // The hero out-reads the table on the engine's own skill knob, so a win here
    // is not evidence that a weaker player wins. Flagged, not suppressed: the
    // number is still the answer to "does this profile beat this table".
    const outskilled = (hero.skill ?? 1) > (venue.ai.skill ?? 1)
    console.log(
      (outskilled ? '! ' : '  ') +
        pad(venue.name, 18) +
        num(String(venue.seats), 6) +
        num((venue.ai.skill ?? 1).toFixed(2), 9) +
        num(cash ? 'n/a' : `${wins}/${n}`, 10) +
        num(cash ? 'n/a' : `${(winRate * 100).toFixed(0)}%`, 8) +
        num(cash ? 'n/a' : `${(fair * 100).toFixed(0)}%`, 8) +
        num((hands / n).toFixed(1), 11) +
        num(cash ? 'n/a' : (ev >= 0 ? '+' : '') + Math.round(ev).toLocaleString(), 10) +
        `   (${secs}s${timeouts ? `, ${timeouts} timeouts` : ''})`,
    )
    sawCash ||= cash
    sawOutskilled ||= outskilled
  }

  if (sawOutskilled) {
    console.log(
      [
        '',
        `!: the ${heroName} hero (skill ${hero.skill}) is more skilled than that table's AI on the`,
        "engine's own knob, so it out-reads the players it is beating. Whatever the row says,",
        'it is not evidence that a worse player beats the table, and a claim of the form "a',
        'beginner beats this" cannot be read off it. The floor of HEROES is 0.50 and 10 of the',
        '29 shipped tables are below it, so on the soft end of the ladder every hero here is',
        'flagged. Calibrating a hero against a real beginner needs a human. technology#82.',
      ].join('\n'),
    )
  }

  if (sawCash) {
    console.log(
      [
        '',
        'n/a: this harness cannot measure a cash table, so those rows are blanked rather',
        'than filled in with a number that reads like an answer.',
        '',
        '  - It plays every venue as a freezeout, last player standing. A ring table has no',
        '    elimination at all: opponents rebuy and you stand up whenever you like, so the',
        '    win rate is the answer to a question the table never asks.',
        '  - `prize` is 0 on every cash venue, so `winRate * prize - buyIn` is exactly',
        '    `-buyIn` no matter how well the hero plays. It looked like a measured loss and',
        '    it was arithmetic.',
        '',
        'The right measure for these is chips per 100 hands at a fixed stack depth, which is',
        'not built. Until it is, no ring table has ever had its beatability simulated, and',
        'nothing should claim otherwise. avg hands is still real. technology#81.',
      ].join('\n'),
    )
  }
}
