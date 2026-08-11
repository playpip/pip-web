import { createHash } from 'node:crypto'
import test from 'ava'
import {
  BAND_LISTS,
  CHART_RANKS,
  chartHand,
  comboCount,
  cumulativeShare,
  dealtOdds,
  HAND_BANDS,
  HAND_NOTES,
  handCards,
  TOTAL_COMBOS,
} from '@/config/startingHands'
import { cardToString } from '@/lib/poker/cards'

// The chart on /learn/starting-hands is 169 cells, and the prose above it says
// the bands cover 13%, 20% and 41% of hands. A reader cannot check either. So
// the grid and the percentages are both derived from the same three lists, and
// these tests check the lists are well formed and that the derivation lands
// where the copy says it does.

const ALL_HANDS = new Set(
  CHART_RANKS.flatMap((_, row) => CHART_RANKS.map((__, col) => chartHand(row, col))),
)

test('the grid is the standard 169 distinct starting hands', (t) => {
  t.is(CHART_RANKS.length, 13)
  t.is(ALL_HANDS.size, 169)
  const pairs = [...ALL_HANDS].filter((h) => h.length === 2)
  const suited = [...ALL_HANDS].filter((h) => h.endsWith('s'))
  const offsuit = [...ALL_HANDS].filter((h) => h.endsWith('o'))
  t.is(pairs.length, 13)
  t.is(suited.length, 78)
  t.is(offsuit.length, 78)
})

test('the combination counts add up to a 52-card deck', (t) => {
  const total = [...ALL_HANDS].reduce((sum, hand) => sum + comboCount(hand), 0)
  t.is(total, TOTAL_COMBOS)
  t.is(TOTAL_COMBOS, (52 * 51) / 2)
})

test('suited hands sit above the diagonal and offsuit below it', (t) => {
  // AKs must be the cell one right of AA, and AKo one below it. Getting this
  // backwards is the single easiest way to ship a chart that reads correctly
  // and says the opposite of what it means.
  t.is(chartHand(0, 0), 'AA')
  t.is(chartHand(0, 1), 'AKs')
  t.is(chartHand(1, 0), 'AKo')
  t.is(chartHand(12, 12), '22')
  t.is(chartHand(7, 8), '76s')
  t.is(chartHand(8, 7), '76o')
})

test('every banded hand is a real cell on the grid, and no hand is in two bands', (t) => {
  const seen = new Set<string>()
  for (const [band, hands] of Object.entries(BAND_LISTS)) {
    for (const hand of hands) {
      t.true(ALL_HANDS.has(hand), `${hand} (${band}) is not a hand on the grid`)
      t.false(seen.has(hand), `${hand} is in more than one band`)
      seen.add(hand)
    }
  }
  t.is(seen.size, Object.keys(HAND_BANDS).length)
})

test('the bands cover the share of hands the page claims', (t) => {
  // 13% early, 20% middle, 41% on the button, all quoted in the copy, and the
  // "roughly triples" sentence depends on the first and last.
  t.is(cumulativeShare('any').toFixed(1), '13.1')
  t.is(cumulativeShare('middle').toFixed(1), '20.4')
  t.is(cumulativeShare('late').toFixed(1), '40.9')
})

// The chart is tappable, so a cell now also states how often the hand arrives
// and shows it as two real cards. Both are computed rather than written out,
// which is the only reason 169 of them can be trusted.

test('the dealt odds a cell quotes match the frequency table in the prose', (t) => {
  // The rows of the "How often you actually get the good stuff" table that name
  // a single hand. If a cell and the table above it ever disagreed, a reader
  // would have no way to tell which one was lying.
  const pair = dealtOdds('AA')
  t.is(pair.pct.toFixed(2), '0.45')
  t.is(pair.oneIn, 221)

  const suited = dealtOdds('AKs')
  t.is(suited.pct.toFixed(2), '0.30')
  t.is(suited.oneIn, 332)

  const offsuit = dealtOdds('AKo')
  t.is(offsuit.pct.toFixed(2), '0.90')
  t.is(offsuit.oneIn, 111)
})

test('every cell quotes a share of the deck, and the 169 of them add to all of it', (t) => {
  const total = CHART_RANKS.flatMap((_, row) =>
    CHART_RANKS.map((__, col) => dealtOdds(chartHand(row, col)).pct),
  ).reduce((sum, pct) => sum + pct, 0)
  t.is(total.toFixed(4), '100.0000')
})

test('a cell shows two real cards of the shape its notation claims', (t) => {
  for (const hand of ALL_HANDS) {
    const [a, b] = handCards(hand)
    t.is(a.rank, hand[0] as typeof a.rank, `${hand}: first card`)
    t.is(b.rank, hand[1] as typeof b.rank, `${hand}: second card`)
    const sameSuit = a.suit === b.suit
    t.is(sameSuit, hand.endsWith('s'), `${hand}: suitedness`)
    t.not(cardToString(a), cardToString(b), `${hand}: the same card twice`)
  }
})

test('every note is attached to a hand that exists on the grid', (t) => {
  for (const hand of Object.keys(HAND_NOTES)) {
    t.true(ALL_HANDS.has(hand), `${hand} has a note but is not a cell on the chart`)
    t.true(HAND_NOTES[hand].length > 0, `${hand}: empty note`)
  }
})

test('a few hands the copy names by hand are in the band the copy puts them in', (t) => {
  // Each of these is asserted in prose, so a silent edit to a list should fail
  // here rather than quietly contradict the sentence next to the chart.
  t.is(HAND_BANDS.KTs, 'any', 'the copy says KTs plays from anywhere')
  t.is(HAND_BANDS.KTo, 'late', 'and that KTo waits for the button')
  t.is(HAND_BANDS.ATo, 'middle')
  t.is(HAND_BANDS.KJo, 'middle')
  t.is(HAND_BANDS.JTo, 'late')
  t.is(HAND_BANDS.QJo, 'middle')
  t.is(HAND_BANDS.AA, 'any')
  t.false('72o' in HAND_BANDS, 'the worst hand in Hold’em folds everywhere')
  t.is(HAND_BANDS.J9s, 'middle', 'the copy calls J9s a fold from the first seat')
})

// public/learn/starting-hands-chart.png is a flat picture of this grid,
// generated in the marketing repo from these same lists and offered to anyone
// who wants to repost it (components/learn/ReuseChart.tsx). Nothing in this
// build can see inside a PNG, so editing a band here would leave the one image
// we actively invite the internet to take showing the old grid, while every
// page on the site still looked right. Pinning the bands turns that silence
// into a failing test with the regenerate step written in it.
test('the bands are pinned, because a standalone chart image ships from them', (t) => {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(Object.entries(HAND_BANDS).sort()))
    .digest('hex')
    .slice(0, 12)
  t.is(
    fingerprint,
    '5b5da858de29',
    'The bands changed. Regenerate public/learn/starting-hands-chart.png with the marketing repo’s assets/capture-harness/learn-art.mjs, put the new file’s real dimensions into config/learn.ts, then update this fingerprint.',
  )
})
