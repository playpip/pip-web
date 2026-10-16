// Can a player tell the cast apart? Each band's regulars sit at one table of
// their band, with a seat for the venue's own profile as a control, and every
// seat is tracked the way a player tracker would (scripts/table-stats.ts). A
// character whose numbers match the control's is a name on a chair: their
// personality does not reach the cards.
//
//   pnpm persona-stats                    # every band at its middle rung
//   pnpm persona-stats casino             # one venue's roster
//   pnpm persona-stats --hands 30000      # hands per table (default 20000)
//   pnpm persona-stats --json             # machine-readable
//
// Six-handed cash at 100bb, reset every hand. The seats rotate in blocks of
// `BLOCK` hands, the table keeping its memory within a block, so every
// character sits with every other and in every chair. Each block depends on its
// index alone, so the run splits across workers with the same result serially.
//
// **How to read it.** Next to each character's rate is its z against the
// control's, from a two-proportion test. Two characters are "the same player"
// here when no stat separates them at |z| >= 3, which with fifteen stats and
// dozens of pairs is a deliberately high bar: anything over it is a difference
// a tracker would find. Below it a player might still notice, just not from
// these stats.
//
// The AI version is `fast`, which makes exactly v1's decisions sooner.

import { spawn } from 'node:child_process'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bandFor, type CastBand, type Character, profileFor, rosterFor } from '@/config/cast'
import { VENUES, type Venue, venueById } from '@/config/venues'
import { createTableMemory, observeAction } from '@/lib/poker/ai/memory'
import { type AiProfile, decideAction } from '@/lib/poker/ai/policy'
import { mulberry32 } from '@/lib/poker/cards'
import { applyAction, isHandComplete, startHand } from '@/lib/poker/engine'
import { versionProfile } from './ai-versions'
import { streamSeed } from './bot-duel'
import {
  addSeatStats,
  createHandTracker,
  emptySeatStats,
  rate,
  type SeatStats,
  STAT_KEYS,
  STAT_LABEL,
  type StatKey,
  type Tally,
} from './table-stats'

/** The seat that plays the venue's own profile, with no personality. */
export const CONTROL = 'control'
const SEATS = 6
const BLOCK = 60
const STACK_BB = 100

export interface Participant {
  id: string
  profile: AiProfile
}

/** The venue's roster with their profiles, and the control seat. */
export function participantsFor(venue: Venue): Participant[] {
  const cast: Character[] = rosterFor(venue)
  return [
    { id: CONTROL, profile: versionProfile('fast', venue.ai) },
    ...cast.map((ch) => ({ id: ch.id, profile: versionProfile('fast', profileFor(venue, ch)) })),
  ]
}

/** Who sits where in a block: round-robin through the field, seat order shuffled. */
export function blockSeats(field: readonly Participant[], block: number, seed: number) {
  const n = Math.min(SEATS, field.length)
  const picked = Array.from({ length: n }, (_, i) => field[(block * n + i) % field.length])
  const rng = mulberry32(streamSeed(seed, block, 7))
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[picked[i], picked[j]] = [picked[j], picked[i]]
  }
  return picked
}

export type PersonaTotals = Record<string, SeatStats>

/** Blocks `[start, end)` at a venue. */
export function runPersonas(
  venue: Venue,
  seed: number,
  start: number,
  end: number,
  field = participantsFor(venue),
): PersonaTotals {
  const totals: PersonaTotals = Object.fromEntries(field.map((p) => [p.id, emptySeatStats()]))
  const bb = 2
  const stack = STACK_BB * bb
  for (let block = start; block < end; block++) {
    const seated = blockSeats(field, block, seed)
    const profiles = new Map(seated.map((p) => [p.id, p.profile]))
    const rng = mulberry32(streamSeed(seed, block, 11))
    const memory = createTableMemory()
    for (let h = 0; h < BLOCK; h++) {
      let state = startHand({
        seats: seated.map((p) => ({ id: p.id, name: p.id, stack })),
        buttonIndex: h % seated.length,
        smallBlind: bb / 2,
        bigBlind: bb,
        rng,
      })
      const tracker = createHandTracker((id) => totals[id] ?? null)
      while (!isHandComplete(state)) {
        const actor = state.players[state.toActIndex]
        const action = decideAction(state, profiles.get(actor.id) as AiProfile, rng, memory)
        tracker.observe(state, action)
        observeAction(memory, state, action)
        state = applyAction(state, action)
      }
      tracker.finish(state, Object.fromEntries(seated.map((p) => [p.id, stack])))
    }
  }
  return totals
}

/** Two-proportion z of `a` against `b`; 0 when either has no chances. */
export function zOf(a: Tally, b: Tally): number {
  if (a.chances === 0 || b.chances === 0) return 0
  const p1 = a.hits / a.chances
  const p2 = b.hits / b.chances
  const p = (a.hits + b.hits) / (a.chances + b.chances)
  const se = Math.sqrt(p * (1 - p) * (1 / a.chances + 1 / b.chances))
  return se === 0 ? 0 : (p1 - p2) / se
}

/** Stats on which two seats differ at |z| >= `bar`. */
export function separatingStats(a: SeatStats, b: SeatStats, bar = 3): StatKey[] {
  return STAT_KEYS.filter((k) => Math.abs(zOf(a.stat[k], b.stat[k])) >= bar)
}

/** Every pair of seats that no stat separates. */
export function lookalikes(totals: PersonaTotals, bar = 3): [string, string][] {
  const ids = Object.keys(totals)
  const pairs: [string, string][] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (separatingStats(totals[ids[i]], totals[ids[j]], bar).length === 0) {
        pairs.push([ids[i], ids[j]])
      }
    }
  }
  return pairs
}

// --- workers -----------------------------------------------------------------

const IS_ENTRY =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

/** Blocks summed together before joining the run; fixed, for the reason `CHUNK` in bot-duel is. */
const BLOCKS_PER_CHUNK = 10

if (IS_ENTRY && process.env.PERSONA_SLICE) {
  const { venueId, seed, blocks, chunkStart, chunkEnd } = JSON.parse(process.env.PERSONA_SLICE)
  const venue = venueById(venueId) as Venue
  const out: PersonaTotals[] = []
  for (let c = chunkStart; c < chunkEnd; c++) {
    out.push(
      runPersonas(venue, seed, c * BLOCKS_PER_CHUNK, Math.min((c + 1) * BLOCKS_PER_CHUNK, blocks)),
    )
  }
  // A pipe takes 64 KB at a time and exit() drops the rest, so exit once it
  // has all been written.
  process.stdout.write(JSON.stringify(out), () => process.exit(0))
}

function merge(a: PersonaTotals, b: PersonaTotals): PersonaTotals {
  const out: PersonaTotals = { ...a }
  for (const [id, s] of Object.entries(b)) out[id] = out[id] ? addSeatStats(out[id], s) : s
  return out
}

function runParallel(venueId: string, seed: number, blocks: number, workers: number) {
  const chunks = Math.ceil(blocks / BLOCKS_PER_CHUNK)
  const per = Math.max(1, Math.ceil(chunks / workers))
  const jobs: Promise<PersonaTotals[]>[] = []
  for (let chunkStart = 0; chunkStart < chunks; chunkStart += per) {
    const slice = {
      venueId,
      seed,
      blocks,
      chunkStart,
      chunkEnd: Math.min(chunkStart + per, chunks),
    }
    jobs.push(
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url)], {
          env: { ...process.env, PERSONA_SLICE: JSON.stringify(slice) },
          stdio: ['ignore', 'pipe', 'inherit'],
        })
        let out = ''
        child.stdout.on('data', (d) => {
          out += d
        })
        child.on('error', reject)
        child.on('close', (code) => {
          if (code !== 0) return reject(new Error(`worker exited ${code}`))
          resolve(JSON.parse(out) as PersonaTotals[])
        })
      }),
    )
  }
  // Consecutive chunks per job, so job order is chunk order.
  return Promise.all(jobs).then((parts) => parts.flat().reduce(merge, {}))
}

/** The middle rung of each band on the ladder. */
function middleRungs(): Venue[] {
  const bands: CastBand[] = ['low', 'mid', 'high']
  return bands.map((band) => {
    const rungs = VENUES.filter((v) => bandFor(v) === band)
    return rungs[Math.floor((rungs.length - 1) / 2)]
  })
}

if (IS_ENTRY && !process.env.PERSONA_SLICE) {
  const args = process.argv.slice(2)
  const flag = (name: string) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : undefined
  }
  const flagged = new Set(
    ['--hands', '--seed', '--workers'].flatMap((f) => {
      const i = args.indexOf(f)
      return i >= 0 ? [i, i + 1] : []
    }),
  )
  const names = args.filter((a, i) => !flagged.has(i) && !a.startsWith('--'))
  const venues = names.length
    ? names.map((id) => {
        const v = venueById(id)
        if (!v) throw new Error(`unknown venue "${id}"`)
        // The hands are dealt as Hold'em, so another game's venue would be read at the wrong game.
        if ((v.variant ?? 'holdem') !== 'holdem') {
          throw new Error(`${v.name} is not Hold'em; persona-stats reads Hold'em venues only`)
        }
        return v
      })
    : middleRungs()
  const hands = Number(flag('hands') ?? 20000)
  const seed = Number(flag('seed') ?? 1)
  const workers = Math.max(1, Number(flag('workers') ?? Math.min(os.cpus().length - 2, 14)))
  const blocks = Math.max(1, Math.round(hands / BLOCK))

  for (const venue of venues) {
    const t0 = Date.now()
    const field = participantsFor(venue)
    const totals = await runParallel(venue.id, seed, blocks, workers)
    if (args.includes('--json')) {
      console.log(
        JSON.stringify({
          venue: venue.id,
          hands: blocks * BLOCK,
          seed,
          profiles: Object.fromEntries(field.map((p) => [p.id, p.profile])),
          totals,
          lookalikes: lookalikes(totals),
        }),
      )
      continue
    }
    const ids = field.map((p) => p.id)
    console.log(
      `${venue.name} · ${blocks * BLOCK} hands · six-handed, ${STACK_BB}bb · seed ${seed} · rate (z vs control)\n`,
    )
    const cell = (s: SeatStats, k: StatKey) => {
      const r = rate(s.stat[k])
      if (r === null) return '-'
      const z = zOf(s.stat[k], totals[CONTROL].stat[k])
      return `${(r * 100).toFixed(1)}${s === totals[CONTROL] ? '' : ` (${z >= 0 ? '+' : ''}${z.toFixed(1)})`}`
    }
    console.log(`  ${''.padEnd(32)}${ids.map((id) => id.padStart(15)).join('')}`)
    for (const k of STAT_KEYS) {
      console.log(
        `  ${STAT_LABEL[k].padEnd(32)}${ids.map((id) => cell(totals[id], k).padStart(15)).join('')}`,
      )
    }
    const bb100 = (s: SeatStats) => ((100 * s.netBb) / Math.max(s.hands, 1)).toFixed(1)
    console.log(
      `  ${'won, bb/100'.padEnd(32)}${ids.map((id) => bb100(totals[id]).padStart(15)).join('')}`,
    )
    const pairs = lookalikes(totals)
    console.log(
      pairs.length
        ? `\n  No stat separates: ${pairs.map((p) => p.join(' & ')).join(', ')}`
        : '\n  Every seat is separated from every other by at least one stat.',
    )
    console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`)
  }
}
