// Where the Pip Rating's scale comes from (docs/rating.md).
//
//   pnpm rating-calibrate                   # garage + rail, every proxy, 600 hands each
//   pnpm rating-calibrate --hands 1500      # hands dealt to each hero per venue
//   pnpm rating-calibrate --seed 7          # deterministic; same seed = same result
//
// Seats a proxy hero at real venues against that venue's own AI, plays hands
// back to back, prices every hero call and fold exactly as the game store does
// (`scoreDecisions` then `gradeDecision`), turns each into a loss with
// `ratedLoss`, and prints the mean loss per rated decision and the rating the
// shipped scale gives it.
//
// The proxies decide with the same equity estimate that grades them, so even
// the "beginner" agrees with the grader more often than a person new to the
// game would (scripts/coach-sim.ts says the same about the read). That is why
// three hand-written players sit beside them: one who calls whatever it is
// charged, one who folds whenever there is a price, and one who flips a coin.
// They are the floor of the scale, and the proxies are its middle.

import { blindsAt } from '@/config/blinds'
import { RING_TABLES, VENUES, type Venue } from '@/config/venues'
import { heroDecision, scoreDecisions } from '@/lib/coach'
import { decideAction, type AiProfile } from '@/lib/poker/ai/policy'
import {
  type Action,
  applyAction,
  isHandComplete,
  legalActions,
  startHand,
} from '@/lib/poker/engine'
import { mulberry32, type Rng } from '@/lib/poker/cards'
import type { HandState } from '@/lib/poker/engine'
import { gradeDecision, isGraded } from '@/lib/review/grade'
import { applyDecision, emptyCore, ratingFromLoss, rawRatingOf } from '@/lib/rating'
import { ratedDecisionsOf } from '@/lib/rating/hand'
import type { HandEvent, HandRecord } from '@/store/game'

const HERO_ID = 'hero'

type Hero = (state: HandState, rng: Rng) => Action

const proxy =
  (profile: AiProfile): Hero =>
  (state, rng) =>
    decideAction(state, profile, rng)

/** Pays whatever it is charged and never raises. */
const station: Hero = (state) => {
  const legal = legalActions(state)
  if (!legal) return { type: 'fold' }
  return legal.canCheck ? { type: 'check' } : { type: 'call' }
}

/** Folds whenever it is charged anything. */
const folder: Hero = (state) => {
  const legal = legalActions(state)
  return legal?.canCheck ? { type: 'check' } : { type: 'fold' }
}

/** Calls or folds on a coin flip. */
const coin: Hero = (state, rng) => {
  const legal = legalActions(state)
  if (!legal) return { type: 'fold' }
  if (legal.canCheck) return { type: 'check' }
  return rng() < 0.5 ? { type: 'call' } : { type: 'fold' }
}

// The proxy players `sim.ts` and `coach-sim.ts` calibrate against.
const HEROES: Record<string, Hero> = {
  'calls everything': station,
  'folds to any bet': folder,
  'coin flip': coin,
  beginner: proxy({ tightness: 0.2, aggression: 0.3, bluff: 0.04, iterations: 200, skill: 0.5 }),
  casual: proxy({ tightness: 0.3, aggression: 0.4, bluff: 0.06, iterations: 300, skill: 0.7 }),
  competent: proxy({
    tightness: 0.35,
    aggression: 0.5,
    bluff: 0.08,
    iterations: 400,
    skill: 0.85,
  }),
  best: proxy({ tightness: 0.4, aggression: 0.55, bluff: 0.1, iterations: 600, skill: 1 }),
}

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? Number(process.argv[i + 1]) : fallback
}

function playHand(
  seats: { id: string; name: string; stack: number }[],
  buttonIndex: number,
  blinds: { smallBlind: number; bigBlind: number },
  handNo: number,
  hero: Hero,
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
    const action = actor?.id === HERO_ID ? hero(prev, rng) : decideAction(prev, villain, rng)
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
  const record: HandRecord = {
    handNo,
    smallBlind: blinds.smallBlind,
    bigBlind: blinds.bigBlind,
    events,
    community: state.community.slice(),
    reveals: state.players
      .filter((p) => p.id === HERO_ID)
      .map((p) => ({ playerId: p.id, playerName: p.name, cards: p.hole.slice() })),
    summary: '',
  }
  return { record, finished: state.players.map((p) => ({ id: p.id, stack: p.stack })) }
}

function measure(venue: Venue, hero: Hero, hands: number, seed: number) {
  const losses: number[] = []
  let potBb = 0
  let core = emptyCore()
  let dealt = 0
  const startingStack = venue.startingStack ?? venue.buyIn
  for (let t = 0; dealt < hands; t++) {
    const rng = mulberry32((seed + t * 2654435761) >>> 0)
    const seats = Array.from({ length: venue.seats }, (_, i) => ({
      id: i === 0 ? HERO_ID : `ai${i}`,
      name: i === 0 ? 'Hero' : `AI ${i}`,
      stack: startingStack,
    }))
    let button = Math.floor(rng() * seats.length)
    for (let h = 0; h < 400 && dealt < hands; h++) {
      const live = seats.filter((s) => s.stack > 0)
      if (live.length === 1 || !live.some((s) => s.id === HERO_ID)) break
      const blinds =
        venue.escalation === false
          ? { smallBlind: venue.smallBlind, bigBlind: venue.bigBlind }
          : blindsAt(venue, h)
      const { record, finished } = playHand(
        live.map((s) => ({ ...s })),
        button % live.length,
        blinds,
        h + 1,
        hero,
        venue.ai,
        rng,
      )
      dealt++
      const graded = scoreDecisions(record, { max: 8 })
        .filter(isGraded)
        .map((s) => gradeDecision(s, record.bigBlind))
      for (const d of ratedDecisionsOf(record, graded)) {
        losses.push(d.loss)
        potBb += d.stake
        core = applyDecision(core, d.kind, d.loss, d.stake)
      }
      for (const p of finished) {
        const seat = seats.find((s) => s.id === p.id)
        if (seat) seat.stack = p.stack
      }
      button++
    }
  }
  const mean = losses.reduce((a, b) => a + b, 0) / Math.max(1, losses.length)
  const total = losses.reduce((a, b) => a + b, 0)
  return {
    decisions: losses.length,
    mean,
    perHand: total / Math.max(1, dealt),
    perPot: total / Math.max(1, potBb),
    // The play's own number: the experience cap is about time, not skill.
    ewRating: rawRatingOf(core),
  }
}

const hands = arg('hands', 600)
const seed = arg('seed', 1)
const only = process.argv.includes('--hero')
  ? process.argv[process.argv.indexOf('--hero') + 1]
  : null
const venueIds = process.argv.includes('--venue')
  ? process.argv[process.argv.indexOf('--venue') + 1].split(',')
  : ['garage', 'pub', RING_TABLES[0].id]
const venues = [...VENUES, ...RING_TABLES].filter((v) => venueIds.includes(v.id))

// The ladder's own regulars, seated as the hero: where each venue's AI lands
// on the scale is what the band names are pinned to.
for (const v of VENUES) HEROES[`ai:${v.id}`] = proxy(v.ai)

for (const venue of venues) {
  for (const [name, hero] of Object.entries(HEROES)) {
    if (only && name !== only) continue
    const r = measure(venue, hero, hands, seed)
    console.log(
      [
        venue.id,
        name,
        r.decisions,
        r.mean.toFixed(4),
        r.perHand.toFixed(4),
        r.perPot.toFixed(4),
        ratingFromLoss(r.perPot),
        r.ewRating,
      ].join('\t'),
    )
  }
}
