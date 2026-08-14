// The starting-hand chart on /learn/starting-hands.
//
// The grid is 169 cells and the prose above it quotes three percentages. Both
// are derived from the three lists below rather than written out, so the chart
// and the sentence describing it cannot drift apart, which is the failure mode
// for a page like this, where a reader has no way to check either one.
//
// The bands are conventional taught beginner ranges, not solver output, and the
// page says so in its own words. What the code guarantees is consistency, not
// correctness of the strategy: tests/startingHands.test.ts checks the lists are
// disjoint, name real hands, and add up to the percentages the copy quotes.

import { cardFromString, type Card } from '@/lib/poker/cards'

/** Aces first, so the grid reads the way every printed chart does. */
export const CHART_RANKS = [
  'A',
  'K',
  'Q',
  'J',
  'T',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
] as const

/** The earliest seat a hand is worth opening from, when it folds round to you. */
export type Band = 'any' | 'middle' | 'late'

/**
 * The bands from the earliest seat that opens them to the latest, which is the
 * order the whole chart is arranged by. A seat opens its own band and every
 * band above it, so this is the list any "does this seat play this hand?"
 * question is answered against.
 */
export const BAND_ORDER: readonly Band[] = ['any', 'middle', 'late']

/** The symbol printed in the cell. Unbanded hands get nothing, and fold. */
export const BAND_SYMBOL: Record<Band, string> = {
  any: '●',
  middle: '◐',
  late: '○',
}

export const BAND_LABEL: Record<Band, string> = {
  any: 'Any position',
  middle: 'Middle onwards',
  late: 'Late only, the cutoff or the button',
}

// Written out rather than expressed as "22+" / "ATs+" shorthand. The shorthand
// is shorter to write and slower to check, and this list is the one thing on
// the page a reader is trusting us with.
const ANY_POSITION = [
  'AA',
  'KK',
  'QQ',
  'JJ',
  'TT',
  '99',
  '88',
  '77',
  '66',
  '55',
  '44',
  '33',
  '22',
  'AKs',
  'AQs',
  'AJs',
  'ATs',
  'KQs',
  'KJs',
  'KTs',
  'QJs',
  'QTs',
  'JTs',
  'T9s',
  '98s',
  'AKo',
  'AQo',
  'AJo',
  'KQo',
]

const MIDDLE_ONWARDS = [
  'A9s',
  'A8s',
  'A7s',
  'A6s',
  'A5s',
  'A4s',
  'A3s',
  'A2s',
  'K9s',
  'Q9s',
  'J9s',
  'T8s',
  '87s',
  '76s',
  '65s',
  'ATo',
  'KJo',
  'QJo',
]

const LATE_ONLY = [
  'K8s',
  'K7s',
  'K6s',
  'K5s',
  'K4s',
  'K3s',
  'K2s',
  'Q8s',
  'J8s',
  'T7s',
  '97s',
  '86s',
  '75s',
  '64s',
  '54s',
  '53s',
  '43s',
  'A9o',
  'A8o',
  'A7o',
  'A6o',
  'A5o',
  'A4o',
  'A3o',
  'A2o',
  'KTo',
  'K9o',
  'QTo',
  'Q9o',
  'JTo',
  'J9o',
  'T9o',
  '98o',
  '87o',
]

/** Hand -> band. Anything absent folds. */
export const HAND_BANDS: Record<string, Band> = Object.fromEntries([
  ...ANY_POSITION.map((h) => [h, 'any' as Band]),
  ...MIDDLE_ONWARDS.map((h) => [h, 'middle' as Band]),
  ...LATE_ONLY.map((h) => [h, 'late' as Band]),
])

export const BAND_LISTS: Record<Band, readonly string[]> = {
  any: ANY_POSITION,
  middle: MIDDLE_ONWARDS,
  late: LATE_ONLY,
}

/**
 * The plain-English version of each band's share, for the copy that says it in
 * words rather than as a percentage.
 *
 * It lives here because two guides quote it and they disagreed for four days:
 * /learn/starting-hands opened by saying a hand in seven from the first seat
 * and /learn/position's table said a hand in eight, for the same computed 13%.
 * Both pages were drawing the percentage from cumulativeShare() and writing the
 * fraction out by hand, which is the half of a claim no computation was
 * touching. tests/guideClaims.test.ts now pins each fraction to within a point
 * of the share it describes, and checks no simpler fraction fits better.
 */
export const BAND_ROUGHLY: Record<Band, { text: string; fraction: number }> = {
  any: { text: 'one hand in eight', fraction: 1 / 8 },
  middle: { text: 'one in five', fraction: 1 / 5 },
  late: { text: 'two in five', fraction: 2 / 5 },
}

/**
 * The hand in row `row`, column `col` of the grid. Suited hands sit above the
 * diagonal and offsuit below it, which is the convention every printed chart
 * uses, so a reader who has seen one before can read this one without a key.
 */
export function chartHand(row: number, col: number): string {
  const a = CHART_RANKS[row]
  const b = CHART_RANKS[col]
  if (row === col) return `${a}${a}`
  // CHART_RANKS runs strongest first, so the lower index is the higher card.
  const [hi, lo] = row < col ? [a, b] : [b, a]
  return `${hi}${lo}${row < col ? 's' : 'o'}`
}

/** How many of the 1,326 two-card combinations make this hand. */
export function comboCount(hand: string): number {
  if (hand.length === 2) return 6
  return hand.endsWith('s') ? 4 : 12
}

export const TOTAL_COMBOS = 1326

/** The share of hands a band covers, cumulatively with the bands above it. */
export function cumulativeShare(band: Band): number {
  const upTo = BAND_ORDER.slice(0, BAND_ORDER.indexOf(band) + 1)
  const combos = upTo.flatMap((b) => BAND_LISTS[b]).reduce((sum, hand) => sum + comboCount(hand), 0)
  return (combos / TOTAL_COMBOS) * 100
}

/**
 * How often a group of cells is dealt, as a percentage and as a "1 in n". The
 * prose table quotes five of these, and it names the cells rather than typing
 * the percentages, because the combination counts have an identity behind them
 * (all 169 of them add to 1,326) and a typed percentage has nothing.
 */
export function groupOdds(hands: readonly string[]): { pct: number; oneIn: number } {
  const combos = hands.reduce((sum, hand) => sum + comboCount(hand), 0)
  return { pct: (combos / TOTAL_COMBOS) * 100, oneIn: Math.round(TOTAL_COMBOS / combos) }
}

/**
 * How often a hand is dealt. Computed from the combination count rather than
 * written out, so there is no table of 169 numbers to keep correct.
 */
export function dealtOdds(hand: string): { pct: number; oneIn: number } {
  return groupOdds([hand])
}

/** The thirteen pairs, in chart order. Quoted as a group by the copy. */
export const POCKET_PAIRS = CHART_RANKS.map((rank) => `${rank}${rank}`)

// --- what a starting hand becomes ------------------------------------------
//
// Two facts the copy quotes about the run-out rather than the deal. Same rule
// as everything above: they are counts of boards, not typed percentages. Each
// board falls in exactly one bucket, so a bucket list has to add to the number
// of boards there are, and that sum is the test. Retyping "11.8%" into a test
// would have checked nothing.

/** n choose k, for the small n these two facts need. */
function choose(n: number, k: number): number {
  let result = 1
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1)
  return Math.round(result)
}

const sum = (counts: readonly number[]): number => counts.reduce((a, b) => a + b, 0)

/**
 * The 19,600 flops you can see holding a pocket pair, split by how many of the
 * three cards match your rank: none, one (a set), both (quads). Two or more of
 * the 48 that miss can still pair the board, but that is the board's pair and
 * not yours, which is the distinction the copy is drawing.
 */
export const FLOPS_BY_PAIR_HELP = [0, 1, 2].map((k) => choose(2, k) * choose(48, 3 - k))

/**
 * The 2,118,760 five-card boards you can see holding two of a suit, split by
 * how many of the board's cards share it. Three or more is a flush.
 */
export const BOARDS_BY_SUIT_HELP = [0, 1, 2, 3, 4, 5].map((k) => choose(11, k) * choose(39, 5 - k))

/** How often a pocket pair flops a set or better. */
export const SET_OR_BETTER_ON_THE_FLOP = sum(FLOPS_BY_PAIR_HELP.slice(1)) / sum(FLOPS_BY_PAIR_HELP)

/** How often two suited cards make a flush by the river. */
export const FLUSH_BY_THE_RIVER = sum(BOARDS_BY_SUIT_HELP.slice(3)) / sum(BOARDS_BY_SUIT_HELP)

/**
 * The suited-versus-offsuit table on the page: the same two cards suited and
 * then offsuit, against the same opponent. The equities are simulation output
 * and nothing here can check them (the repo's equity module is Monte-Carlo, so
 * an exact answer would mean enumerating C(48,5) boards in the gate). What is
 * checked is the claim the page makes *about* the table (that suitedness is
 * worth three to four points), in tests/guideClaims.test.ts. The right-hand
 * note is the pair's own subtraction, so it cannot disagree with the cells.
 */
export const SUITED_MATCHUPS = [
  { cards: ['A♠K♠', 'A♠K♥'], against: 'Q♣Q♦', equity: [46.2, 42.8] },
  { cards: ['7♠6♠', '7♠6♥'], against: 'T♣T♦', equity: [21.6, 17.8] },
] as const

// Suits are arbitrary here (a hand is "AKs", not "A♠K♠"), so the detail panel
// picks a fixed pair rather than a random one, and reads the same every visit.
const SPADE = 's'
const HEART = 'h'

/**
 * Two real cards for a grid cell, so the panel shows the hand rather than
 * describing it. Suited hands get two spades, offsuit and pairs get a spade
 * and a heart, which reads as "not the same suit" at a glance.
 */
export function handCards(hand: string): Card[] {
  const [hi, lo] = [hand[0], hand[1]]
  const suited = hand.endsWith('s')
  return [cardFromString(hi + SPADE), cardFromString(lo + (suited ? SPADE : HEART))]
}

/**
 * The cells worth a sentence. Most are not: the band and the frequency say
 * everything there is to say about K4s. These are the hands a beginner most
 * reliably misreads, and the notes are the CMO's.
 */
export const HAND_NOTES: Record<string, string> = {
  AA: 'Once in 221 hands. Raise it.',
  '72o':
    'The worst hand in Hold’em: the lowest two cards that cannot make a straight together, and unsuited.',
  A5s: 'Better than it looks. The ace still plays as the highest card, and A-2-3-4-5 is a straight, so the gap between the two cards is not the dead weight it appears to be.',
  KJo: 'Looks like a raise and behaves like a trap. It makes second-best pairs against the hands that raise.',
  '22': `Worth playing for what it becomes, not what it is. Flops a set once in ${(1 / SET_OR_BETTER_ON_THE_FLOP).toFixed(1)} hands.`,
  JTs: 'The most connected hand on the chart. Straights, flushes and two decent pairs.',
  ATo: 'The most overplayed hand in poker. Top pair, bad kicker, wins small and loses big.',
}
