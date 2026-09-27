// The unbet-pot harness. Answers two questions about postflop betting, and only
// those two:
//
//   1. **How is postflop equity distributed across the three gate bands?**
//      `POSTFLOP_GATE.bluffCeiling` and `POSTFLOP_GATE.lead` cut the range into
//      bluff / middle / value. The middle band is the one `decideAction` had no
//      branch for, so a hand landing in it could not be bet at any table, at any
//      aggression, ever (technology#79).
//   2. **How often does the AI actually bet a pot that is checked to it**, split
//      by street and by how many opponents are live?
//
// Question 1 is the structural claim and question 2 is what a player sees. They
// are separate measurements on purpose: the first deals random boards and needs
// no engine, the second plays real hands with the real engine at a real venue
// and never computes an equity at all.
//
//   pnpm lead-band                          # census + lead rates, shipped venues
//   pnpm lead-band --flops 1500             # census sample (default 1200)
//   pnpm lead-band --hands 300              # hands per venue (default 200)
//   pnpm lead-band --venues garage,main-event
//   pnpm lead-band --seed 7                 # deterministic; same seed, same run
//   pnpm lead-band --census-only            # skip the engine half
//
// **On the census number.** Equity is `estimateEquity` at the shipped default of
// 1,500 iterations, which carries about a +/-2.5 point 95% band per flop
// (`equity-se-is-bounded`). That is the estimate the policy itself decides on,
// so it is the right one for "what share of flops can the AI not bet": a flop
// the estimator puts at 0.55 is unbettable whatever its true equity is. It is
// the wrong one for a claim about true equity, and no such claim is made here.
//
// **On the opponent range.** A postflop opponent is never two random cards, so
// the census runs at three selectivity settings rather than one. The band's
// width moves with it, and quoting a single figure would hide that.

import { mulberry32, shuffledDeck, type Rng } from '@/lib/poker/cards'
import { POSTFLOP_GATE } from '@/config/aiGates'
import {
  applyAction,
  isHandComplete,
  legalActions,
  startHand,
  type HandState,
  type SeatConfig,
  type Street,
} from '@/lib/poker/engine'
import { estimateEquity } from '@/lib/poker/equity'
import { decideAction, type AiProfile } from '@/lib/poker/ai/policy'
import { ALL_VENUES, venueById, type Venue } from '@/config/venues'

/** Iterations for the census. The shipped default, on purpose: see the note above. */
const CENSUS_ITERATIONS = 1_500

/** Selectivity settings the census runs at, spanning a real postflop range read. */
const SELECTIVITIES = [0, 0.3, 0.5] as const

/** Venues the engine half runs on unless `--venues` says otherwise. */
const DEFAULT_VENUES = ['garage', 'pub', 'cardroom', 'mainevent'] as const

const POSTFLOP_STREETS: readonly Street[] = ['flop', 'turn', 'river']

interface Flags {
  flops: number
  hands: number
  seed: number
  venues: string[]
  censusOnly: boolean
}

function parseFlags(argv: readonly string[]): Flags {
  const flags = new Map<string, string>()
  let censusOnly = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--census-only') {
      censusOnly = true
      continue
    }
    if (arg?.startsWith('--')) {
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(arg.slice(2), next)
        i++
      }
    }
  }
  const num = (key: string, fallback: number): number => {
    const raw = flags.get(key)
    if (raw === undefined) return fallback
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) throw new Error(`--${key} must be a positive number`)
    return Math.floor(n)
  }
  const venues = (flags.get('venues') ?? DEFAULT_VENUES.join(',')).split(',').filter(Boolean)
  return {
    flops: num('flops', 1_200),
    hands: num('hands', 200),
    seed: num('seed', 1),
    venues,
    censusOnly,
  }
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`

// --- question 1: the band census -------------------------------------------

interface Census {
  selectivity: number
  n: number
  belowBluffCeiling: number
  inBand: number
  aboveLead: number
}

/**
 * Deal `n` random heads-up flops and bucket each one by where the shipped
 * estimator puts its equity relative to the two heads-up gates. Heads-up, a
 * fair share of the pot is exactly a half, so the multiples in `POSTFLOP_GATE`
 * become the absolutes they were written as. They are read from config rather
 * than typed here: a local copy of a gate is how a harness ends up measuring a
 * number the policy stopped using.
 */
function census(n: number, selectivity: number, rng: Rng): Census {
  const fairShare = 1 / (1 + 1)
  const bluffCeiling = fairShare * POSTFLOP_GATE.bluffCeiling
  const lead = fairShare * POSTFLOP_GATE.lead
  let below = 0
  let band = 0
  let above = 0
  for (let i = 0; i < n; i++) {
    const deck = shuffledDeck(rng)
    const { equity } = estimateEquity({
      hole: deck.slice(0, 2),
      community: deck.slice(2, 5),
      opponents: 1,
      opponentSelectivity: [selectivity],
      iterations: CENSUS_ITERATIONS,
      rng,
    })
    if (equity < bluffCeiling) below++
    else if (equity > lead) above++
    else band++
  }
  return { selectivity, n, belowBluffCeiling: below, inBand: band, aboveLead: above }
}

// --- question 2: what the AI does with a pot checked to it ------------------

interface Cell {
  n: number
  led: number
}

type LeadTable = Map<string, Cell>

const cellKey = (street: Street, opponents: number): string => `${street}|${opponents}`

function bump(table: LeadTable, street: Street, opponents: number, led: boolean): void {
  const key = cellKey(street, opponents)
  const cell = table.get(key) ?? { n: 0, led: 0 }
  cell.n++
  if (led) cell.led++
  table.set(key, cell)
}

function seatsFor(venue: Venue): SeatConfig[] {
  return Array.from({ length: venue.seats }, (_, i) => ({
    id: `p${i}`,
    name: `p${i}`,
    stack: venue.startingStack ?? venue.buyIn,
  }))
}

/**
 * Play `hands` hands at `venue` with every seat running that venue's shipped
 * profile, recording every postflop decision where nothing is owed. An all-AI
 * table is the instrument on purpose: the question is what the bots do with a
 * checked-to pot, and putting a hero in it would mix a second policy into the
 * denominator.
 */
function measure(venue: Venue, hands: number, seed: number): LeadTable {
  const table: LeadTable = new Map()
  const profile: AiProfile = venue.ai
  for (let h = 0; h < hands; h++) {
    const rng = mulberry32(seed * 1_000_003 + h * 7 + 13)
    let state: HandState = startHand({
      seats: seatsFor(venue),
      buttonIndex: h % venue.seats,
      smallBlind: venue.smallBlind,
      bigBlind: venue.bigBlind,
      rng,
    })
    let guard = 0
    while (!isHandComplete(state) && guard++ < 1_000) {
      const legal = legalActions(state)
      const player = state.players[state.toActIndex]
      const action = decideAction(state, profile, rng)
      if (
        player &&
        legal?.callAmount === 0 &&
        (POSTFLOP_STREETS as readonly string[]).includes(state.street)
      ) {
        const live = state.players.filter(
          (p) => p.id !== player.id && p.status !== 'folded' && p.status !== 'out',
        ).length
        bump(table, state.street, live, action.type === 'bet' || action.type === 'raise')
      }
      state = applyAction(state, action)
    }
  }
  return table
}

function totals(table: LeadTable, predicate: (street: Street, opponents: number) => boolean): Cell {
  let n = 0
  let led = 0
  for (const [key, cell] of table) {
    const [street, opponents] = key.split('|')
    if (!street || opponents === undefined) continue
    if (!predicate(street as Street, Number(opponents))) continue
    n += cell.n
    led += cell.led
  }
  return { n, led }
}

function rate(cell: Cell): string {
  if (cell.n === 0) return '   n/a'
  return `${pct(cell.led / cell.n).padStart(6)}`
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2))
  const fairShare = 1 / (1 + 1)

  console.log(
    `\nHeads-up gates: bluff below ${(fairShare * POSTFLOP_GATE.bluffCeiling).toFixed(2)}, ` +
      `lead above ${(fairShare * POSTFLOP_GATE.lead).toFixed(2)}, ` +
      `so the middle band is [${(fairShare * POSTFLOP_GATE.bluffCeiling).toFixed(2)}, ${(fairShare * POSTFLOP_GATE.lead).toFixed(2)}].\n`,
  )

  console.log(
    `Band census: ${flags.flops} random heads-up flops per row, ${CENSUS_ITERATIONS} iterations each.`,
  )
  console.log('  opp range     below ceiling       in band      above lead')
  for (const selectivity of SELECTIVITIES) {
    const rng = mulberry32(flags.seed * 31 + Math.round(selectivity * 100))
    const c = census(flags.flops, selectivity, rng)
    console.log(
      `  sel ${selectivity.toFixed(2)}` +
        `${pct(c.belowBluffCeiling / c.n).padStart(18)}` +
        `${pct(c.inBand / c.n).padStart(14)}` +
        `${pct(c.aboveLead / c.n).padStart(16)}`,
    )
  }

  if (flags.censusOnly) return

  console.log(`\nUnbet pots led, ${flags.hands} hands per venue, every seat on the venue profile.`)
  console.log('  venue                 seats     flop      turn     river    heads-up   multiway')
  for (const id of flags.venues) {
    const venue = venueById(id)
    if (!venue) {
      console.error(`  unknown venue "${id}" (ids: ${ALL_VENUES.map((v) => v.id).join(', ')})`)
      continue
    }
    const table = measure(venue, flags.hands, flags.seed)
    const flop = totals(table, (s) => s === 'flop')
    const turn = totals(table, (s) => s === 'turn')
    const river = totals(table, (s) => s === 'river')
    const headsUp = totals(table, (_s, o) => o === 1)
    const multiway = totals(table, (_s, o) => o >= 2)
    console.log(
      `  ${venue.name.padEnd(20)} ${String(venue.seats).padStart(5)}` +
        `  ${rate(flop)}  ${rate(turn)}  ${rate(river)}  ${rate(headsUp)}  ${rate(multiway)}`,
    )
    console.log(
      `  ${''.padEnd(20)} ${''.padStart(5)}` +
        `  ${String(`n=${flop.n}`).padStart(6)}  ${String(`n=${turn.n}`).padStart(6)}` +
        `  ${String(`n=${river.n}`).padStart(6)}  ${String(`n=${headsUp.n}`).padStart(6)}` +
        `  ${String(`n=${multiway.n}`).padStart(6)}`,
    )
  }
  console.log('')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
