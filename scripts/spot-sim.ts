// Spot-trainer feasibility harness. Answers one question, and only one:
//
//   **Is `decideAction` a defensible answer key?**
//
// The drills spec (technology#55, `drafts/build-drills-spot-trainers.md`) has a
// fifth kind, the spot trainer: "a full street played out against real AI
// ranges, one decision at a time", graded by "the AI policy plus equity". Every
// kind that has actually shipped walked away from the spec's Monte-Carlo
// grading and enumerated instead. The spot trainer cannot enumerate, so before
// building it this measures whether the proposed grader can mark an answer at
// all.
//
//   pnpm spot-sim                  # garage + pub, 80 spots each
//   pnpm spot-sim --n 200          # more spots (slower; see the cost note)
//   pnpm spot-sim --seed 7         # deterministic; same seed, same spots
//   pnpm spot-sim --venues pub --keys best   # one cell; a full pass is minutes
//
// **What a "spot" is here.** A player postflop, facing a bet, who can legally
// fold or call. That is the spot trainer's atom: the decision the drill would
// put a button under. Spots are harvested from real hands played by the real
// engine at a real venue, and the **whole `HandState` is kept**, not a summary
// of it, so the policy is re-asked about the identical position rather than a
// reconstruction of one. Reconstructing it would quietly change the answer:
// `opponentSelectivity` reads chips committed this hand, so a rebuilt pot is a
// different range read and therefore a different equity.
//
// **The three numbers, and why each one is the question.**
//
//   1. *unstable*: the share of spots where `decideAction`, asked repeatedly
//      about the identical state under different seeds, does not give the same
//      answer. An answer key that changes its mind is not a key.
//   2. *ambiguous*: the share where the hand's equity sits within the spec's
//      4-point margin of the price the pot is laying. The spec's fix for noisy
//      grading is to throw these away, so this is the tax that fix charges.
//   3. *key != price*: of the spots that survive both filters, the share where
//      the policy's most common action is not the action the price justifies.
//      **Every one of those is a spot where a player who called correctly would
//      be told they were wrong.**
//
// **On the truth number.** Equity here is `estimateEquity` at 20,000 iterations
// against the same opponent ranges the policy models, which carries about a
// ±0.7 point 95% band (`equity-se-is-bounded`: the standard error of a mean of
// per-hand pot shares is at most 0.5/sqrt(iterations) whatever the ranges, the
// board or the opponent count do). The 4-point margin is comfortably outside
// that band, which is what makes the comparison worth printing.
//
// It is the same estimator the policy uses, so this is **not** evidence about
// how well the AI plays: a shared estimator cannot grade itself
// (technology#82). It is evidence about whether the policy's *action* tracks
// the *price*, which is a different claim and the only one the spot trainer
// needs.
//
// **Cost.** 20,000 iterations against ranged opponents is seconds, not
// milliseconds, so this counts spots rather than hands and runs in minutes.

import { mulberry32, type Rng } from '@/lib/poker/cards'
import {
  applyAction,
  isHandComplete,
  legalActions,
  potSize,
  startHand,
  type HandState,
} from '@/lib/poker/engine'
import { estimateEquity } from '@/lib/poker/equity'
import { decideAction, opponentSelectivity, type AiProfile } from '@/lib/poker/ai/policy'
import { venueById, type Venue } from '@/config/venues'

/** The spec's ambiguity margin, in equity points. Its own words: "start at 4". */
const AMBIGUITY_MARGIN = 0.04

/** Iterations for the truth equity. See the band note at the top of the file. */
const TRUTH_ITERATIONS = 20_000

/** How many times each spot is put to the key, to see if it answers the same. */
const KEY_SEEDS = 12

/**
 * The fairest possible answer key: skill 1, so no misread noise and none of the
 * random give-up folding. If the policy is defensible as a grader anywhere, it
 * is here. The knobs are the shipped "best" proxy's from `scripts/sim.ts`.
 */
const BEST: AiProfile = { tightness: 0.4, aggression: 0.55, bluff: 0.1, iterations: 600, skill: 1 }

interface Spot {
  /** The real position, kept whole. */
  state: HandState
  toCall: number
  pot: number
}

/** The state as it stands, if the actor is facing a real postflop call or fold. */
function captureSpot(state: HandState): Spot | null {
  const legal = legalActions(state)
  const player = state.players[state.toActIndex]
  if (!legal || !player) return null
  if (state.street === 'preflop') return null
  if (!legal.canFold || !legal.canCall || legal.callAmount <= 0) return null

  const opponents = state.players.filter(
    (p) => p.id !== player.id && p.status !== 'folded' && p.status !== 'out',
  )
  if (opponents.length === 0) return null

  return { state: structuredClone(state), toCall: legal.callAmount, pot: potSize(state) }
}

/** Play hands at `venue` until `want` postflop call-or-fold spots are harvested. */
function harvest(venue: Venue, want: number, rng: Rng): Spot[] {
  const spots: Spot[] = []
  const stack = venue.startingStack ?? venue.buyIn

  while (spots.length < want) {
    const seats = Array.from({ length: venue.seats }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      stack,
    }))
    let state = startHand({
      seats,
      buttonIndex: Math.floor(rng() * seats.length),
      smallBlind: venue.smallBlind,
      bigBlind: venue.bigBlind,
      rng,
    })

    let guard = 0
    while (!isHandComplete(state)) {
      if (++guard > 400) break
      if (spots.length < want) {
        const spot = captureSpot(state)
        if (spot) spots.push(spot)
      }
      state = applyAction(state, decideAction(state, venue.ai, rng))
    }
  }

  return spots
}

interface Verdict {
  equity: number
  price: number
  ambiguous: boolean
  priceAction: 'call' | 'fold'
  unstable: boolean
  flipsOnFold: boolean
  modal: string
}

function judge(spot: Spot, key: AiProfile, index: number): Verdict {
  const player = spot.state.players[spot.state.toActIndex]
  const opponents = spot.state.players.filter(
    (p) => p.id !== player.id && p.status !== 'folded' && p.status !== 'out',
  )

  const { equity } = estimateEquity({
    hole: player.hole,
    community: spot.state.community,
    opponents: opponents.length,
    opponentSelectivity: opponents.map((p) => opponentSelectivity(spot.state, p)),
    iterations: TRUTH_ITERATIONS,
    rng: mulberry32(((index + 1) * 2_654_435_761) >>> 0),
  })

  const price = spot.toCall / (spot.pot + spot.toCall)

  const counts = new Map<string, number>()
  for (let s = 0; s < KEY_SEEDS; s++) {
    const rng = mulberry32(((index + 1) * 1_000_003 + s * 7_919) >>> 0)
    const { type } = decideAction(spot.state, key, rng)
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  const modal = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const folds = counts.get('fold') ?? 0

  return {
    equity,
    price,
    ambiguous: Math.abs(equity - price) < AMBIGUITY_MARGIN,
    priceAction: equity >= price ? 'call' : 'fold',
    unstable: counts.size > 1,
    // The sharpest cut: on the identical position, the key both folds and
    // continues depending only on the seed. Call-versus-raise instability is a
    // real problem for a drill with three buttons, but this one is the problem
    // even for a drill with two.
    flipsOnFold: folds > 0 && folds < KEY_SEEDS,
    modal,
  }
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`
}

function report(label: string, spots: Spot[], key: AiProfile) {
  const verdicts = spots.map((s, i) => judge(s, key, i))

  const unstable = verdicts.filter((v) => v.unstable).length
  const flips = verdicts.filter((v) => v.flipsOnFold).length
  const ambiguous = verdicts.filter((v) => v.ambiguous).length
  const clean = verdicts.filter((v) => !v.ambiguous && !v.unstable)

  // "Continues" rather than "calls": raising is also not folding, and a key that
  // raises where the price says call has still not marked the player wrong for
  // putting chips in. Only a fold contradicts a correct call.
  const disagrees = clean.filter((v) => (v.modal === 'fold') !== (v.priceAction === 'fold'))
  const foldsACorrectCall = clean.filter((v) => v.priceAction === 'call' && v.modal === 'fold')

  console.log(`\n${label}   n=${spots.length}`)
  console.log(`  unstable across ${KEY_SEEDS} seeds        ${pct(unstable, verdicts.length)}`)
  console.log(`  ...folds AND continues, same spot ${pct(flips, verdicts.length)}`)
  console.log(`  ambiguous inside 4 points        ${pct(ambiguous, verdicts.length)}`)
  console.log(`  gradeable spots left             ${clean.length}`)
  console.log(`  ...key disagrees with the price  ${pct(disagrees.length, clean.length)}`)
  console.log(`  ...key folds a correct call      ${pct(foldsACorrectCall.length, clean.length)}`)
}

function main() {
  const args = process.argv.slice(2)
  const num = (flag: string, dflt: number) => {
    const i = args.indexOf(flag)
    return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt
  }
  const want = num('--n', 80)
  const seed = num('--seed', 1)

  console.log(
    'Spot-trainer feasibility: is decideAction an answer key?\n' +
      `${TRUTH_ITERATIONS.toLocaleString()} iterations per truth equity (about a ±0.7 point band), ` +
      `${KEY_SEEDS} seeds per key answer, ${AMBIGUITY_MARGIN * 100}-point ambiguity margin.`,
  )

  // Each cell is minutes, so both axes are selectable: a full pass is four
  // cells and the machine that runs this has two cores.
  const list = (flag: string, dflt: string[]) => {
    const i = args.indexOf(flag)
    return i >= 0 && args[i + 1] ? args[i + 1].split(',') : dflt
  }
  const venues = list('--venues', ['garage', 'pub'])
  const keys = list('--keys', ['venue', 'best'])

  for (const id of venues) {
    const venue = venueById(id)
    if (!venue) throw new Error(`no venue ${id}`)
    const spots = harvest(venue, want, mulberry32((seed * 7_919 + id.length) >>> 0))
    if (keys.includes('venue')) report(`${venue.name}, graded by its own bot`, spots, venue.ai)
    if (keys.includes('best')) report(`${venue.name}, graded by a skill-1 key`, spots, BEST)
  }
}

main()
