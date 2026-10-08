// How the bots play, as the stats a player tracker would show: what share of
// hands they enter and raise, how often they re-raise, defend the big blind,
// bet the flop after raising, fold to that bet, fire again on the turn, and so
// on. Bot against bot, six-handed, every seat on the venue's profile, at a
// fixed stack depth reset every hand.
//
//   pnpm ai-stats                          # garage, cardroom, mainevent
//   pnpm ai-stats mainevent penthouse      # venue ids
//   pnpm ai-stats --hands 4000 --iters 300 # sample size, and a cap on sims per decision
//   pnpm ai-stats --bb 20                  # stack depth in big blinds (default 100)
//
// Reference ranges for a solid six-handed regular are printed beside each
// stat. They are rough and widely quoted, not a target: a soft table should
// sit well outside them, and the top of the ladder near them.

import { decideAction, type AiProfile } from '@/lib/poker/ai/policy'
import { createTableMemory, observeAction } from '@/lib/poker/ai/memory'
import { mulberry32 } from '@/lib/poker/cards'
import {
  type Action,
  applyAction,
  type HandState,
  isHandComplete,
  startHand,
} from '@/lib/poker/engine'
import { venueById } from '@/config/venues'

interface Counter {
  hits: number
  chances: number
}
const c = (): Counter => ({ hits: 0, chances: 0 })

const STATS = {
  vpip: c(),
  pfr: c(),
  threeBet: c(),
  bbFoldToSteal: c(),
  cbetFlop: c(),
  foldToCbet: c(),
  barrelTurn: c(),
  checkRaiseFlop: c(),
  wtsd: c(),
  postflopAggression: c(),
}
type StatKey = keyof typeof STATS

const REFERENCE: Record<StatKey, string> = {
  vpip: '22-28%',
  pfr: '17-23%',
  threeBet: '6-10%',
  bbFoldToSteal: '30-45%',
  cbetFlop: '55-70%',
  foldToCbet: '40-55%',
  barrelTurn: '45-60%',
  checkRaiseFlop: '6-12%',
  wtsd: '25-30%',
  postflopAggression: '35-45%',
}

const LABEL: Record<StatKey, string> = {
  vpip: 'enters the pot (VPIP)',
  pfr: 'raises preflop (PFR)',
  threeBet: 're-raises an open (3-bet)',
  bbFoldToSteal: 'big blind folds to a steal',
  cbetFlop: 'raiser bets the flop (c-bet)',
  foldToCbet: 'folds to a c-bet',
  barrelTurn: 'bets the turn again',
  checkRaiseFlop: 'check-raises the flop',
  wtsd: 'sees showdown (of flops seen)',
  postflopAggression: 'bets/raises per postflop action',
}

function bump(key: StatKey, hit: boolean) {
  STATS[key].chances++
  if (hit) STATS[key].hits++
}

const aggressive = (a: Action) => a.type === 'bet' || a.type === 'raise'

function playHand(
  state: HandState,
  profile: AiProfile,
  rng: () => number,
  memory = createTableMemory(),
) {
  const n = state.players.length
  const vpip = new Set<string>()
  const pfr = new Set<string>()
  let preflopRaises = 0
  let preflopAggressor: string | null = null
  // Street-level trackers.
  let street = state.street
  let streetBets = 0
  let flopCbetBy: string | null = null
  const flopCbetCalledBy = new Set<string>()
  const flopCheckedBy = new Set<string>()
  const sawFlop = new Set<string>()
  // Steal spot: one open, everybody else folded, the big blind to act.
  const bbIndex = (state.buttonIndex + (n === 2 ? 1 : 2)) % n
  const bbId = state.players[bbIndex].id

  while (!isHandComplete(state)) {
    if (state.street !== street) {
      street = state.street
      streetBets = 0
      if (street === 'flop') {
        for (const p of state.players)
          if (p.status !== 'folded' && p.status !== 'out') sawFlop.add(p.id)
      }
    }
    const me = state.players[state.toActIndex]
    const action = decideAction(state, profile, rng, memory)
    const facing = state.currentBet > me.committedThisStreet

    if (state.street === 'preflop') {
      if (action.type === 'call' || aggressive(action)) vpip.add(me.id)
      if (aggressive(action)) pfr.add(me.id)
      // A 3-bet chance: facing exactly one raise.
      if (preflopRaises === 1 && facing) bump('threeBet', aggressive(action))
      if (me.id === bbId && preflopRaises === 1 && facing) {
        const others = state.players.filter((p) => p.id !== me.id && p.id !== preflopAggressor)
        const nobodyIn = others.every((p) => p.status === 'folded')
        if (nobodyIn) bump('bbFoldToSteal', action.type === 'fold')
      }
      if (aggressive(action)) {
        preflopRaises++
        preflopAggressor = me.id
      }
    } else {
      bump('postflopAggression', aggressive(action))
      if (state.street === 'flop') {
        if (me.id === preflopAggressor && streetBets === 0) bump('cbetFlop', aggressive(action))
        if (flopCbetBy && streetBets === 1 && facing && me.id !== flopCbetBy) {
          bump('foldToCbet', action.type === 'fold')
          if (action.type === 'call') flopCbetCalledBy.add(me.id)
          if (flopCheckedBy.has(me.id)) bump('checkRaiseFlop', aggressive(action))
        }
        if (me.id === preflopAggressor && streetBets === 0 && aggressive(action)) flopCbetBy = me.id
        if (action.type === 'check') flopCheckedBy.add(me.id)
      }
      if (
        state.street === 'turn' &&
        flopCbetBy === me.id &&
        streetBets === 0 &&
        flopCbetCalledBy.size > 0
      ) {
        bump('barrelTurn', aggressive(action))
      }
      if (aggressive(action)) streetBets++
    }
    observeAction(memory, state, action)
    state = applyAction(state, action)
  }
  for (const p of state.players) {
    if (p.status === 'out') continue
    bump('vpip', vpip.has(p.id))
    bump('pfr', pfr.has(p.id))
  }
  for (const id of sawFlop) {
    bump(
      'wtsd',
      !!state.result?.showdown && state.players.find((p) => p.id === id)!.status !== 'folded',
    )
  }
}

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const flagged = new Set(
  ['--hands', '--iters', '--bb', '--seed'].flatMap((f) => {
    const i = args.indexOf(f)
    return i >= 0 ? [i, i + 1] : []
  }),
)
const venues = args.filter((_, i) => !flagged.has(i))
const ids = venues.length ? venues : ['garage', 'cardroom', 'mainevent']
const hands = Number(flag('hands') ?? 3000)
const iters = Number(flag('iters') ?? 300)
const depth = Number(flag('bb') ?? 100)
const seed = Number(flag('seed') ?? 1)

const columns: string[][] = []
for (const id of ids) {
  const venue = venueById(id)
  if (!venue) throw new Error(`unknown venue ${id}`)
  for (const k of Object.keys(STATS) as StatKey[]) STATS[k] = c()
  const profile = { ...venue.ai, iterations: Math.min(venue.ai.iterations, iters) }
  const rng = mulberry32(seed)
  const memory = createTableMemory()
  for (let h = 0; h < hands; h++) {
    const state = startHand({
      seats: Array.from({ length: 6 }, (_, i) => ({
        id: `s${i}`,
        name: `s${i}`,
        stack: depth * 2,
      })),
      buttonIndex: h % 6,
      smallBlind: 1,
      bigBlind: 2,
      rng,
    })
    playHand(state, profile, rng, memory)
  }
  columns.push(
    (Object.keys(STATS) as StatKey[]).map((k) => {
      const s = STATS[k]
      return s.chances ? `${((100 * s.hits) / s.chances).toFixed(0)}% (${s.chances})` : '-'
    }),
  )
}

console.log(
  `${hands} hands a venue · 6-handed · ${depth}bb · sims capped at ${iters} · seed ${seed}\n`,
)
console.log(
  `  ${''.padEnd(32)}${ids.map((id) => id.padStart(16)).join('')}${'reference'.padStart(12)}`,
)
;(Object.keys(STATS) as StatKey[]).forEach((k, row) => {
  console.log(
    `  ${LABEL[k].padEnd(32)}${columns.map((col) => col[row].padStart(16)).join('')}${REFERENCE[k].padStart(12)}`,
  )
})
