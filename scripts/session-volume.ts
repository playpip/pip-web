// How much data one sit-and-go leaves behind.
//
//   pnpm session-volume                 # garage + pub, 40 runs each
//   pnpm session-volume garage --n 200  # one venue, more runs
//   pnpm session-volume --hero casual   # beginner | casual | competent | best
//   pnpm session-volume --seed 7        # deterministic; same seed = same result
//
// `pnpm sim` answers "does the hero win?". This answers a different question:
// **what does the profile actually hold after a run, and how many runs does it
// take before a rate drawn from it means anything?**
//
// That matters because every claim the product makes about a player is a rate
// over one of the counters in `SeatStats`, and the counter with the fewest
// observations is the one that decides whether the claim is honest. Fold-to-bet
// is the narrowest: it only counts actions where somebody had already bet.
//
// The tally here is the same arithmetic as `finishHand` in `store/game.ts`,
// read off the same engine, so a run's numbers are what the profile would have
// stored had a person played it. The hero is a proxy and is not a calibration
// against any human ([[sim-skill-is-an-information-advantage]] applies): read
// the *volume* columns, which depend on when you bust rather than on how well
// you play, and treat the rate columns as a sanity check that the proxy is
// playing poker at all.
//
// "runs for +/-5" is the honest output: observations needed for a 95% interval
// of +/-5 points on a rate near a half (1.96 * sqrt(0.25 / n) = 0.05, so n = 385),
// divided by what one run deposits. A rate further from a half needs fewer;
// this is the worst case and the one to quote.

import { pathToFileURL } from 'node:url'
import { mulberry32, type Rng } from '@/lib/poker/cards'
import { applyAction, isHandComplete, legalActions, startHand } from '@/lib/poker/engine'
import { type AiProfile, decideAction } from '@/lib/poker/ai/policy'
import { blindsAt } from '@/config/blinds'
import { emptySeatStats, type SeatStats } from '@/lib/reads'
import { STYLE_MIN_HANDS } from '@/lib/playStyle'
import { type Venue, venueById } from '@/config/venues'

export const HERO_ID = 'hero'

/** Same proxies as scripts/sim.ts. Kept in step by hand; neither is a person. */
export const HEROES: Record<string, AiProfile> = {
  beginner: { tightness: 0.2, aggression: 0.3, bluff: 0.04, iterations: 200, skill: 0.5 },
  casual: { tightness: 0.3, aggression: 0.4, bluff: 0.06, iterations: 300, skill: 0.7 },
  competent: { tightness: 0.35, aggression: 0.5, bluff: 0.08, iterations: 400, skill: 0.85 },
  best: { tightness: 0.4, aggression: 0.55, bluff: 0.1, iterations: 600, skill: 1 },
}

/** Observations behind a 95% interval of +/-5 points on a rate near a half. */
export const OBS_FOR_5_POINTS = 385

/** Button moves clockwise to the next seat still holding chips (as in game.ts). */
function nextButtonId(seats: { id: string; stack: number }[], current: string): string {
  const from = seats.findIndex((s) => s.id === current)
  for (let i = 1; i <= seats.length; i++) {
    const seat = seats[(from + i) % seats.length]
    if (seat.stack > 0) return seat.id
  }
  return current
}

/**
 * One full sit-and-go, returning the hero's tendencies for that run alone.
 *
 * The counters are incremented exactly where `applyAction`'s caller in
 * `store/game.ts` increments them, including the detail that `betsFaced` is
 * read off `legalActions` *before* the action is applied and that `vpipHands`
 * is once per hand rather than once per action.
 */
export function runTournament(venue: Venue, hero: AiProfile, rng: Rng): SeatStats {
  const startingStack = venue.startingStack ?? venue.buyIn
  const seats = Array.from({ length: venue.seats }, (_, i) => ({
    id: i === 0 ? HERO_ID : `ai${i}`,
    name: i === 0 ? 'Hero' : `AI ${i}`,
    stack: startingStack,
  }))
  let buttonId = seats[Math.floor(rng() * seats.length)].id
  const tally = emptySeatStats()

  const MAX_HANDS = 2000
  for (let handIndex = 0; handIndex < MAX_HANDS; handIndex++) {
    const live = seats.filter((s) => s.stack > 0)
    if (live.length === 1 || !live.some((s) => s.id === HERO_ID)) return tally

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

    tally.handsDealt++
    let vpipThisHand = false

    let guard = 0
    while (!isHandComplete(state)) {
      if (++guard > 400) throw new Error(`hand never completed at ${venue.id}`)
      const actor = state.players[state.toActIndex]
      const isHero = actor?.id === HERO_ID
      // Read off the state *before* the action, as store/game.ts does.
      const facingBet = (legalActions(state)?.callAmount ?? 0) > 0
      const street = state.street
      const action = decideAction(state, isHero ? hero : venue.ai, rng)

      if (isHero) {
        if (facingBet) tally.betsFaced++
        if (action.type === 'fold' && facingBet) tally.foldsToBet++
        if (action.type === 'call') tally.calls++
        if (action.type === 'bet' || action.type === 'raise') tally.raises++
        const voluntary =
          street === 'preflop' &&
          (action.type === 'bet' ||
            action.type === 'raise' ||
            (action.type === 'call' && facingBet))
        if (voluntary && !vpipThisHand) {
          vpipThisHand = true
          tally.vpipHands++
        }
      }
      state = applyAction(state, action)
    }

    // A showdown counts for everyone who was still in it (game.ts finishHand).
    if (state.result?.showdown) {
      const heroSeat = state.players.find((p) => p.id === HERO_ID)
      if (heroSeat && heroSeat.status !== 'folded' && heroSeat.status !== 'out') tally.showdowns++
    }

    for (const p of state.players) {
      const seat = seats.find((s) => s.id === p.id)
      if (seat) seat.stack = p.stack
    }
    buttonId = nextButtonId(seats, buttonId)
  }
  return tally
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Runs needed to reach `OBS_FOR_5_POINTS` observations of a counter. */
export const runsFor5 = (perRun: number) =>
  perRun <= 0 ? Infinity : Math.ceil(OBS_FOR_5_POINTS / perRun)

async function main() {
  const argv = process.argv.slice(2)
  const flag = (name: string) => {
    const i = argv.indexOf(`--${name}`)
    return i === -1 ? undefined : argv[i + 1]
  }
  const n = Number(flag('n') ?? 40)
  const seed = Number(flag('seed') ?? 1)
  const heroName = flag('hero') ?? 'casual'
  const hero = HEROES[heroName]
  if (!hero) throw new Error(`unknown hero ${heroName}`)
  const ids = argv.filter((a) => !a.startsWith('--') && !/^\d+(\.\d+)?$/.test(a))
  // Two soft rungs on purpose. Cost is dominated by the venue's `iterations`
  // and its seat count, so The Main Event (1,800 iterations, 6 seats) is hours
  // rather than minutes and is not a default. Name it explicitly if you want it.
  const venueIds = ids.length > 0 ? ids : ['garage', 'pub']

  console.log(`hero=${heroName} n=${n} seed=${seed}\n`)

  for (const id of venueIds) {
    const venue = venueById(id)
    if (!venue) throw new Error(`unknown venue ${id}`)

    const runs: SeatStats[] = []
    for (let t = 0; t < n; t++) {
      runs.push(runTournament(venue, hero, mulberry32((seed * 1_000_003 + t) >>> 0)))
    }

    const col = (pick: (s: SeatStats) => number) => runs.map(pick)
    const hands = col((s) => s.handsDealt)
    const faced = col((s) => s.betsFaced)
    const actions = col((s) => s.raises + s.calls)
    const showdowns = col((s) => s.showdowns)

    const total = runs.reduce(
      (a, s) => ({
        handsDealt: a.handsDealt + s.handsDealt,
        vpipHands: a.vpipHands + s.vpipHands,
        raises: a.raises + s.raises,
        calls: a.calls + s.calls,
        betsFaced: a.betsFaced + s.betsFaced,
        foldsToBet: a.foldsToBet + s.foldsToBet,
        showdowns: a.showdowns + s.showdowns,
      }),
      emptySeatStats(),
    )

    console.log(`${venue.name} (${venue.seats} seats, ${n} runs)`)
    console.log(
      `  per run   hands ${mean(hands).toFixed(1)} (median ${median(hands)})` +
        `   bets faced ${mean(faced).toFixed(1)} (median ${median(faced)})` +
        `   bets+calls ${mean(actions).toFixed(1)}` +
        `   showdowns ${mean(showdowns).toFixed(1)}`,
    )
    console.log(
      `  rates     VPIP ${pct(total.vpipHands / total.handsDealt)}` +
        `   aggression ${pct(total.raises / (total.raises + total.calls))}` +
        `   fold-to-bet ${pct(total.foldsToBet / total.betsFaced)}`,
    )
    console.log(
      `  runs for +/-5 points:` +
        `   on a hand rate ${runsFor5(mean(hands))}` +
        `   on fold-to-bet ${runsFor5(mean(faced))}` +
        `   on aggression ${runsFor5(mean(actions))}`,
    )
    console.log(
      `  runs to clear STYLE_MIN_HANDS (${STYLE_MIN_HANDS}): ` +
        `${Math.ceil(STYLE_MIN_HANDS / mean(hands))}` +
        `   runs with zero showdowns: ${showdowns.filter((x) => x === 0).length}/${n}`,
    )
    console.log()
  }
}

const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : 'n/a')

// True only when this file is the process entry point. `tests/sessionVolume`
// imports the pieces above, and without this guard the import runs the whole
// CLI inside the test worker (the same trap cash-sim.ts documents).
const IS_ENTRY =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (IS_ENTRY) main()
