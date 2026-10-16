// How long one AI decision takes, by version and venue, preflop and after.
//
//   pnpm ai-bench                                   # v1, fast, wrange at the Main Event
//   pnpm ai-bench --ai wrange,fast --venue garage --hands 200
//
// Every version plays the same six-handed hands from the same seed with a table
// memory, as the game does, at the venue's full simulation count. The numbers
// are wall-clock on whatever runs it, so compare versions within one run.

import { venueById } from '@/config/venues'
import { createTableMemory, observeAction, observeHandEnd } from '@/lib/poker/ai/memory'
import { mulberry32 } from '@/lib/poker/cards'
import { applyAction, isHandComplete, startHand } from '@/lib/poker/engine'
import { POLICIES, versionProfile } from './ai-versions'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const venueId = arg('venue', 'mainevent')
const venue = venueById(venueId)
if (!venue) throw new Error(`unknown venue "${venueId}"`)
// The hands below are Hold'em, so another game's venue would be timed at the wrong game.
if ((venue.variant ?? 'holdem') !== 'holdem') {
  throw new Error(`${venue.name} is not Hold'em; ai-bench times Hold'em venues only`)
}
const hands = Number(arg('hands', '60'))
const seats = Math.min(venue.seats, 6)
const versions = arg('ai', 'v1,fast,wrange').split(',')

for (const name of versions) {
  const profile = versionProfile(name, venue.ai)
  const decide = POLICIES[name].decide
  const memory = createTableMemory()
  const times = { preflop: [] as number[], postflop: [] as number[] }
  for (let h = 0; h < hands; h++) {
    const rng = mulberry32(h + 1)
    let s = startHand({
      seats: Array.from({ length: seats }, (_, i) => ({ id: `p${i}`, name: `p${i}`, stack: 200 })),
      buttonIndex: h % seats,
      smallBlind: 1,
      bigBlind: 2,
      rng,
    })
    while (!isHandComplete(s)) {
      const t0 = performance.now()
      const action = decide(s, profile, rng, memory)
      const dt = performance.now() - t0
      times[s.street === 'preflop' ? 'preflop' : 'postflop'].push(dt)
      observeAction(memory, s, action)
      s = applyAction(s, action)
    }
    observeHandEnd(memory, s)
  }
  const summary = (xs: number[]) => {
    const sorted = [...xs].sort((a, b) => a - b)
    const mean = xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1)
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
    return `${mean.toFixed(2)} ms mean, ${p95.toFixed(2)} ms p95 (${xs.length})`
  }
  console.log(
    `${name.padEnd(8)} ${venue.name} · ${profile.iterations} sims · preflop ${summary(times.preflop)} · postflop ${summary(times.postflop)}`,
  )
}
