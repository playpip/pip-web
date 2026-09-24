import type { SeatId } from '@/config/positions'
import { type Card, RANKS, type Rank, SUITS } from '@/lib/poker/cards'
import { MATRIX, NASH, TRIALS } from './shoveChart'

// What a short-stacked shove is worth, as arithmetic you can check.
//
// **The question.** It folds to you in a tournament with a short stack. You can
// put it all in or let the hand go, and nothing in between is on offer: with
// fifteen big blinds or fewer a raise that is not all-in commits most of your
// stack anyway, so the grown-up version of the decision is exactly this one.
//
// **The answer key is one line of expected value**, measured against folding
// (which is worth nothing from here, whatever you have already posted):
//
//     EV(shove) = P(everybody folds) × 1.5
//               + Σ over the players behind, in turn order:
//                   P(it reaches them and they call)
//                     × (your equity against their calling hands × the final pot
//                        − the chips you add by shoving)
//
// 1.5 is the blinds: winning them is +1.5 big blinds on folding, whichever seat
// you are in, because a small blind that folds loses the half it posted. The
// final pot is both stacks plus any blind that folded. Every term is a count or
// a fraction except one: **your equity against a range, which comes from the
// chart below.**
//
// **The chart (./shoveChart, written by `pnpm shove-chart`).** Every starting
// hand against every other, 169 × 169, each cell the first hand's share of the
// pot all-in before the flop, over TRIALS random boards. That is the one
// sampled number here, so it carries a band: a share of a pot has a variance of
// at most a quarter, so one cell's standard error is at most `0.5 / √TRIALS`,
// and a range averages many cells. {@link shoveEv} carries that band through to
// big blinds, and the pack only asks spots that are clear of it. Card removal is
// exact rather than sampled: how many ways a caller can hold each hand, given
// your two cards, is counted.
//
// **Who calls, and why it is Nash.** The one thing the arithmetic cannot know is
// which hands the players behind call with. Pick a number and the answer key is
// that number. So the model is the standard answer for short-stack all-ins, the
// Nash equilibrium of this exact game: a shover who cannot be exploited against
// callers who cannot be exploited, solved by fictitious play (see
// {@link solveNash}) for every seat and every stack from three to fifteen big
// blinds, and stored as the ranges in the chart. Heads-up Nash charts are the
// usual reference; this is the same idea at a six-handed table, under the three
// simplifications stated where they bite:
//
// 1. **Everybody behind covers you.** You are the short stack, so a call is
//    for all of yours and nobody else's stack matters.
// 2. **Once somebody calls, the rest fold.** Overcalls are rare with ranges this
//    tight and are left out; a call is you against one hand.
// 3. **The players behind are independent.** What one of them holds does not
//    change what the next can hold (your two cards do, and are counted).
//
// No antes: the tables in this app do not have them, and an ante would make
// every shove here better than the chart says.
//
// **And Nash is not the whole of it.** Real players call wider or tighter than
// an equilibrium. So every spot is also priced against callers who call with a
// fifth fewer hands and a quarter more ({@link CALLER_SPREAD}), taking the hands
// that do best against your shoving range first, and the pack only asks a spot
// whose answer is the same against all three and clear of the margin against
// each. That is the river pack's rule — the answer may not depend on who is
// sitting there — applied to the only unknown this spot has.

/** The seats a shove can come from. The big blind is never folded to: that is a walk. */
export const SHOVE_SEATS = ['utg', 'mp', 'co', 'btn', 'sb'] as const satisfies readonly SeatId[]
export type ShoveSeat = (typeof SHOVE_SEATS)[number]

/** Stacks the chart is solved for, in big blinds. */
export const MIN_STACK = 3
export const MAX_STACK = 15
export const STACKS: readonly number[] = Array.from(
  { length: MAX_STACK - MIN_STACK + 1 },
  (_, i) => MIN_STACK + i,
)

/** The blinds, in big blinds. Folding it to you and everybody folding wins both. */
export const BLINDS = 1.5

/** A seat and a stack: one position the chart is solved for. */
export interface Spot {
  seat: ShoveSeat
  /** Your stack before the blinds, in big blinds. Everybody behind covers it. */
  stack: number
}

/**
 * How much tighter and looser than Nash the callers are also priced at: a
 * fifth fewer hands, and a quarter more (the same factor each way). A spot is
 * only asked when shove-or-fold comes out the same at both ends and at Nash.
 *
 * **A third each way was tried first and was too wide to teach anything**:
 * against callers a third tighter than Nash, fold equity alone makes almost
 * any two cards a shove at almost any stack, so the only folds left were three
 * big blinds under the gun. A fifth still moves the answer on hands near the
 * line, which is what it is for.
 */
export const CALLER_SPREAD = { tight: 4 / 5, loose: 5 / 4 } as const

/** The players behind a seat, in the order they act. */
export function behind(seat: ShoveSeat): SeatId[] {
  const order: SeatId[] = ['utg', 'mp', 'co', 'btn', 'sb', 'bb']
  return order.slice(order.indexOf(seat) + 1)
}

/** What a seat has already put in before the action reaches it. */
export const posted = (seat: SeatId): number => (seat === 'sb' ? 0.5 : seat === 'bb' ? 1 : 0)

// ---------------------------------------------------------------------------
// The 169 starting hands.
// ---------------------------------------------------------------------------

/** One of the 169 starting hands, and every way to hold it. */
export interface HandClass {
  /** "AKs", "T9o", "77": the chart's own names. */
  key: string
  pair: boolean
  suited: boolean
  /** Every two-card combination of this hand: 6 for a pair, 4 suited, 12 offsuit. */
  combos: [Card, Card][]
}

const DESC: readonly Rank[] = [...RANKS].reverse()

/**
 * The 169, in a fixed order: aces first, and within a high card, the pair, then
 * each lower card suited and offsuit. The chart is indexed in this order, so it
 * may never change without regenerating the chart.
 */
export const CLASSES: readonly HandClass[] = (() => {
  const out: HandClass[] = []
  for (let i = 0; i < DESC.length; i++) {
    const hi = DESC[i]
    const pairCombos: [Card, Card][] = []
    for (let a = 0; a < 4; a++) {
      for (let b = a + 1; b < 4; b++) {
        pairCombos.push([
          { rank: hi, suit: SUITS[a] },
          { rank: hi, suit: SUITS[b] },
        ])
      }
    }
    out.push({ key: `${hi}${hi}`, pair: true, suited: false, combos: pairCombos })
    for (let j = i + 1; j < DESC.length; j++) {
      const lo = DESC[j]
      const suited: [Card, Card][] = SUITS.map((suit) => [
        { rank: hi, suit },
        { rank: lo, suit },
      ])
      const offsuit: [Card, Card][] = []
      for (const s1 of SUITS) {
        for (const s2 of SUITS) {
          if (s1 !== s2) {
            offsuit.push([
              { rank: hi, suit: s1 },
              { rank: lo, suit: s2 },
            ])
          }
        }
      }
      out.push({ key: `${hi}${lo}s`, pair: false, suited: true, combos: suited })
      out.push({ key: `${hi}${lo}o`, pair: false, suited: false, combos: offsuit })
    }
  }
  return out
})()

export const CLASS_COUNT = CLASSES.length

const INDEX_BY_KEY = new Map(CLASSES.map((c, i) => [c.key, i]))

/** The class of two cards, as an index into {@link CLASSES}. */
export function classOf(cards: readonly Card[]): number {
  const [a, b] = [...cards].sort((x, y) => RANKS.indexOf(y.rank) - RANKS.indexOf(x.rank))
  const key =
    a.rank === b.rank ? `${a.rank}${b.rank}` : `${a.rank}${b.rank}${a.suit === b.suit ? 's' : 'o'}`
  const index = INDEX_BY_KEY.get(key)
  if (index === undefined) throw new Error(`No hand class for ${key}`)
  return index
}

/** The class's index, by name. */
export function classIndex(key: string): number {
  const index = INDEX_BY_KEY.get(key)
  if (index === undefined) throw new Error(`No hand class "${key}"`)
  return index
}

const same = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit

/** Two-card hands left for somebody else once you hold two: 50 choose 2. */
export const UNSEEN_COMBOS = 1_225

let compatCache: Uint8Array | null = null

/**
 * How many ways another player can hold class `c` when you hold class `h`.
 *
 * Counted against one combination of `h`, which is exact rather than typical:
 * every combination of a class blocks the same number of every other class,
 * because the suits are interchangeable.
 */
export function compat(h: number, c: number): number {
  if (!compatCache) {
    const cache = new Uint8Array(CLASS_COUNT * CLASS_COUNT)
    for (let i = 0; i < CLASS_COUNT; i++) {
      const [x, y] = CLASSES[i].combos[0]
      for (let j = 0; j < CLASS_COUNT; j++) {
        cache[i * CLASS_COUNT + j] = CLASSES[j].combos.filter(
          ([p, q]) => !same(p, x) && !same(p, y) && !same(q, x) && !same(q, y),
        ).length
      }
    }
    compatCache = cache
  }
  return compatCache[h * CLASS_COUNT + c]
}

// ---------------------------------------------------------------------------
// The chart, decoded.
// ---------------------------------------------------------------------------

/** Each cell is stored as a whole number of 4,095ths: two base-64 characters. */
export const CELL_STEPS = 4_095

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** A cell's value as two characters. Exported for the script that writes the chart. */
export function encodeCell(value: number): string {
  const n = Math.round(Math.min(1, Math.max(0, value)) * CELL_STEPS)
  return B64[n >> 6] + B64[n & 63]
}

const decodeCell = (text: string, at: number) =>
  ((B64.indexOf(text[at]) << 6) | B64.indexOf(text[at + 1])) / CELL_STEPS

/** A 169 × 169 table of all-in equities: `get(h, c)` is h's share against c. */
export interface Equities {
  get(h: number, c: number): number
}

/**
 * Read an upper-triangle string into a full table. The diagonal is a half by
 * symmetry, and the lower triangle is one minus its mirror, which is exact: the
 * two cells average the same deals from opposite sides of the table.
 */
export function decodeMatrix(text: string): Equities {
  const cells = new Float64Array(CLASS_COUNT * CLASS_COUNT)
  let at = 0
  for (let i = 0; i < CLASS_COUNT; i++) {
    cells[i * CLASS_COUNT + i] = 0.5
    for (let j = i + 1; j < CLASS_COUNT; j++) {
      const v = decodeCell(text, at)
      at += 2
      cells[i * CLASS_COUNT + j] = v
      cells[j * CLASS_COUNT + i] = 1 - v
    }
  }
  if (at !== text.length) throw new Error('The shove chart is the wrong length for 169 hands')
  return { get: (h, c) => cells[h * CLASS_COUNT + c] }
}

let chartCache: Equities | null = null

/** The shipped chart. Decoded once, on first use. */
export function chart(): Equities {
  chartCache ??= decodeMatrix(MATRIX)
  return chartCache
}

/**
 * The most one cell can be out by at 95%, in shares of a pot: the sampling
 * bound plus the rounding the storage does.
 */
export const CELL_BAND = 1.96 * (0.5 / Math.sqrt(TRIALS))
const ROUNDING = 0.5 / CELL_STEPS

// ---------------------------------------------------------------------------
// Ranges.
// ---------------------------------------------------------------------------

/** A weight in [0, 1] for each of the 169 hands: how often this hand is in the range. */
export type Range = Float64Array

/** Your equity against a range, given your hand, and how far the chart could have it out. */
export function equityVs(
  h: number,
  range: Range,
  eq: Equities = chart(),
): { equity: number; weight: number; band: number } {
  let weight = 0
  let won = 0
  let squares = 0
  for (let c = 0; c < CLASS_COUNT; c++) {
    const w = compat(h, c) * range[c]
    if (w === 0) continue
    weight += w
    won += w * eq.get(h, c)
    squares += w * w
  }
  if (weight === 0) return { equity: 0, weight: 0, band: 0 }
  // Independent cells, each out by at most CELL_BAND at 95%: the weighted mean
  // is out by at most CELL_BAND × √Σw² / Σw, plus the rounding, which is not
  // random and so adds in full.
  return {
    equity: won / weight,
    weight,
    band: (CELL_BAND * Math.sqrt(squares)) / weight + ROUNDING,
  }
}

/** How many of the 1,326 two-card hands a range holds, before anybody's cards are seen. */
export function rangeCombos(range: Range): number {
  let n = 0
  for (let c = 0; c < CLASS_COUNT; c++) n += range[c] * CLASSES[c].combos.length
  return n
}

/** The share of all starting hands a range holds, in [0, 1]. */
export const rangeShare = (range: Range) => rangeCombos(range) / 1_326

// ---------------------------------------------------------------------------
// The value of a shove.
// ---------------------------------------------------------------------------

/** One player behind you, as the shove meets them. */
export interface CallerOutcome {
  seat: SeatId
  /** The chance the action reaches them (everybody before folded) and they call. */
  calls: number
  /** Your share of the pot when they are the one who calls. */
  equity: number
  /** The pot you are playing for when they call, in big blinds. */
  pot: number
}

/** The shove, priced. Everything in big blinds, measured against folding. */
export interface ShoveValue {
  ev: number
  /** How far the chart's sampling could move `ev`, at 95%. */
  band: number
  /** The chance everybody behind folds. */
  foldAll: number
  callers: CallerOutcome[]
  /** Your equity when called, averaged over who calls. */
  equityCalled: number
}

/**
 * What shoving hand `h` from this spot is worth over folding, against these
 * calling ranges (one per player behind, in turn order).
 *
 * The line at the top of the file, term for term. `calls` for a player is
 * `P(reaches them) × P(they hold a calling hand)`, the second counted exactly
 * against your two cards.
 */
export function shoveEv(
  h: number,
  spot: Spot,
  calling: readonly Range[],
  eq: Equities = chart(),
): ShoveValue {
  const seats = behind(spot.seat)
  const risk = spot.stack - posted(spot.seat)
  let reach = 1
  let ev = 0
  let band = 0
  let calledWeight = 0
  let calledEquity = 0
  const callers: CallerOutcome[] = []
  seats.forEach((seat, i) => {
    const range = calling[i]
    const vs = equityVs(h, range, eq)
    const q = vs.weight / UNSEEN_COMBOS
    const calls = reach * q
    // Both stacks, plus whichever blinds belong to neither of you.
    const pot = 2 * spot.stack + (BLINDS - posted(spot.seat) - posted(seat))
    ev += calls * (vs.equity * pot - risk)
    band += calls * pot * vs.band
    calledWeight += calls
    calledEquity += calls * vs.equity
    callers.push({ seat, calls, equity: vs.equity, pot })
    reach *= 1 - q
  })
  ev += reach * BLINDS
  return {
    ev,
    band,
    foldAll: reach,
    callers,
    equityCalled: calledWeight === 0 ? 0 : calledEquity / calledWeight,
  }
}

/**
 * What calling a shove is worth to the player in `seat`, for each hand they
 * could hold, against a shoving range. Their own stack is at least yours, so
 * the call is for `stack` and they win the pot or lose what they add.
 */
export function callValues(
  seat: SeatId,
  spot: Spot,
  shoving: Range,
  eq: Equities = chart(),
): Float64Array {
  const pot = 2 * spot.stack + (BLINDS - posted(spot.seat) - posted(seat))
  const risk = spot.stack - posted(seat)
  const out = new Float64Array(CLASS_COUNT)
  for (let c = 0; c < CLASS_COUNT; c++) {
    const vs = equityVs(c, shoving, eq)
    out[c] = vs.weight === 0 ? -risk : vs.equity * pot - risk
  }
  return out
}

/** The shover's hands, each priced against these callers. */
function shoveValues(spot: Spot, calling: readonly Range[], eq: Equities): Float64Array {
  const out = new Float64Array(CLASS_COUNT)
  for (let h = 0; h < CLASS_COUNT; h++) out[h] = shoveEv(h, spot, calling, eq).ev
  return out
}

const pureBest = (values: Float64Array): Range => {
  const out = new Float64Array(CLASS_COUNT)
  for (let i = 0; i < CLASS_COUNT; i++) out[i] = values[i] > 0 ? 1 : 0
  return out
}

/** The Nash ranges for one spot: who shoves, and who calls in each seat behind. */
export interface NashRanges {
  shove: Range
  /** One per player behind, in turn order. */
  call: Range[]
}

/**
 * The equilibrium for one spot, by fictitious play: each side answers the
 * other's average strategy so far with its best reply, and the averages
 * converge on the equilibrium. The average is weighted towards recent rounds
 * (a step of 2 / (t + 2) rather than 1 / (t + 1)), which forgets the opening
 * guess — everybody shoving everything — fast enough that two thousand rounds
 * leave no hand more than a twentieth of a big blind from its best reply, and
 * all but five of the 1,300-odd hand-and-seat pairs within a fiftieth.
 *
 * Most hands come out all or nothing. The few that sit exactly on the line
 * come out mixed (sometimes shove, sometimes fold), which is what an
 * equilibrium does with a hand worth the same either way; they are stored as
 * mixed, snapped to whole only within a fiftieth.
 *
 * Run by `pnpm shove-chart` and stored, because it is a few hundred
 * milliseconds a spot and there are sixty-five spots; `tests/shoveRange.test.ts`
 * checks every stored one is still an equilibrium of the stored equities.
 */
export function solveNash(spot: Spot, eq: Equities = chart(), rounds = 2_000): NashRanges {
  const seats = behind(spot.seat)
  const shove = new Float64Array(CLASS_COUNT).fill(1)
  const call = seats.map((seat) => pureBest(callValues(seat, spot, shove, eq)))
  for (let t = 1; t <= rounds; t++) {
    const step = 2 / (t + 2)
    const bestShove = pureBest(shoveValues(spot, call, eq))
    for (let i = 0; i < CLASS_COUNT; i++) shove[i] += (bestShove[i] - shove[i]) * step
    seats.forEach((seat, k) => {
      const best = pureBest(callValues(seat, spot, shove, eq))
      for (let i = 0; i < CLASS_COUNT; i++) call[k][i] += (best[i] - call[k][i]) * step
    })
  }
  const snap = (r: Range) => r.map((v) => (v < SNAP ? 0 : v > 1 - SNAP ? 1 : v)) as Range
  return { shove: snap(shove), call: call.map(snap) }
}

/** A weight this close to all or nothing is stored as all or nothing. */
const SNAP = 0.02

// ---------------------------------------------------------------------------
// The stored equilibria, and the callers either side of them.
// ---------------------------------------------------------------------------

/**
 * A range as 169 bits, six to a base-64 character, then a `~` and the mixed
 * hands if there are any: two characters of index and one of weight (in
 * 63rds) each.
 */
export function encodeRange(range: Range): string {
  let out = ''
  for (let i = 0; i < CLASS_COUNT; i += 6) {
    let n = 0
    for (let b = 0; b < 6 && i + b < CLASS_COUNT; b++) if (range[i + b] >= 0.5) n |= 1 << b
    out += B64[n]
  }
  let mixed = ''
  for (let i = 0; i < CLASS_COUNT; i++) {
    if (range[i] > 0 && range[i] < 1) {
      mixed += B64[i >> 6] + B64[i & 63] + B64[Math.min(62, Math.max(1, Math.round(range[i] * 63)))]
    }
  }
  return mixed ? `${out}~${mixed}` : out
}

export function decodeRange(text: string): Range {
  const [bits, mixed = ''] = text.split('~')
  const out = new Float64Array(CLASS_COUNT)
  for (let i = 0; i < CLASS_COUNT; i++) {
    const n = B64.indexOf(bits[Math.floor(i / 6)])
    out[i] = (n >> (i % 6)) & 1
  }
  for (let at = 0; at < mixed.length; at += 3) {
    const i = (B64.indexOf(mixed[at]) << 6) | B64.indexOf(mixed[at + 1])
    out[i] = B64.indexOf(mixed[at + 2]) / 63
  }
  return out
}

/** The key a spot is stored under in the chart: "btn-7". */
export const spotKey = (spot: Spot) => `${spot.seat}-${spot.stack}`

const nashCache = new Map<string, NashRanges>()

/** The stored Nash ranges for a spot. */
export function nashFor(spot: Spot): NashRanges {
  const key = spotKey(spot)
  const cached = nashCache.get(key)
  if (cached) return cached
  const stored = NASH[key]
  if (!stored) throw new Error(`The shove chart has no spot ${key}`)
  const [shove, ...call] = stored.split('.').map(decodeRange)
  const ranges = { shove, call }
  nashCache.set(key, ranges)
  return ranges
}

/**
 * A calling range `factor` times the size of Nash's, taken from the top of the
 * caller's own ordering: the hands that do best against your shoving range come
 * in first and go out last. The last hand in is taken in part, so the size is
 * exact.
 */
export function scaledCalls(values: Float64Array, nashCall: Range, factor: number): Range {
  const target = rangeCombos(nashCall) * factor
  const order = Array.from({ length: CLASS_COUNT }, (_, i) => i).sort(
    (a, b) => values[b] - values[a],
  )
  const out = new Float64Array(CLASS_COUNT)
  let left = target
  for (const c of order) {
    if (left <= 0) break
    const n = CLASSES[c].combos.length
    out[c] = Math.min(1, left / n)
    left -= n
  }
  return out
}

/** The three sets of callers a spot is priced against. */
export interface CallerModels {
  tight: Range[]
  nash: Range[]
  loose: Range[]
}

const modelCache = new Map<string, CallerModels>()

/** Nash's callers for a spot, and a third tighter and a third looser. Memoised: pure in the spot. */
export function callerModels(spot: Spot, eq: Equities = chart()): CallerModels {
  const key = spotKey(spot)
  const cached = eq === chart() ? modelCache.get(key) : undefined
  if (cached) return cached
  const nash = nashFor(spot)
  const seats = behind(spot.seat)
  const values = seats.map((seat) => callValues(seat, spot, nash.shove, eq))
  const models = {
    nash: nash.call,
    tight: nash.call.map((r, i) => scaledCalls(values[i], r, CALLER_SPREAD.tight)),
    loose: nash.call.map((r, i) => scaledCalls(values[i], r, CALLER_SPREAD.loose)),
  }
  if (eq === chart()) modelCache.set(key, models)
  return models
}
