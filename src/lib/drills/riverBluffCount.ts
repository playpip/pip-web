import { RIVER_FRACTIONS, type RiverPrice, dealRiver, generateRiverCall } from './callingTheRiver'

// How often the right answer to a river bet depends on who is betting.
//
// For /blog/calling-a-river-bet. Deals the Calling the river pack's own spots
// (`dealRiver`, the same deal and prices the pack grades) and, at every bet
// size, asks one thing: is the call right, or wrong, at both ends of the
// bluffing band (the Garage's rate and the Main Event's, BLUFF_WEIGHTS)? Or
// does the answer change between them? The pack only ever asks the first two
// kinds. This counts how much of the river it has to leave out to do that.
//
// The equities are counts over a model of what bets (./riverRange), not over
// hands people played. The post says so.

export interface BetRow {
  /** The bet as a fraction of the pot before it, as the post prints it. */
  label: string
  fraction: number
  /** What the call costs as a share of the pot after it: bet / (pot + 2 bets). */
  price: number
  /** Right to call however often they bluff, within the band. */
  call: number
  /** Right to fold however often they bluff. */
  fold: number
  /** Right against one end of the band and wrong against the other. */
  depends: number
}

export interface RiverBluffCount {
  shuffles: number
  /** Shuffles that give you a hand of your own on the river, a pair or better. */
  hands: number
  rows: BetRow[]
  /** Every distinct bet across every hand (two sizes can round to the same chips on a small pot). */
  decisions: { total: number; depends: number }
  /** Shuffles the pack turns into a question. */
  asked: number
}

/** 0.4 -> "2/5", 1 -> "1": every size in RIVER_FRACTIONS has a denominator of five or less. */
function fractionLabel(fraction: number): string {
  for (let bottom = 1; bottom <= 5; bottom++) {
    const top = Math.round(fraction * bottom)
    if (Math.abs(top / bottom - fraction) < 1e-9)
      return bottom === 1 ? `${top}` : `${top}/${bottom}`
  }
  throw new Error(`no short label for ${fraction}`)
}

function sideOf(price: RiverPrice): 'call' | 'fold' | 'depends' {
  const low = price.low.equity - price.required
  const high = price.high.equity - price.required
  if (low > 0 && high > 0) return 'call'
  if (low < 0 && high < 0) return 'fold'
  return 'depends'
}

/** Seeds 1 to `shuffles`, the pack's own. */
export function riverBluffCount(shuffles: number): RiverBluffCount {
  let hands = 0
  let asked = 0
  const decisions = { total: 0, depends: 0 }
  const rows: BetRow[] = RIVER_FRACTIONS.map((fraction) => ({
    label: fractionLabel(fraction),
    fraction,
    price: fraction / (1 + 2 * fraction),
    call: 0,
    fold: 0,
    depends: 0,
  }))
  for (let seed = 1; seed <= shuffles; seed++) {
    if (generateRiverCall(seed).drill) asked++
    const dealt = dealRiver(seed)
    if ('rejected' in dealt) continue
    hands++
    const seen = new Set<number>()
    dealt.prices.forEach((price, i) => {
      const side = sideOf(price)
      rows[i][side]++
      if (seen.has(price.toCall)) return
      seen.add(price.toCall)
      decisions.total++
      if (side === 'depends') decisions.depends++
    })
  }
  return { shuffles, hands, rows, decisions, asked }
}
