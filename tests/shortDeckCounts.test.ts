// The counts `/blog/short-deck-flush-beats-full-house` prints, recounted.
//
// The post's case is that Short Deck's flush-over-full-house rule is the deck's
// arithmetic, not a house whim, and it makes that case with numbers. So the
// five-card numbers come from dealing every one of the 376,992 hands through
// the evaluator that settles the pots, and this fails if any of them moves.
// About a second. The seven-card counts in the same post take minutes and are
// not pinned here; the post says so.

import test from 'ava'
import { createDeck, SHORT_DECK_RANKS } from '@/lib/poker/cards'
import { evaluateShortDeck, SHORT_DECK_CATEGORIES } from '@/lib/poker/shortDeck'

function countFiveCardHands(): Map<string, number> {
  const deck = createDeck(SHORT_DECK_RANKS)
  const counts = new Map<string, number>()
  const n = deck.length
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const { name } = evaluateShortDeck([deck[a], deck[b], deck[c], deck[d], deck[e]])
            counts.set(name, (counts.get(name) ?? 0) + 1)
          }
  return counts
}

test('every five-card short-deck hand, counted the way the post says', (t) => {
  const counts = countFiveCardHands()
  t.is(
    [...counts.values()].reduce((sum, n) => sum + n, 0),
    376_992,
  )
  t.is(counts.get('Flush'), 480)
  t.is(counts.get('Full House'), 1_728)
  t.is(counts.get('Straight'), 6_120)
  t.is(counts.get('Three of a Kind'), 16_128)
})

test('on five cards the order is the order of rarity, from a pair up', (t) => {
  // The post's argument in one line: rarer ranks higher. Not at the very
  // bottom, where nothing at all is rarer than a pair, and the post says so.
  const counts = countFiveCardHands()
  t.is(counts.get('Pair'), 193_536)
  t.is(counts.get('High Card'), 122_400)
  const byRank = SHORT_DECK_CATEGORIES.map((name) => counts.get(name) ?? 0)
  for (let i = 2; i < byRank.length; i++) {
    t.true(
      byRank[i] < byRank[i - 1],
      `${SHORT_DECK_CATEGORIES[i]} (${byRank[i]}) is not rarer than ${SHORT_DECK_CATEGORIES[i - 1]} (${byRank[i - 1]})`,
    )
  }
})
