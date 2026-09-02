// Coaching measurement harness. "Second opinion" has been live since v1.11.0
// and nothing has ever measured it. This answers the three questions:
//
//   1. How often does it speak? A coach who speaks on most hands is noise; one
//      who never speaks is dead code.
//   2. Is what it says stable? The read is seeded off the hand, so a player gets
//      one draw from a Monte-Carlo estimate. If a different seed would have said
//      the opposite, the sentence is a coin flip wearing a percentage.
//   3. What does it cost to produce? It runs on the player's device after every
//      hand, up to MAX_ANALYSED equity simulations deep.
//
//   pnpm coach-sim                       # kitchen + garage, casual hero
//   pnpm coach-sim garage --hands 800    # hands dealt to the hero (default 500)
//   pnpm coach-sim --hero beginner       # beginner | casual | competent | best
//   pnpm coach-sim --sample 120          # decisions taken into the stability pass
//   pnpm coach-sim --repeats 11          # re-runs per sampled decision
//   pnpm coach-sim --seed 7              # deterministic; same seed = same result
//
// Phase 1 seats a proxy hero at the venue, plays its real tournaments back to
// back until `hands` have been dealt, and runs the shipped read on every one. Phase 2 takes an even sample of the hands a read was possible on
// and re-runs the same arithmetic `repeats` times under fresh seeds. The mean of
// those runs is the reference; their spread is the noise the shipped single draw
// is subject to. Both numbers come out of the same work.
//
// The hero is an AI proxy, so the speaking *rate* is a property of that profile's
// calling habits, not of any person. The stability half does not depend on the
// proxy: it is a property of the estimator and the two floors.
//
// **First run, 2026-09-02, Friends' Garage, 200 hands a hero, seed 1.**
//
//                          casual hero        beginner hero
//   a read was possible     64.0%              69.5%
//   it speaks               7.0% of hands      9.5% of hands
//   verdict                 92.9% "good"       94.7% "good"
//   about a fold            57.1%              63.2%
//   equity SD across seeds  1.09pts median     0.97pts median
//   speaks on some seeds    5.0% (2 of 40)     0% (0 of 15)
//   flipped verdict         0                  0
//   cost per hand           80ms median        101ms median
//                           204ms p95          205ms p95
//
// What that says. **The floors hold**: across 55 sampled hands no read reversed
// its verdict under another seed, and none spoke where a longer run says there
// was nothing to say. The measured spread sits inside the `0.5 / sqrt(n)` bound
// `tests/noiseFloors.test.ts` derives the floor from. What does move with the
// seed is *whether it speaks at all*, on about one hand in twenty.
//
// **The verdict split is not a measurement of a player and must not be quoted as
// one.** Both proxies decide with the same `estimateEquity` that grades them, so
// on any spot clear enough to clear `EDGE_FLOOR` they agree with the grader
// almost by construction. That a *worse* proxy is told it is right more often,
// not less, is the tell. technology#82 is the open version of this problem.

import { blindsAt } from '@/config/blinds'
import { KITCHEN_TABLE, RING_TABLES, SIDE_TABLES, VENUES, type Venue } from '@/config/venues'
import {
  analyseHand,
  COST_FLOOR_IN_BB,
  EDGE_FLOOR,
  heroDecision,
  ITERATIONS,
  type Scored,
} from '@/lib/coach'
import { decideAction, type AiProfile } from '@/lib/poker/ai/policy'
import { mulberry32, type Rng } from '@/lib/poker/cards'
import { applyAction, isHandComplete, legalActions, startHand } from '@/lib/poker/engine'
import type { HandEvent, HandRecord } from '@/store/game'

const HERO_ID = 'hero'

// The same proxy players `sim.ts` calibrates venue difficulty against.
const HEROES: Record<string, AiProfile> = {
  beginner: { tightness: 0.2, aggression: 0.3, bluff: 0.04, iterations: 200, skill: 0.5 },
  casual: { tightness: 0.3, aggression: 0.4, bluff: 0.06, iterations: 300, skill: 0.7 },
  competent: { tightness: 0.35, aggression: 0.5, bluff: 0.08, iterations: 400, skill: 0.85 },
  best: { tightness: 0.4, aggression: 0.55, bluff: 0.1, iterations: 600, skill: 1 },
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

/**
 * Play one hand and build the record the game store would have built.
 *
 * The decision snapshot comes from `heroDecision`, imported rather than retyped,
 * so this measures the read a player would actually have got. What is reproduced
 * here is the store's *loop* around it: which actions get an event, and that the
 * hero's hole cards are always in `reveals` whether or not there was a showdown.
 * If `recordStep` or `buildHandRecord` in `store/game.ts` change shape, this
 * copy has to follow them or the numbers below stop describing the product.
 */
function playHand(
  seats: { id: string; name: string; stack: number }[],
  buttonIndex: number,
  blinds: { smallBlind: number; bigBlind: number },
  handNo: number,
  hero: AiProfile,
  villain: AiProfile,
  rng: Rng,
): { record: HandRecord; finished: { id: string; stack: number }[] } {
  let state = startHand({ seats, buttonIndex, ...blinds, rng })
  const events: HandEvent[] = []

  let guard = 0
  while (!isHandComplete(state)) {
    if (++guard > 400) throw new Error('hand never completed')
    const prev = state
    const actor = prev.players[prev.toActIndex]
    const legal = legalActions(prev)
    const action = decideAction(prev, actor?.id === HERO_ID ? hero : villain, rng)
    if (actor) {
      events.push({
        kind: 'action',
        playerId: actor.id,
        playerName: actor.name,
        type: action.type,
        amount:
          action.type === 'call'
            ? legal?.callAmount
            : action.type === 'bet' || action.type === 'raise'
              ? action.amount
              : undefined,
        decision:
          actor.id === HERO_ID ? heroDecision(prev, HERO_ID, legal?.callAmount ?? 0) : undefined,
      })
    }
    state = applyAction(prev, action)
  }

  const showdown = state.result?.showdown === true
  const record: HandRecord = {
    handNo,
    smallBlind: blinds.smallBlind,
    bigBlind: blinds.bigBlind,
    events,
    community: state.community.slice(),
    reveals: state.players
      .filter(
        (p) =>
          p.hole.length === 2 &&
          (p.id === HERO_ID || (showdown && p.status !== 'folded' && p.status !== 'out')),
      )
      .map((p) => ({ playerId: p.id, playerName: p.name, cards: p.hole.slice() })),
    summary: '',
  }
  return { record, finished: state.players.map((p) => ({ id: p.id, stack: p.stack })) }
}

const streetOf = (n: number): string =>
  n === 0 ? 'preflop' : n === 3 ? 'flop' : n === 4 ? 'turn' : 'river'

/** The two floors in `readHand`, applied to a scored decision. */
const clears = (s: Scored, bigBlind: number): boolean =>
  Math.abs(s.equity - s.required) >= EDGE_FLOOR && Math.abs(s.margin) >= bigBlind * COST_FLOOR_IN_BB

interface Speech {
  handsDealt: number
  /** Hands carrying a priced hero decision, so a read was arithmetically possible. */
  analysable: number
  spoke: number
  good: number
  folds: number
  byStreet: Record<string, number>
  /** Wall time of one shipped read, milliseconds, one entry per analysable hand. */
  millis: number[]
}

/**
 * Sit the hero down and play until `hands` have been dealt to them.
 *
 * Counted in hands rather than tournaments because a flat-blind venue never
 * ends on its own: the kitchen table ran to the per-tournament cap every time
 * and one venue's numbers cost half an hour.
 */
function playVenue(venue: Venue, hero: AiProfile, hands: number, seed: number) {
  const speech: Speech = {
    handsDealt: 0,
    analysable: 0,
    spoke: 0,
    good: 0,
    folds: 0,
    byStreet: {},
    millis: [],
  }
  const analysable: HandRecord[] = []
  const startingStack = venue.startingStack ?? venue.buyIn

  for (let t = 0; speech.handsDealt < hands; t++) {
    const rng = mulberry32((seed + t * 2654435761) >>> 0)
    const seats = Array.from({ length: venue.seats }, (_, i) => ({
      id: i === 0 ? HERO_ID : `ai${i}`,
      name: i === 0 ? 'Hero' : `AI ${i}`,
      stack: startingStack,
    }))
    let buttonId = seats[Math.floor(rng() * seats.length)].id

    for (let handIndex = 0; handIndex < 400; handIndex++) {
      if (speech.handsDealt >= hands) break
      const live = seats.filter((s) => s.stack > 0)
      if (live.length === 1 || !live.some((s) => s.id === HERO_ID)) break
      const blinds =
        venue.escalation === false
          ? { smallBlind: venue.smallBlind, bigBlind: venue.bigBlind }
          : blindsAt(venue, handIndex)
      const { record, finished } = playHand(
        live.map((s) => ({ id: s.id, name: s.name, stack: s.stack })),
        Math.max(
          0,
          live.findIndex((s) => s.id === buttonId),
        ),
        blinds,
        handIndex + 1,
        hero,
        venue.ai,
        rng,
      )
      speech.handsDealt++
      if (speech.handsDealt % 50 === 0) {
        process.stderr.write(`\r  playing: ${speech.handsDealt}/${hands} hands `)
      }

      const started = Date.now()
      const shipped = analyseHand(record)
      if (shipped) {
        speech.millis.push(Date.now() - started)
        speech.analysable++
        analysable.push(record)
        if (clears(shipped, record.bigBlind)) {
          speech.spoke++
          if (shipped.margin > 0) speech.good++
          if (shipped.folded) speech.folds++
          const street = streetOf(shipped.decision.board.length)
          speech.byStreet[street] = (speech.byStreet[street] ?? 0) + 1
        }
      }

      for (const p of finished) {
        const seat = seats.find((s) => s.id === p.id)
        if (seat) seat.stack = p.stack
      }
      buttonId = nextButtonId(seats, buttonId)
    }
  }
  return { speech, analysable }
}

interface Stability {
  checked: number
  /** Standard deviation of the shipped estimate across seeds, in points. */
  sds: number[]
  /** Spoke, and the reference reverses the verdict. */
  flipped: number
  /** Spoke, and the reference puts the gap inside EDGE_FLOOR: nothing to say. */
  spurious: number
  /** Silent, and the reference clears the floor by half again. */
  missed: number
  /** The re-runs did not agree with each other about whether to speak at all. */
  speechUnstable: number
  /** The re-runs picked a different decision in the hand to talk about. */
  subjectChanged: number
}

/**
 * Re-run the shipped arithmetic under fresh seeds. The mean of the re-runs is
 * the reference (repeats * ITERATIONS samples of it); their spread is the noise
 * one shipped read carries. Deliberately the same estimator rather than a
 * bigger one, so the comparison isolates the sample size and nothing else.
 */
function stabilityOf(records: HandRecord[], repeats: number, seed: number): Stability {
  const out: Stability = {
    checked: 0,
    sds: [],
    flipped: 0,
    spurious: 0,
    missed: 0,
    speechUnstable: 0,
    subjectChanged: 0,
  }
  for (const [i, record] of records.entries()) {
    const shipped = analyseHand(record)
    if (!shipped) continue

    const equities: number[] = []
    let spokeInRepeats = 0
    let changed = false
    for (let r = 0; r < repeats; r++) {
      const again = analyseHand(record, {
        iterations: ITERATIONS,
        rng: mulberry32((seed + i * 2246822519 + r * 3266489917) >>> 0),
      })
      if (!again) continue
      if (clears(again, record.bigBlind)) spokeInRepeats++
      // Both runs hold the same snapshot object out of the record, so identity
      // is the honest test of "is this a read about the same moment". A hand
      // where the re-runs picked a different decision is counted and then left
      // out of the spread: two equities for two different spots have a large
      // difference that says nothing about the estimator's noise.
      if (again.decision !== shipped.decision) {
        changed = true
        continue
      }
      equities.push(again.equity)
    }
    if (changed) {
      out.checked++
      out.subjectChanged++
      if (spokeInRepeats > 0 && spokeInRepeats < repeats) out.speechUnstable++
      continue
    }
    if (equities.length < repeats) continue
    out.checked++
    if (out.checked % 10 === 0) {
      process.stderr.write(`\r  re-running: ${out.checked}/${records.length} sampled hands `)
    }

    const mean = equities.reduce((a, b) => a + b, 0) / equities.length
    const variance = equities.reduce((a, b) => a + (b - mean) ** 2, 0) / (equities.length - 1)
    out.sds.push(Math.sqrt(variance) * 100)

    // The reference decision, rebuilt from the mean equity: everything else in a
    // Scored is arithmetic on the snapshot and does not move with the seed.
    const finalPot = shipped.decision.pot + shipped.decision.toCall
    const swing = finalPot * (mean - shipped.required)
    const truth: Scored = {
      ...shipped,
      equity: mean,
      margin: shipped.folded ? -swing : swing,
    }

    const spoke = clears(shipped, record.bigBlind)
    if (spokeInRepeats > 0 && spokeInRepeats < repeats) out.speechUnstable++
    if (spoke) {
      if (Math.abs(truth.equity - truth.required) < EDGE_FLOOR) out.spurious++
      else if (truth.margin > 0 !== shipped.margin > 0) out.flipped++
    } else if (
      Math.abs(truth.equity - truth.required) >= EDGE_FLOOR * 1.5 &&
      Math.abs(truth.margin) >= record.bigBlind * COST_FLOOR_IN_BB
    ) {
      out.missed++
    }
  }
  return out
}

/** An even spread across the run, so the sample is not all early hands. */
function evenSample<T>(items: T[], want: number): T[] {
  if (items.length <= want) return items
  const step = items.length / want
  return Array.from({ length: want }, (_, i) => items[Math.floor(i * step)])
}

function parseArgs(argv: string[]) {
  const flags = new Map<string, string>()
  const names: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      flags.set(a.slice(2), argv[i + 1] ?? '')
      i++
    } else names.push(a)
  }
  return { flags, names }
}

const { flags, names } = parseArgs(process.argv.slice(2))
const pool = [KITCHEN_TABLE, ...VENUES, ...SIDE_TABLES, ...RING_TABLES]
const venues =
  names.length === 0
    ? [KITCHEN_TABLE, VENUES[0]]
    : names.flatMap((n) => {
        if (n === 'ladder') return VENUES
        const v = pool.find((x) => x.id === n)
        if (!v) {
          console.error(`Unknown venue "${n}". Ids: ${pool.map((x) => x.id).join(', ')}`)
          process.exit(1)
        }
        return [v]
      })

const heroName = flags.get('hero') ?? 'casual'
const hero = HEROES[heroName]
if (!hero) {
  console.error(`Unknown hero "${heroName}". Try: ${Object.keys(HEROES).join(', ')}`)
  process.exit(1)
}
const hands = Number(flags.get('hands') ?? 500)
const seed = Number(flags.get('seed') ?? 1)
const sample = Number(flags.get('sample') ?? 100)
const repeats = Number(flags.get('repeats') ?? 11)

const pct = (n: number, d: number) => (d === 0 ? '-' : `${((n / d) * 100).toFixed(1)}%`)
const quantile = (xs: number[], q: number) => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(s.length * q))]
}

console.log(
  `Second opinion: ${heroName} hero, ${hands} hands a venue, seed ${seed}.\n` +
    `Stability: ${sample} sampled hands re-run ${repeats}x at the shipped ${ITERATIONS} iterations.\n`,
)

for (const venue of venues) {
  const { speech, analysable } = playVenue(venue, hero, hands, seed)
  const stability = stabilityOf(evenSample(analysable, sample), repeats, seed)
  process.stderr.write('\r'.padEnd(50, ' '))
  process.stderr.write('\r')
  const streets = Object.entries(speech.byStreet)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `${s} ${pct(n, speech.spoke)}`)
    .join(', ')

  console.log(`${venue.name} (${venue.id}, ${venue.seats} seats)`)
  console.log(`  hands dealt to the hero    ${speech.handsDealt}`)
  console.log(
    `  a read was possible        ${speech.analysable} (${pct(speech.analysable, speech.handsDealt)})`,
  )
  console.log(
    `  it speaks                  ${speech.spoke} (${pct(speech.spoke, speech.handsDealt)} of hands, ` +
      `${pct(speech.spoke, speech.analysable)} of the ones it could)`,
  )
  console.log(
    `  verdict                    ${pct(speech.good, speech.spoke)} good, ` +
      `${pct(speech.folds, speech.spoke)} about a fold`,
  )
  console.log(`  street                     ${streets || '-'}`)
  console.log(
    `  cost per hand              median ${quantile(speech.millis, 0.5)}ms, ` +
      `p95 ${quantile(speech.millis, 0.95)}ms`,
  )
  console.log(`  stability sample           ${stability.checked} hands`)
  console.log(
    `  equity SD across seeds     median ${quantile(stability.sds, 0.5).toFixed(2)}pts, ` +
      `p95 ${quantile(stability.sds, 0.95).toFixed(2)}pts`,
  )
  console.log(
    `  speaks on some seeds only  ${stability.speechUnstable} (${pct(stability.speechUnstable, stability.checked)})`,
  )
  console.log(`  flipped verdict            ${stability.flipped}`)
  console.log(`  spurious (nothing to say)  ${stability.spurious}`)
  console.log(`  missed (should have said)  ${stability.missed}`)
  console.log(`  talked about another spot  ${stability.subjectChanged}`)
  console.log('')
}
