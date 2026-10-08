// How accurate the player's win % is. At every postflop decision in bot-vs-bot
// hands, compares the estimate against the true equity versus the opponents'
// actual hole cards, split by whether the decision faces a bet.
//
//   pnpm win-read                 # The Main Event, 600 spots
//   pnpm win-read garage 400      # another venue, spot count
//   pnpm win-read omaha-room 400  # a venue's own variant is used
//
// "player read" is `opponentSelectivity`, which the win % and the coach use;
// "bot read" is `aiSelectivity`, which the bots play off; "random" is raw
// equity against two random cards. Bias is estimate minus truth: negative means
// the read makes hands look worse than they are.
import { aiSelectivity, decideAction, opponentSelectivity } from '@/lib/poker/ai/policy'
import { createTableMemory, observeAction } from '@/lib/poker/ai/memory'
import { mulberry32, RANKS, SUITS, type Card } from '@/lib/poker/cards'
import { applyAction, isHandComplete, startHand, type HandState } from '@/lib/poker/engine'
import { estimateEquity } from '@/lib/poker/equity'
import { determineWinners } from '@/lib/poker/handEval'
import { venueById } from '@/config/venues'

const venue = venueById(process.argv[2] ?? 'mainevent')!
const ai = { ...venue.ai, iterations: 300 }
const rng = mulberry32(3)
const key = (c: Card) => c.rank + c.suit

function trueEquity(s: HandState, meId: string): number {
  const me = s.players.find((p) => p.id === meId)!
  const opps = s.players.filter((p) => p.id !== meId && p.status !== 'folded' && p.status !== 'out')
  const known = new Set([...me.hole, ...s.community, ...opps.flatMap((o) => o.hole)].map(key))
  const deck: Card[] = []
  for (const r of RANKS)
    for (const su of SUITS) if (!known.has(r + su)) deck.push({ rank: r, suit: su })
  const need = 5 - s.community.length
  let share = 0
  const N = 300
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(rng() * (deck.length - k))
      ;[deck[k], deck[j]] = [deck[j], deck[k]]
    }
    const board = [...s.community, ...deck.slice(0, need)]
    const w = determineWinners(
      [{ id: meId, hole: me.hole }, ...opps.map((o) => ({ id: o.id, hole: o.hole }))],
      board,
      s.variant,
    ).winners
    if (w.includes(meId)) share += 1 / w.length
  }
  return share / N
}

const rows = { facing: [] as number[][], unbet: [] as number[][] }
const memory = createTableMemory()
let spots = 0
for (let h = 0; spots < Number(process.argv[3] ?? 600); h++) {
  let s = startHand({
    variant: venue.variant,
    seats: Array.from({ length: 6 }, (_, i) => ({ id: 's' + i, name: 'x', stack: 200 })),
    buttonIndex: h % 6,
    smallBlind: 1,
    bigBlind: 2,
    rng,
  })
  while (!isHandComplete(s)) {
    const me = s.players[s.toActIndex]
    if (s.street !== 'preflop') {
      const opps = s.players.filter(
        (p) => p.id !== me.id && p.status !== 'folded' && p.status !== 'out',
      )
      const facing = s.currentBet > me.committedThisStreet
      const est = (sel: number[]) =>
        estimateEquity({
          hole: me.hole,
          community: s.community,
          opponents: opps.length,
          opponentSelectivity: sel,
          iterations: 600,
          rng,
          variant: s.variant,
        }).equity
      const t = trueEquity(s, me.id)
      const old = est(opps.map((o) => opponentSelectivity(s, o)))
      const neu = est(opps.map((o) => aiSelectivity(s, o)))
      const raw = est(opps.map(() => 0))
      ;(facing ? rows.facing : rows.unbet).push([t, old, neu, raw])
      spots++
    }
    const a = decideAction(s, ai, rng, memory)
    observeAction(memory, s, a)
    s = applyAction(s, a)
  }
}
for (const [name, r] of Object.entries(rows)) {
  const m = (i: number) => r.reduce((a, x) => a + (x[i] - x[0]), 0) / r.length
  const mae = (i: number) => r.reduce((a, x) => a + Math.abs(x[i] - x[0]), 0) / r.length
  const truth = r.reduce((a, x) => a + x[0], 0) / r.length
  console.log(`${name} (${r.length} spots) true mean ${truth.toFixed(3)}`)
  for (const [i, label] of [
    [1, 'player read'],
    [2, 'bot read'],
    [3, 'random'],
  ] as const)
    console.log(
      `  ${label.padEnd(14)} bias ${m(i) >= 0 ? '+' : ''}${m(i).toFixed(3)}  mean abs err ${mae(i).toFixed(3)}`,
    )
}
